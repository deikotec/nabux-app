import { addDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { salePayments } from '@/lib/payments';
import { round2 } from '@/lib/utils';
import type { CashSession, MethodTotal, PaymentMethodConfig, PaymentTotals, Sale } from '@/types';
import { logActivity } from './activity';
import { refs, type Actor } from './refs';

export async function openCashSession(
  bid: string,
  actor: Actor,
  openingFloat: number,
  notes = '',
  local?: { amount: number; currency: string } | null
) {
  const ref = await addDoc(refs.cashSessions(bid), {
    status: 'open',
    openedBy: actor.uid,
    openedByName: actor.name,
    openedAt: serverTimestamp(),
    openingFloat: round2(openingFloat),
    openingFloatLocal: local ? round2(local.amount) : null,
    localCurrency: local?.currency ?? null,
    notes
  });
  logActivity(bid, actor, {
    type: 'cash_open',
    message: local ? `Abrió caja con fondo inicial (y ${round2(local.amount)} ${local.currency})` : 'Abrió caja con fondo inicial',
    refId: ref.id,
    amount: round2(openingFloat)
  });
  return ref.id;
}

/**
 * Totaliza las ventas completadas por forma de pago y por moneda.
 * - `byMethod[id].amount` es lo neto recibido en la moneda del método (descontando vueltos entregados con él).
 * - `cashBase` / `cashLocal`: efectivo neto en moneda base y local (lo que debe haber en el cajón).
 * - Compatible con ventas antiguas (un solo método, sin `payments`).
 */
export function sumPayments(
  sales: Pick<Sale, 'status' | 'paymentMethod' | 'total' | 'payments' | 'currency' | 'igtf' | 'changeMethodId' | 'changeAmount' | 'changeCurrency'>[],
  opts: { baseCurrency?: string; localCurrency?: string | null; methods?: PaymentMethodConfig[] } = {}
): PaymentTotals {
  const byMethod: Record<string, MethodTotal> = {};
  const t: PaymentTotals = { cash: 0, card: 0, transfer: 0, total: 0, count: 0, igtf: 0, byMethod, cashBase: 0, cashLocal: 0 };
  const touch = (id: string, label: string, currency: string, kind: MethodTotal['kind']) =>
    (byMethod[id] ??= { label, currency, kind, amount: 0, amountBase: 0, count: 0 });

  for (const s of sales) {
    if (s.status !== 'completed') continue;
    t.total += s.total;
    t.count += 1;
    t.igtf = (t.igtf ?? 0) + (s.igtf ?? 0);
    for (const p of salePayments(s)) {
      const currency = p.currency || opts.baseCurrency || '';
      const m = touch(p.methodId, p.label, currency, p.kind);
      // Si la entrada nació de un vuelto, el pago real corrige su tipo, etiqueta y moneda.
      m.kind = p.kind;
      m.label = p.label;
      if (!m.currency) m.currency = currency;
      m.amount += p.amount;
      m.amountBase += p.amountBase;
      m.count += 1;
      // Compatibilidad: totales por tipo en moneda base
      if (p.kind === 'cash') t.cash += p.amountBase;
      else if (p.kind === 'card') t.card += p.amountBase;
      else t.transfer += p.amountBase;
    }
    // El vuelto sale del método con que se entregó (puede ser distinto al del pago, ej. pagó por
    // Zelle y se le devolvió por pago móvil): se toma etiqueta y tipo de la configuración del método.
    if (s.changeMethodId && s.changeAmount) {
      const cfg = opts.methods?.find((x) => x.id === s.changeMethodId);
      const fallbackKind: MethodTotal['kind'] = cfg?.kind ?? (/^cash/.test(s.changeMethodId) ? 'cash' : 'other');
      const cfgCurrency = cfg ? (cfg.currency === 'local' ? opts.localCurrency ?? '' : opts.baseCurrency ?? '') : '';
      const m =
        byMethod[s.changeMethodId] ??
        touch(s.changeMethodId, cfg?.label ?? s.changeMethodId, s.changeCurrency || cfgCurrency, fallbackKind);
      m.amount -= s.changeAmount;
    }
  }

  for (const m of Object.values(byMethod)) {
    m.amount = round2(m.amount);
    m.amountBase = round2(m.amountBase);
    if (m.kind !== 'cash') continue;
    if (opts.localCurrency && m.currency === opts.localCurrency) t.cashLocal = round2((t.cashLocal ?? 0) + m.amount);
    else t.cashBase = round2((t.cashBase ?? 0) + m.amount);
  }
  t.cash = round2(t.cash);
  t.card = round2(t.card);
  t.transfer = round2(t.transfer);
  t.total = round2(t.total);
  t.igtf = round2(t.igtf ?? 0);
  return t;
}

/** Ventas del turno (filtradas por cajero para cumplir las reglas de seguridad). */
export async function getSessionSales(bid: string, session: Pick<CashSession, 'id' | 'openedBy'>): Promise<Sale[]> {
  const snap = await getDocs(
    query(refs.sales(bid), where('sessionId', '==', session.id), where('cashierId', '==', session.openedBy))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, 'id'>) }));
}

export async function getSessionSummary(
  bid: string,
  session: CashSession,
  opts: { baseCurrency?: string; localCurrency?: string | null; methods?: PaymentMethodConfig[] } = {}
) {
  const sales = await getSessionSales(bid, session);
  const totals = sumPayments(sales, { ...opts, localCurrency: opts.localCurrency ?? session.localCurrency ?? null });
  const expectedCash = round2((session.openingFloat || 0) + (totals.cashBase ?? 0));
  const dual = !!(session.localCurrency || opts.localCurrency);
  const expectedCashLocal = dual ? round2((session.openingFloatLocal || 0) + (totals.cashLocal ?? 0)) : null;
  return { sales, totals, expectedCash, expectedCashLocal };
}

/** Corte de caja: compara el efectivo contado (por moneda) contra el esperado y cierra el turno. */
export async function closeCashSession(
  bid: string,
  actor: Actor,
  session: CashSession,
  declared: { base: number; local?: number | null },
  notes = '',
  opts: { baseCurrency?: string; localCurrency?: string | null; methods?: PaymentMethodConfig[] } = {}
) {
  const { totals, expectedCash, expectedCashLocal } = await getSessionSummary(bid, session, opts);
  const difference = round2(declared.base - expectedCash);
  const differenceLocal = expectedCashLocal !== null && declared.local != null ? round2(declared.local - expectedCashLocal) : null;
  await updateDoc(refs.cashSession(bid, session.id), {
    status: 'closed',
    closedAt: serverTimestamp(),
    closedBy: actor.uid,
    closedByName: actor.name,
    declaredCash: round2(declared.base),
    expectedCash,
    difference,
    declaredCashLocal: declared.local != null ? round2(declared.local) : null,
    expectedCashLocal,
    differenceLocal,
    totals,
    notes
  });
  const diffText = `diferencia ${difference >= 0 ? '+' : ''}${difference.toFixed(2)}${
    differenceLocal !== null ? ` y ${differenceLocal >= 0 ? '+' : ''}${differenceLocal.toFixed(2)} ${session.localCurrency ?? opts.localCurrency ?? ''}` : ''
  }`;
  logActivity(bid, actor, {
    type: 'cash_close',
    message: `Cerró caja · ${totals.count} ${totals.count === 1 ? 'ticket' : 'tickets'} · ${diffText}`,
    refId: session.id,
    amount: totals.total
  });
  return { totals, expectedCash, expectedCashLocal, difference, differenceLocal };
}
