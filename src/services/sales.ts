import { doc, increment, runTransaction, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { computeTotals } from '@/lib/totals';
import { round2 } from '@/lib/utils';
import { PAYMENT_LABELS } from '@/config/app';
import type { Business, PaymentMethod, Product, Sale, SaleItem } from '@/types';
import { logActivityIn } from './activity';
import { refs, type Actor } from './refs';

export class CheckoutError extends Error {}

export interface CheckoutInput {
  business: Pick<Business, 'id' | 'taxRate' | 'pricesIncludeTax' | 'settings'>;
  actor: Actor;
  items: SaleItem[];
  /** Descuento en monto. */
  discount: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number | null;
  customerName?: string;
  sessionId?: string | null;
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
  const cashReceived = input.paymentMethod === 'cash' ? round2(Number(input.cashReceived) || totals.total) : null;
  if (cashReceived !== null && cashReceived < totals.total) {
    throw new CheckoutError('El efectivo recibido es menor al total a cobrar.');
  }
  const change = cashReceived !== null ? round2(cashReceived - totals.total) : null;
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
      total: round2(i.unitPrice * i.qty)
    })),
    productIds,
    ...totals,
    paymentMethod: input.paymentMethod,
    cashReceived,
    change,
    customerName: input.customerName?.trim() || 'Cliente mostrador',
    cashierId: actor.uid,
    cashierName: actor.name,
    sessionId: input.sessionId ?? null,
    status: 'completed' as const
  };

  const activityMessage = (folio: string) =>
    `Venta ${folio} · ${totals.itemCount} art. · ${PAYMENT_LABELS[input.paymentMethod]}`;

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
