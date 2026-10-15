import type { SaleItem, SaleTotals } from '@/types';
import { round2 } from './utils';

export interface TotalsInput {
  items: Pick<SaleItem, 'qty' | 'unitPrice' | 'unitCost' | 'taxExempt'>[];
  /** Descuento en monto (ya convertido si venía en %). */
  discount: number;
  /** Tasa en % (ej. 16). Los artículos exentos usan 0. */
  taxRate: number;
  pricesIncludeTax: boolean;
}

/**
 * Cálculo único de totales de ticket. Úsalo en el POS, en el ticket impreso y al guardar la venta.
 * - pricesIncludeTax = true  → el total es lo que paga el cliente; el impuesto se desglosa dentro.
 * - pricesIncludeTax = false → el impuesto se suma sobre el subtotal.
 * - Artículos exentos (taxExempt) no llevan impuesto.
 * - El descuento se reparte proporcionalmente entre las líneas.
 */
export function computeTotals({ items, discount, taxRate, pricesIncludeTax }: TotalsInput): SaleTotals {
  const gross = items.reduce((acc, i) => acc + i.unitPrice * i.qty, 0);
  const cost = items.reduce((acc, i) => acc + i.unitCost * i.qty, 0);
  const itemCount = items.reduce((acc, i) => acc + i.qty, 0);
  const safeDiscount = Math.min(Math.max(0, discount || 0), gross);
  const factor = gross > 0 ? (gross - safeDiscount) / gross : 0;
  const rate = Math.max(0, taxRate || 0) / 100;

  let subtotal = 0;
  let tax = 0;
  for (const i of items) {
    const net = i.unitPrice * i.qty * factor;
    const r = i.taxExempt ? 0 : rate;
    if (pricesIncludeTax) {
      const base = r ? net / (1 + r) : net;
      subtotal += base;
      tax += net - base;
    } else {
      subtotal += net;
      tax += net * r;
    }
  }
  const total = subtotal + tax;
  // La utilidad se calcula sobre la venta neta de impuestos.
  const profit = subtotal - cost;

  return {
    gross: round2(gross),
    discount: round2(safeDiscount),
    subtotal: round2(subtotal),
    tax: round2(tax),
    total: round2(total),
    cost: round2(cost),
    profit: round2(profit),
    itemCount: round2(itemCount)
  };
}
