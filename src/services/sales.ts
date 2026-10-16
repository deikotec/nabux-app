import { doc, increment, runTransaction, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { computeTotals } from '@/lib/totals';
import { round2 } from '@/lib/utils';
import { applyPayments, baseToMethod, fxSettingsOf, methodCurrency, paymentMethodsOf, type PaymentDraft } from '@/lib/payments';
import type { Business, PaymentMethod, Product, RateSource, Sale, SaleItem } from '@/types';
import { logActivityIn } from './activity';
import { liveDelta, recordSaleInSession } from './cash';
import { refs, type Actor } from './refs';

export class CheckoutError extends Error {}

export interface CheckoutInput {
  business: Pick<Business, 'id' | 'taxRate' | 'pricesIncludeTax' | 'settings' | 'currency' | 'fx' | 'paymentMethods'>;
  actor: Actor;
  items: SaleItem[];
  /** Descuento en monto (moneda base). */
  discount: number;
  /** Pagos (uno o varios = pago mixto), cada uno en la moneda de su método. */
  payments?: PaymentDraft[];
  /** Tasa usada (Bs por $) y su fuente; obligatoria si hay pagos en moneda local. */
  rate?: number | null;
  rateSource?: RateSource | null;
  /** Método con el que se entrega el vuelto (si el cliente pagó de más). */
  changeMethodId?: string | null;
  /** Formato anterior (un solo método): se convierte en un pago. */
  paymentMethod?: PaymentMethod;
  cashReceived?: number | null;
  customerName?: string;
  sessionId?: string | null;
  /** Caja del turno: si la hay, la venta se suma al acumulado compartido del turno. */
  registerId?: string | null;
  /** Catálogo local (para validar stock si no hay conexión). */
  products: Product[];
}

export function formatFolio(n: number) {
  return `T-${String(n).padStart(6, '0')}`;
}

function aggregateQty(items: SaleItem[]) {
  const map = new Map<string, { qty: number; name: string; sku?: string }>();
  for (const it of items) {
    if (!it.productId) continue;
    const prev = map.get(it.productId);
    map.set(it.productId, { qty: (prev?.qty ?? 0) + it.qty, name: it.name, sku: it.sku });
  }
  return map;
}

function isOfflineError(err: unknown) {
  const code = (err as { code?: string })?.code;
  const msg = String((err as Error)?.message ?? '');
  return code === 'unavailable' && /offline/i.test(msg);
}

/**
 * Registra una venta.
 * En línea: transacción atómica → folio consecutivo, validación de stock real en servidor,
 * descuento de inventario, kardex y bitácora.
 * Sin conexión: escritura en cola (se sincroniza sola al volver la red) con folio provisional "OFF-…".
 */
export async function checkout(input: CheckoutInput): Promise<Sale> {
  const { business, actor, items } = input;
  const bid = business.id;
  if (!items.length) throw new CheckoutError('El ticket está vacío.');

  const totals = computeTotals({
    items,
    discount: input.discount,
    taxRate: business.taxRate,
    pricesIncludeTax: business.pricesIncludeTax
  });
  // ---- Pagos (mixtos, multimoneda, IGTF y vuelto) ----
  const fx = fxSettingsOf(business);
  const methods = paymentMethodsOf(business);
  const rate = fx.enabled && input.rate && input.rate > 0 ? input.rate : null;
  const drafts: PaymentDraft[] = input.payments?.length
    ? input.payments
    : [{ methodId: input.paymentMethod ?? methods[0]?.id ?? 'cash', amount: Number(input.cashReceived) || totals.total }];

  for (const d of drafts) {
    const m = methods.find((x) => x.id === d.methodId);
    if (!m) throw new CheckoutError('Forma de pago no válida.');
    if (m.currency === 'local' && !rate) throw new CheckoutError('Configura la tasa de cambio para cobrar en bolívares.');
    if (m.requiresReference && !d.reference?.trim()) throw new CheckoutError(`Falta el número de referencia de ${m.label}.`);
  }

  const paid = applyPayments({ total: totals.total, drafts, methods, business, rate });
  if (!paid.lines.length) throw new CheckoutError('Registra al menos un pago.');
  if (paid.remaining > 0.009) throw new CheckoutError(`Falta cobrar ${paid.remaining.toFixed(2)} ${business.currency}.`);

  let changeMethodId: string | null = null;
  let changeCurrency: string | null = null;
  let changeAmount: number | null = null;
  if (paid.excess > 0.009) {
    const cm =
      methods.find((m) => m.id === input.changeMethodId && m.allowsChange) ??
      // Por defecto, el vuelto sale en la moneda del último pago en efectivo.
      methods.find((m) => m.id === [...paid.lines].reverse().find((l) => l.kind === 'cash')?.methodId) ??
      methods.find((m) => m.allowsChange && m.kind === 'cash');
    if (!cm) throw new CheckoutError('El monto recibido excede el total y no hay una forma de dar vuelto.');
    if (cm.currency === 'local' && !rate) throw new CheckoutError('Configura la tasa de cambio para dar vuelto en bolívares.');
    changeMethodId = cm.id;
    changeCurrency = methodCurrency(cm, business);
    changeAmount = baseToMethod(paid.excessRaw, cm, rate);
  }
  const primary = paid.lines.length > 1 ? 'mixed' : paid.lines[0].methodId;
  const cashLine = paid.lines.length === 1 && paid.lines[0].kind === 'cash' ? paid.lines[0] : null;
  const methodsLabel = paid.lines.length > 1 ? `Mixto: ${paid.lines.map((l) => l.label).join(' + ')}` : paid.lines[0].label;

  const qtyByProduct = aggregateQty(items);
  const productIds = Array.from(qtyByProduct.keys());
  const allowNegative = !!business.settings?.allowNegativeStock;
  const saleRef = doc(refs.sales(bid));

  const base = {
    items: items.map((i) => ({
      productId: i.productId,
      name: i.name,
      sku: i.sku ?? '',
      category: i.category ?? '',
      qty: i.qty,
      unitPrice: round2(i.unitPrice),
      unitCost: round2(i.unitCost),
      total: round2(i.unitPrice * i.qty),
      ...(i.taxExempt ? { taxExempt: true } : {})
    })),
    productIds,
    ...totals,
    paymentMethod: primary,
    payments: paid.lines,
    currency: business.currency,
    localCurrency: fx.enabled ? fx.localCurrency : null,
    rate,
    rateSource: rate ? (input.rateSource ?? fx.rateSource) : null,
    totalLocal: rate ? round2(totals.total * rate) : null,
    igtf: paid.igtf,
    igtfRate: paid.igtf > 0 ? fx.igtfRate : null,
    amountDue: paid.amountDue,
    changeMethodId,
    changeCurrency,
    changeAmount,
    cashReceived: cashLine && cashLine.currency === business.currency ? cashLine.amount : null,
    change: paid.excess > 0.009 ? paid.excess : 0,
    customerName: input.customerName?.trim() || 'Cliente mostrador',
    cashierId: actor.uid,
    cashierName: actor.name,
    sessionId: input.sessionId ?? null,
    registerId: input.sessionId ? (input.registerId ?? null) : null,
    status: 'completed' as const
  };

  const activityMessage = (folio: string) => `Venta ${folio} · ${totals.itemCount} art. · ${methodsLabel}`;

  const runOnline = async () =>
    runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(refs.counters(bid));
      const snaps = await Promise.all(productIds.map((id) => tx.get(refs.product(bid, id))));

      const current = new Map<string, number>();
      snaps.forEach((snap, idx) => {
        const id = productIds[idx];
        const info = qtyByProduct.get(id)!;
        if (!snap.exists()) throw new CheckoutError(`"${info.name}" ya no existe en el inventario.`);
        const stock = Number(snap.data().stock) || 0;
        if (!allowNegative && stock < info.qty) {
          throw new CheckoutError(`Stock insuficiente de "${info.name}": disponible ${stock}, en ticket ${info.qty}.`);
        }
        current.set(id, stock);
      });

      const number = (Number(counterSnap.data()?.sale) || 0) + 1;
      const folio = formatFolio(number);

      tx.set(refs.counters(bid), { sale: number });
      tx.set(saleRef, { ...base, folio, number, offline: false, createdAt: serverTimestamp() });

      for (const id of productIds) {
        const info = qtyByProduct.get(id)!;
        const stockAfter = (current.get(id) ?? 0) - info.qty;
        tx.update(refs.product(bid, id), { stock: stockAfter, updatedAt: serverTimestamp() });
        tx.set(doc(refs.movements(bid)), {
          productId: id,
          productName: info.name,
          sku: info.sku ?? '',
          type: 'sale',
          qty: -info.qty,
          stockAfter,
          reason: `Venta ${folio}`,
          refId: saleRef.id,
          unitCost: null,
          userId: actor.uid,
          userName: actor.name,
          createdAt: serverTimestamp()
        });
      }
      logActivityIn(tx, bid, actor, { type: 'sale', message: activityMessage(folio), refId: saleRef.id, amount: totals.total });
      return { number, folio };
    });

  const runOffline = () => {
    const local = new Map(input.products.map((p) => [p.id, p]));
    for (const [id, info] of qtyByProduct) {
      const p = local.get(id);
      if (!p) throw new CheckoutError(`"${info.name}" ya no existe en el inventario.`);
      if (!allowNegative && (Number(p.stock) || 0) < info.qty) {
        throw new CheckoutError(`Stock insuficiente de "${info.name}": disponible ${p.stock}, en ticket ${info.qty}.`);
      }
    }
    const folio = `OFF-${Date.now().toString(36).toUpperCase()}`;
    const batch = writeBatch(db);
    batch.set(saleRef, { ...base, folio, number: null, offline: true, createdAt: serverTimestamp() });
    for (const [id, info] of qtyByProduct) {
      const stockAfter = (Number(local.get(id)?.stock) || 0) - info.qty;
      batch.update(refs.product(bid, id), { stock: increment(-info.qty), updatedAt: serverTimestamp() });
      batch.set(doc(refs.movements(bid)), {
        productId: id,
        productName: info.name,
        sku: info.sku ?? '',
        type: 'sale',
        qty: -info.qty,
        stockAfter,
        reason: `Venta ${folio} (sin conexión)`,
        refId: saleRef.id,
        unitCost: null,
        userId: actor.uid,
        userName: actor.name,
        createdAt: serverTimestamp()
      });
    }
    logActivityIn(batch, bid, actor, { type: 'sale', message: activityMessage(folio), refId: saleRef.id, amount: totals.total });
    // Sin conexión, commit() no resuelve hasta que el servidor confirma: no se espera.
    batch.commit().catch((e) => console.error('Venta sin conexión rechazada al sincronizar', e));
    return { number: null as number | null, folio };
  };

  let result: { number: number | null; folio: string };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    result = runOffline();
  } else {
    try {
      result = await runOnline();
    } catch (err) {
      if (isOfflineError(err)) result = runOffline();
      else throw err;
    }
  }

  // Caja compartida: suma la venta al acumulado del turno (lo usa el corte, sin leer ventas de otros).
  if (base.sessionId && base.registerId) {
    recordSaleInSession(bid, base.sessionId, actor, base, methods, fx.enabled ? fx.localCurrency : null);
  }

  return {
    id: saleRef.id,
    ...base,
    folio: result.folio,
    number: result.number,
    offline: result.number === null,
    createdAt: Timestamp.now()
  };
}

/** Anula una venta: marca el ticket, devuelve el stock y deja rastro en kardex y bitácora. */
export async function voidSale(bid: string, actor: Actor, saleId: string, reason: string) {
  await runTransaction(db, async (tx) => {
    const saleSnap = await tx.get(refs.sale(bid, saleId));
    if (!saleSnap.exists()) throw new CheckoutError('La venta no existe.');
    const sale = saleSnap.data() as Omit<Sale, 'id'>;
    if (sale.status !== 'completed') throw new CheckoutError('Esta venta ya fue anulada.');

    const qtyByProduct = aggregateQty(sale.items);
    const ids = Array.from(qtyByProduct.keys());
    const snaps = await Promise.all(ids.map((id) => tx.get(refs.product(bid, id))));
    // Venta de una caja compartida con el turno aún abierto: se descuenta de su acumulado.
    // (Si el turno ya se cerró, el corte quedó como se hizo.)
    const sessionRef = sale.registerId && sale.sessionId ? refs.cashSession(bid, sale.sessionId) : null;
    const sessionSnap = sessionRef ? await tx.get(sessionRef) : null;
    if (sessionRef && sessionSnap?.exists() && sessionSnap.data().status === 'open') {
      tx.update(sessionRef, liveDelta(sale, -1));
    }

    tx.update(refs.sale(bid, saleId), {
      status: 'voided',
      voidedAt: serverTimestamp(),
      voidedBy: actor.uid,
      voidedByName: actor.name,
      voidReason: reason.trim() || 'Sin motivo'
    });

    snaps.forEach((snap, idx) => {
      if (!snap.exists()) return; // producto eliminado: no hay stock que devolver
      const id = ids[idx];
      const info = qtyByProduct.get(id)!;
      const stockAfter = (Number(snap.data().stock) || 0) + info.qty;
      tx.update(refs.product(bid, id), { stock: stockAfter, updatedAt: serverTimestamp() });
      tx.set(doc(refs.movements(bid)), {
        productId: id,
        productName: info.name,
        sku: info.sku ?? '',
        type: 'void',
        qty: info.qty,
        stockAfter,
        reason: `Anulación ${sale.folio}`,
        refId: saleId,
        unitCost: null,
        userId: actor.uid,
        userName: actor.name,
        createdAt: serverTimestamp()
      });
    });

    logActivityIn(tx, bid, actor, {
      type: 'sale_void',
      message: `Anuló la venta ${sale.folio}${reason ? ` · ${reason}` : ''}`,
      refId: saleId,
      amount: -sale.total
    });
  });
}
