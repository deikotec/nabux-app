/** Construcción de CSVs del módulo de reportes (funciones puras + descarga). */
import { PAYMENT_LABELS } from '@/config/app';
import { dayKey, type DateRange } from '@/lib/dates';
import { toDate } from '@/lib/format';
import { downloadFile, round2, toCsv } from '@/lib/utils';
import type { CashSession, Sale, TS } from '@/types';
import { AUDIT_LABEL, auditStatus, safePct, shortFolio, type ProductStat, type TimeBucket } from './analytics';

type Cell = string | number | null | undefined;

function stamp(ts: TS): string {
  const d = toDate(ts);
  if (!d) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dayKey(d)} ${hh}:${mm}`;
}

const n2 = (v: number | null | undefined) => (v === null || v === undefined ? '' : round2(Number(v) || 0).toFixed(2));
const pct = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '0.0');

export function rangeSlug(range: DateRange) {
  const a = dayKey(range.from);
  const b = dayKey(range.to);
  return a === b ? a : `${a}_a_${b}`;
}

export function salesDetailCsv(sales: Sale[]): string {
  const rows: Cell[][] = [
    ['Folio', 'Fecha', 'Cajero', 'Cliente', 'Método de pago', 'Estado', 'Artículos', 'Venta bruta', 'Descuento', 'Subtotal', 'Impuesto', 'Total', 'Costo', 'Utilidad', 'Margen %', 'Motivo de anulación']
  ];
  const sorted = [...sales].sort((a, b) => (toDate(a.createdAt)?.getTime() ?? 0) - (toDate(b.createdAt)?.getTime() ?? 0));
  for (const s of sorted) {
    rows.push([
      s.folio,
      stamp(s.createdAt),
      s.cashierName,
      s.customerName ?? '',
      PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod,
      s.status === 'voided' ? 'Anulada' : 'Completada',
      s.itemCount,
      n2(s.gross),
      n2(s.discount),
      n2(s.subtotal),
      n2(s.tax),
      n2(s.total),
      n2(s.cost),
      n2(s.profit),
      pct(safePct(s.profit, s.subtotal)),
      s.voidReason ?? ''
    ]);
  }
  return toCsv(rows);
}

export function productPerformanceCsv(stats: ProductStat[]): string {
  const rows: Cell[][] = [['Producto', 'SKU', 'Categoría', 'Unidades', 'Tickets', 'Ingresos', 'Venta neta', 'Costo', 'Utilidad', 'Margen %']];
  for (const p of stats) {
    rows.push([p.name, p.sku, p.category, p.units, p.tickets, n2(p.revenue), n2(p.net), n2(p.cost), n2(p.profit), pct(p.marginPct)]);
  }
  return toCsv(rows);
}

export function cashSessionsCsv(sessions: CashSession[]): string {
  const rows: Cell[][] = [
    ['Folio', 'Apertura', 'Cierre', 'Cajero', 'Cerró', 'Fondo inicial', 'Efectivo', 'Tarjeta', 'Transferencia', 'Venta registrada', 'Tickets', 'Efectivo esperado', 'Efectivo declarado', 'Diferencia', 'Estado', 'Notas']
  ];
  for (const s of sessions) {
    rows.push([
      shortFolio(s.id),
      stamp(s.openedAt),
      stamp(s.closedAt),
      s.openedByName,
      s.closedByName ?? '',
      n2(s.openingFloat),
      n2(s.totals?.cash),
      n2(s.totals?.card),
      n2(s.totals?.transfer),
      n2(s.totals?.total),
      s.totals?.count ?? '',
      n2(s.expectedCash),
      n2(s.declaredCash),
      n2(s.difference),
      AUDIT_LABEL[auditStatus(s.difference)],
      s.notes ?? ''
    ]);
  }
  return toCsv(rows);
}

export function dailySummaryCsv(days: TimeBucket[], dailyGoal: number | null): string {
  const header: Cell[] = ['Fecha', 'Tickets', 'Ingresos', 'Utilidad', 'Margen %', 'Ticket promedio', 'Anulaciones', 'Monto anulado'];
  if (dailyGoal) header.push('Meta', '% de meta');
  const rows: Cell[][] = [header];
  for (const d of days) {
    const row: Cell[] = [
      d.key,
      d.count,
      n2(d.revenue),
      n2(d.profit),
      pct(safePct(d.profit, d.subtotal)),
      n2(d.count ? d.revenue / d.count : 0),
      d.voidedCount,
      n2(d.voidedAmount)
    ];
    if (dailyGoal) row.push(n2(dailyGoal), pct(safePct(d.revenue, dailyGoal)));
    rows.push(row);
  }
  return toCsv(rows);
}

export function downloadCsv(name: string, csv: string) {
  downloadFile(`${name}.csv`, csv);
}
