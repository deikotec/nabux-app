import { addDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { round2 } from '@/lib/utils';
import type { CashSession, PaymentTotals, Sale } from '@/types';
import { logActivity } from './activity';
import { refs, type Actor } from './refs';

export async function openCashSession(bid: string, actor: Actor, openingFloat: number, notes = '') {
  const ref = await addDoc(refs.cashSessions(bid), {
    status: 'open',
    openedBy: actor.uid,
    openedByName: actor.name,
    openedAt: serverTimestamp(),
    openingFloat: round2(openingFloat),
    notes
  });
  logActivity(bid, actor, {
    type: 'cash_open',
    message: `Abrió caja con fondo inicial`,
    refId: ref.id,
    amount: round2(openingFloat)
  });
  return ref.id;
}

export function sumPayments(sales: Pick<Sale, 'status' | 'paymentMethod' | 'total'>[]): PaymentTotals {
  const t: PaymentTotals = { cash: 0, card: 0, transfer: 0, total: 0, count: 0 };
  for (const s of sales) {
    if (s.status !== 'completed') continue;
    t[s.paymentMethod] += s.total;
    t.total += s.total;
    t.count += 1;
  }
  t.cash = round2(t.cash);
  t.card = round2(t.card);
  t.transfer = round2(t.transfer);
  t.total = round2(t.total);
  return t;
}

/** Ventas del turno (filtradas por cajero para cumplir las reglas de seguridad). */
export async function getSessionSales(bid: string, session: Pick<CashSession, 'id' | 'openedBy'>): Promise<Sale[]> {
  const snap = await getDocs(
    query(refs.sales(bid), where('sessionId', '==', session.id), where('cashierId', '==', session.openedBy))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, 'id'>) }));
}

export async function getSessionSummary(bid: string, session: CashSession) {
  const sales = await getSessionSales(bid, session);
  const totals = sumPayments(sales);
  const expectedCash = round2((session.openingFloat || 0) + totals.cash);
  return { sales, totals, expectedCash };
}

/** Corte de caja: compara el efectivo contado contra el esperado y cierra el turno. */
export async function closeCashSession(bid: string, actor: Actor, session: CashSession, declaredCash: number, notes = '') {
  const { totals, expectedCash } = await getSessionSummary(bid, session);
  const difference = round2(declaredCash - expectedCash);
  await updateDoc(refs.cashSession(bid, session.id), {
    status: 'closed',
    closedAt: serverTimestamp(),
    closedBy: actor.uid,
    closedByName: actor.name,
    declaredCash: round2(declaredCash),
    expectedCash,
    difference,
    totals,
    notes
  });
  logActivity(bid, actor, {
    type: 'cash_close',
    message: `Cerró caja · ${totals.count} tickets · diferencia ${difference >= 0 ? '+' : ''}${difference.toFixed(2)}`,
    refId: session.id,
    amount: totals.total
  });
  return { totals, expectedCash, difference };
}
