import type { SaleItem, SaleTotals } from '@/types';
import { round2 } from './utils';

export interface TotalsInput {
  items: Pick<SaleItem, 'qty' | 'unitPrice' | 'unitCost'>[];
  /** Descuento en monto (ya convertido si venía en %). */
  discount: number;
  /** Tasa en % (ej. 16). */
  taxRate: number;
  pricesIncludeTax: boolean;
}

/**
 * Cálculo único de totales de ticket. Úsalo en el POS, en el ticket impreso y al guardar la venta.
 * - pricesIncludeTax = true  → el total es lo que paga el cliente; el impuesto se desglosa dentro.
 * - pricesIncludeTax = false → el impuesto se suma sobre el subtotal.
 */
export function computeTotals({ items, discount, taxRate, pricesIncludeTax }: TotalsInput): SaleTotals {
  const gross = items.reduce((acc, i) => acc + i.unitPrice * i.qty, 0);
  const cost = items.reduce((acc, i) => acc + i.unitCost * i.qty, 0);
  const itemCount = items.reduce((acc, i) => acc + i.qty, 0);
  const safeDiscount = Math.min(Math.max(0, discount || 0), gross);
  const afterDiscount = gross - safeDiscount;
  const rate = Math.max(0, taxRate || 0) / 100;

  let subtotal: number;
  let tax: number;
  let total: number;
  if (pricesIncludeTax) {
    total = afterDiscount;
    subtotal = rate ? total / (1 + rate) : total;
    tax = total - subtotal;
  } else {
    subtotal = afterDiscount;
    tax = subtotal * rate;
    total = subtotal + tax;
  }
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
