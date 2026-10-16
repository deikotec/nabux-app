import { arrayUnion, doc, getDoc, getDocs, increment, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { salePayments } from '@/lib/payments';
import { round2 } from '@/lib/utils';
import type { CashRegister, CashSession, MethodTotal, PaymentMethodConfig, PaymentTotals, RegisterState, Sale, SessionLive } from '@/types';
import { logActivity } from './activity';
import { refs, type Actor } from './refs';

export class CashError extends Error {}

const EMPTY_LIVE: SessionLive = { total: 0, count: 0, igtf: 0, byMethod: {} };

function isOfflineError(err: unknown) {
  const code = (err as { code?: string })?.code;
  return code === 'unavailable' || /offline/i.test(String((err as Error)?.message ?? ''));
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * Abre un turno en una caja registradora. Cada caja admite un solo turno abierto: su estado
 * (registers/{id}) funciona como candado y las reglas de Firestore lo hacen cumplir en el servidor.
 * Con conexión se comprueba en una transacción para avisar si otra persona la abrió primero;
 * sin conexión la apertura queda en cola.
 */
export async function openCashSession(
  bid: string,
  actor: Actor,
  register: CashRegister,
  openingFloat: number,
  notes = '',
  local?: { amount: number; currency: string } | null
) {
  const sessionRef = doc(refs.cashSessions(bid));
  const lockRef = refs.register(bid, register.id);
  const session = {
    status: 'open',
    registerId: register.id,
    registerName: register.name,
    openedBy: actor.uid,
    openedByName: actor.name,
    openedAt: serverTimestamp(),
    openingFloat: round2(openingFloat),
    openingFloatLocal: local ? round2(local.amount) : null,
    localCurrency: local?.currency ?? null,
    notes,
    live: EMPTY_LIVE,
    cashierIds: [actor.uid]
  };
  const lock = {
    openSessionId: sessionRef.id,
    registerName: register.name,
    openedBy: actor.uid,
    openedByName: actor.name,
    openedAt: serverTimestamp()
  };

  const queueOffline = () => {
    const batch = writeBatch(db);
    batch.set(sessionRef, session);
    batch.set(lockRef, lock);
    batch.commit().catch((e) => console.error('No se pudo abrir la caja al sincronizar', e));
  };

  if (isOffline()) queueOffline();
  else {
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(lockRef);
        const current = snap.exists() ? (snap.data() as RegisterState) : null;
        if (current?.openSessionId) {
          const open = await tx.get(refs.cashSession(bid, current.openSessionId));
          if (open.exists() && open.data().status === 'open') {
            throw new CashError(`${register.name} ya la abrió ${current.openedByName ?? 'otra persona'}. Recarga para usarla.`);
          }
        }
        tx.set(sessionRef, session);
        tx.set(lockRef, lock);
      });
    } catch (err) {
      if (err instanceof CashError || !isOfflineError(err)) throw err;
      queueOffline();
    }
  }

  logActivity(bid, actor, {
    type: 'cash_open',
    message: `Abrió ${register.name}${local ? ` con fondo inicial (y ${round2(local.amount)} ${local.currency})` : ' con fondo inicial'}`,
    refId: sessionRef.id,
    amount: round2(openingFloat)
  });
  return sessionRef.id;
}

/** Registra a la persona como cajero de un turno compartido (para "En turno" en Personal). */
export function joinCashSession(bid: string, sessionId: string, uid: string) {
  updateDoc(refs.cashSession(bid, sessionId), { cashierIds: arrayUnion(uid) }).catch((e) => console.warn('No se pudo registrar el cajero en el turno', e));
}

type SaleForTotals = Pick<Sale, 'total' | 'igtf' | 'payments' | 'paymentMethod' | 'currency' | 'changeMethodId' | 'changeAmount' | 'changeCurrency'>;

/**
 * Cambios a sumar en `live` del turno por una venta (sign = 1) o su anulación (sign = -1).
 * Replica sumPayments: pagos por método (neto de vueltos), total, tickets e IGTF.
 */
export function liveDelta(sale: SaleForTotals, sign: 1 | -1, methods: PaymentMethodConfig[] = [], localCurrency?: string | null) {
  const acc = new Map<string, { label: string; currency: string; kind: MethodTotal['kind']; amount: number; amountBase: number; count: number }>();
  for (const p of salePayments(sale)) {
    const m = acc.get(p.methodId) ?? { label: p.label, currency: p.currency, kind: p.kind, amount: 0, amountBase: 0, count: 0 };
    m.amount += p.amount;
    m.amountBase += p.amountBase;
    m.count += 1;
    acc.set(p.methodId, m);
  }
  if (sale.changeMethodId && sale.changeAmount) {
    const cfg = methods.find((x) => x.id === sale.changeMethodId);
    const m = acc.get(sale.changeMethodId) ?? {
      label: cfg?.label ?? sale.changeMethodId,
      currency: sale.changeCurrency || (cfg?.currency === 'local' ? (localCurrency ?? '') : (sale.currency ?? '')),
      kind: cfg?.kind ?? (/^cash/.test(sale.changeMethodId) ? 'cash' : 'other'),
      amount: 0,
      amountBase: 0,
      count: 0
    };
    m.amount -= sale.changeAmount;
    acc.set(sale.changeMethodId, m);
  }
  const d: Record<string, unknown> = {
    'live.total': increment(sign * (Number(sale.total) || 0)),
    'live.count': increment(sign),
    'live.igtf': increment(sign * (Number(sale.igtf) || 0))
  };
  for (const [id, m] of acc) {
    const k = `live.byMethod.${id}`;
    d[`${k}.label`] = m.label;
    d[`${k}.currency`] = m.currency;
    d[`${k}.kind`] = m.kind;
    d[`${k}.amount`] = increment(sign * m.amount);
    d[`${k}.amountBase`] = increment(sign * m.amountBase);
    d[`${k}.count`] = increment(sign * m.count);
  }
  return d;
}

/**
 * Suma una venta al turno compartido de su caja. Va aparte de la venta: si fallara (p. ej. el turno
 * ya no existe), la venta queda guardada igual.
 */
export function recordSaleInSession(bid: string, sessionId: string, actor: Actor, sale: SaleForTotals, methods: PaymentMethodConfig[], localCurrency?: string | null) {
  updateDoc(refs.cashSession(bid, sessionId), { ...liveDelta(sale, 1, methods, localCurrency), cashierIds: arrayUnion(actor.uid) }).catch((e) =>
    console.error('No se pudo sumar la venta al turno de caja', e)
  );
}

/** Convierte el acumulado de un turno compartido en los totales del corte. */
export function liveToTotals(live: SessionLive | undefined, localCurrency?: string | null): PaymentTotals {
  const src = live ?? EMPTY_LIVE;
  const byMethod: Record<string, MethodTotal> = {};
  const t: PaymentTotals = { cash: 0, card: 0, transfer: 0, total: round2(src.total), count: Math.max(0, Math.round(src.count)), igtf: round2(src.igtf), byMethod, cashBase: 0, cashLocal: 0 };
  for (const [id, m] of Object.entries(src.byMethod ?? {})) {
    const row: MethodTotal = { ...m, amount: round2(m.amount), amountBase: round2(m.amountBase), count: Math.max(0, Math.round(m.count)) };
    // Métodos que quedaron en cero (ej. una venta anulada) no aparecen en el corte.
    if (!row.count && !row.amount) continue;
    byMethod[id] = row;
    if (row.kind === 'cash') t.cash += row.amountBase;
    else if (row.kind === 'card') t.card += row.amountBase;
    else t.transfer += row.amountBase;
    if (row.kind !== 'cash') continue;
    if (localCurrency && row.currency === localCurrency) t.cashLocal = round2((t.cashLocal ?? 0) + row.amount);
    else t.cashBase = round2((t.cashBase ?? 0) + row.amount);
  }
  t.cash = round2(t.cash);
  t.card = round2(t.card);
  t.transfer = round2(t.transfer);
  return t;
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
  const localCurrency = opts.localCurrency ?? session.localCurrency ?? null;
  let totals: PaymentTotals;
  if (session.registerId) {
    // Turno compartido: el acumulado está en el propio turno (incluye las ventas de todos los cajeros).
    const fresh = await getDoc(refs.cashSession(bid, session.id)).catch(() => null);
    const live = fresh?.exists() ? (fresh.data() as CashSession).live : session.live;
    totals = liveToTotals(live, localCurrency);
  } else {
    // Turno de la versión anterior (caja personal): se suman las ventas de quien lo abrió.
    totals = sumPayments(await getSessionSales(bid, session), { ...opts, localCurrency });
  }
  const expectedCash = round2((session.openingFloat || 0) + (totals.cashBase ?? 0));
  const dual = !!(session.localCurrency || opts.localCurrency);
  const expectedCashLocal = dual ? round2((session.openingFloatLocal || 0) + (totals.cashLocal ?? 0)) : null;
  return { totals, expectedCash, expectedCashLocal };
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
  const batch = writeBatch(db);
  batch.update(refs.cashSession(bid, session.id), {
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
  // Libera la caja en el mismo paso: otra persona ya puede abrir un turno nuevo en ella.
  if (session.registerId) batch.set(refs.register(bid, session.registerId), { openSessionId: null, closedAt: serverTimestamp(), closedByName: actor.name }, { merge: true });
  // Sin conexión, commit() no se resuelve hasta sincronizar: no se espera para no bloquear el corte.
  if (isOffline()) batch.commit().catch((e) => console.error('El corte de caja no se pudo sincronizar', e));
  else await batch.commit();
  const diffText = `diferencia ${difference >= 0 ? '+' : ''}${difference.toFixed(2)}${
    differenceLocal !== null ? ` y ${differenceLocal >= 0 ? '+' : ''}${differenceLocal.toFixed(2)} ${session.localCurrency ?? opts.localCurrency ?? ''}` : ''
  }`;
  logActivity(bid, actor, {
    type: 'cash_close',
    message: `Cerró ${session.registerName ?? 'caja'} · ${totals.count} ${totals.count === 1 ? 'ticket' : 'tickets'} · ${diffText}`,
    refId: session.id,
    amount: totals.total
  });
  return { totals, expectedCash, expectedCashLocal, difference, differenceLocal };
}
