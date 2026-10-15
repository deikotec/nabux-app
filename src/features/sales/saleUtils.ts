import { PAYMENT_LABELS } from '@/config/app';
import { dayKey } from '@/lib/dates';
import { formatNumber, toDate } from '@/lib/format';
import { downloadFile, normalize, toCsv } from '@/lib/utils';
import type { Sale, SaleItem } from '@/types';

export const SALE_STATUS_LABEL: Record<Sale['status'], string> = {
  completed: 'Completada',
  voided: 'Anulada'
};

/** Cantidad legible (admite decimales para productos a granel). */
export function formatQty(qty: number) {
  return formatNumber(qty, 'es-MX', 3);
}

/** Resumen corto de artículos: "Aceite (x2), Leche (x3) y 2 más". */
export function summarizeItems(items: SaleItem[] | undefined, max = 3): string {
  const list = items ?? [];
  if (!list.length) return 'Sin artículos';
  const parts = list.slice(0, max).map((it) => (it.qty === 1 ? it.name : `${it.name} (x${formatQty(it.qty)})`));
  const rest = list.length - max;
  return rest > 0 ? `${parts.join(', ')} y ${rest} más` : parts.join(', ');
}

const clockFmt = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Hora en formato 24 h ("13:42"), como en el mockup del panel. */
export function formatClock(d: Date) {
  return clockFmt.format(d);
}

/** Fecha de la venta (o "ahora" si el servidor aún no confirma la marca de tiempo). */
export function saleTime(sale: Sale): Date {
  return toDate(sale.createdAt) ?? new Date();
}

/** Búsqueda libre por folio, cliente, cajero o producto (nombre / SKU). */
export function saleMatches(sale: Sale, query: string): boolean {
  const q = normalize(query).replace(/#/g, '');
  if (!q) return true;
  const haystack = normalize(
    [sale.folio, sale.customerName, sale.cashierName, ...(sale.items ?? []).flatMap((i) => [i.name, i.sku])].filter(Boolean).join(' ')
  );
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

export interface SalesStats {
  /** Total cobrado en ventas completadas. */
  total: number;
  /** Tickets completados. */
  count: number;
  /** Ticket promedio. */
  avg: number;
  /** Unidades vendidas. */
  units: number;
  profit: number;
  /** Margen bruto sobre lo vendido (%). */
  marginPct: number;
  voidedTotal: number;
  voidedCount: number;
}

export function salesStats(sales: Sale[]): SalesStats {
  let total = 0;
  let count = 0;
  let units = 0;
  let profit = 0;
  let voidedTotal = 0;
  let voidedCount = 0;
  for (const s of sales) {
    if (s.status === 'voided') {
      voidedTotal += Number(s.total) || 0;
      voidedCount += 1;
      continue;
    }
    total += Number(s.total) || 0;
    units += Number(s.itemCount) || 0;
    profit += Number(s.profit) || 0;
    count += 1;
  }
  return {
    total,
    count,
    avg: count ? total / count : 0,
    units,
    profit,
    marginPct: total > 0 ? (profit / total) * 100 : 0,
    voidedTotal,
    voidedCount
  };
}

const n2 = (v: number | null | undefined) => (Number(v) || 0).toFixed(2);

function stamp(d: Date | null) {
  if (!d) return '';
  return `${dayKey(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** CSV con el detalle de ventas (montos sin símbolo para que la hoja de cálculo los sume). */
export function salesToCsv(sales: Sale[], { includeProfit }: { includeProfit: boolean }): string {
  const header = [
    'Folio',
    'Fecha',
    'Cliente',
    'Cajero',
    'Método de pago',
    'Artículos',
    'Unidades',
    'Subtotal',
    'Impuesto',
    'Descuento',
    'Total',
    ...(includeProfit ? ['Utilidad'] : []),
    'Estado',
    'Motivo de anulación'
  ];
  const rows = sales.map((s) => [
    s.folio,
    stamp(toDate(s.createdAt)),
    s.customerName || '',
    s.cashierName || '',
    PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod,
    (s.items ?? []).map((i) => `${i.name} x${formatQty(i.qty)}`).join('; '),
    Number(s.itemCount) || 0,
    n2(s.subtotal),
    n2(s.tax),
    n2(s.discount),
    n2(s.total),
    ...(includeProfit ? [n2(s.profit)] : []),
    SALE_STATUS_LABEL[s.status] ?? s.status,
    s.voidReason ?? ''
  ]);
  return toCsv([header, ...rows]);
}

export function exportSalesCsv(filename: string, sales: Sale[], includeProfit: boolean) {
  downloadFile(filename, salesToCsv(sales, { includeProfit }));
}
