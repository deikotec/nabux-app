/** Construcción de CSVs del módulo de reportes (funciones puras + descarga). */
import { PAYMENT_KIND_LABELS, RATE_SOURCE_LABELS } from '@/config/app';
import { dayKey, type DateRange } from '@/lib/dates';
import { toDate } from '@/lib/format';
import { salePayments, saleMethodLabel } from '@/lib/payments';
import { downloadFile, round2, toCsv } from '@/lib/utils';
import type { CashSession, FxHistoryEntry, Sale, TS } from '@/types';
import {
  AUDIT_LABEL,
  bucketAvgRate,
  rateGap,
  safePct,
  saleRate,
  saleTotalLocal,
  sessionAuditStatus,
  sessionHasLocal,
  sessionMethodBreakdown,
  shortFolio,
  type CurrencyGroup,
  type PaymentStat,
  type ProductStat,
  type TimeBucket
} from './analytics';

type Cell = string | number | null | undefined;

function stamp(ts: TS | Date): string {
  const d = toDate(ts);
  if (!d) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dayKey(d)} ${hh}:${mm}`;
}

const n2 = (v: number | null | undefined) => (v === null || v === undefined ? '' : round2(Number(v) || 0).toFixed(2));
const n4 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? '' : (Math.round(Number(v) * 10000) / 10000).toFixed(4));
const pct = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '0.0');
const pctOrEmpty = (v: number | null) => (v === null ? '' : pct(v));

export function rangeSlug(range: DateRange) {
  const a = dayKey(range.from);
  const b = dayKey(range.to);
  return a === b ? a : `${a}_a_${b}`;
}

export interface CurrencyCsvOptions {
  /** Modo bimonetario: agrega columnas de tasa, montos en moneda local e IGTF. */
  dual: boolean;
  baseCurrency: string;
  localCurrency: string;
}

/** ¿Hace falta incluir columnas bimonetarias? (modo activo o hay datos en moneda local). */
const needsLocal = (dual: boolean, sales: Sale[]) => dual || sales.some((s) => saleRate(s) !== null || Number(s.igtf) > 0);

export function salesDetailCsv(sales: Sale[], opts: CurrencyCsvOptions): string {
  const local = needsLocal(opts.dual, sales);
  const header: Cell[] = ['Folio', 'Fecha', 'Cajero', 'Cliente', 'Método de pago', 'Detalle de pagos', 'Referencias'];
  if (local) header.push('Monedas');
  header.push('Estado', 'Artículos', 'Venta bruta', 'Descuento', 'Subtotal', 'Impuesto', `Total (${opts.baseCurrency})`);
  if (local)
    header.push(
      `IGTF (${opts.baseCurrency})`,
      `Total cobrado con IGTF (${opts.baseCurrency})`,
      `Tasa (${opts.localCurrency} por ${opts.baseCurrency})`,
      'Fuente de la tasa',
      `Total (${opts.localCurrency})`,
      `IGTF (${opts.localCurrency})`,
      'Vuelto',
      'Moneda del vuelto'
    );
  header.push('Costo', 'Utilidad', 'Margen %', 'Motivo de anulación');
  const rows: Cell[][] = [header];

  const sorted = [...sales].sort((a, b) => (toDate(a.createdAt)?.getTime() ?? 0) - (toDate(b.createdAt)?.getTime() ?? 0));
  for (const s of sorted) {
    const payments = salePayments(s);
    const detail = payments
      .map((p) => `${p.label}: ${n2(p.amount)} ${p.currency || opts.baseCurrency}${Number(p.igtf) > 0 ? ` (IGTF ${n2(p.igtf)} ${opts.baseCurrency})` : ''}`)
      .join(' | ');
    const references = payments
      .filter((p) => p.reference)
      .map((p) => `${p.label}: ${p.reference}`)
      .join(' | ');
    const row: Cell[] = [s.folio, stamp(s.createdAt), s.cashierName, s.customerName ?? '', saleMethodLabel(s), detail, references];
    if (local) row.push(Array.from(new Set(payments.map((p) => p.currency || opts.baseCurrency))).join(' + '));
    row.push(s.status === 'voided' ? 'Anulada' : 'Completada', s.itemCount, n2(s.gross), n2(s.discount), n2(s.subtotal), n2(s.tax), n2(s.total));
    if (local) {
      const rate = saleRate(s);
      const igtf = Number(s.igtf) || 0;
      row.push(
        n2(igtf),
        n2(s.amountDue ?? s.total + igtf),
        n4(rate),
        s.rateSource ? RATE_SOURCE_LABELS[s.rateSource] : '',
        n2(saleTotalLocal(s)),
        rate ? n2(igtf * rate) : '',
        Number(s.changeAmount) > 0 ? n2(s.changeAmount) : Number(s.change) > 0 ? n2(s.change) : '',
        Number(s.changeAmount) > 0 ? (s.changeCurrency ?? '') : Number(s.change) > 0 ? opts.baseCurrency : ''
      );
    }
    row.push(n2(s.cost), n2(s.profit), pct(safePct(s.profit, s.subtotal)), s.voidReason ?? '');
    rows.push(row);
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

/** Resumen por forma de pago y por moneda (montos en la moneda del método y sus equivalentes). */
export function paymentMethodsCsv(stats: PaymentStat[], groups: CurrencyGroup[], opts: CurrencyCsvOptions): string {
  const local = opts.dual || stats.some((s) => s.side === 'local');
  const header: Cell[] = ['Forma de pago', 'Moneda', 'Tipo', 'Pagos', 'Tickets', 'Recibido (moneda del método)', 'Vuelto entregado', 'Neto (moneda del método)'];
  header.push(`Equivalente (${opts.baseCurrency})`);
  if (local) header.push(`Equivalente (${opts.localCurrency})`);
  header.push(`Cubre ventas (${opts.baseCurrency})`, '% de las ventas');
  if (local) header.push(`IGTF (${opts.baseCurrency})`, 'Pagos sin tasa');
  const rows: Cell[][] = [header];

  const line = (r: {
    label: string;
    currency: string;
    kind: string;
    count: number;
    tickets: Cell;
    received: Cell;
    changeOut: Cell;
    amount: Cell;
    equivBase: number;
    equivLocal: number;
    amountBase: number;
    share: number;
    igtf: number;
    unconverted: number;
  }) => {
    const row: Cell[] = [r.label, r.currency, r.kind, r.count, r.tickets, r.received, r.changeOut, r.amount, n2(r.equivBase)];
    if (local) row.push(n2(r.equivLocal));
    row.push(n2(r.amountBase), pct(r.share));
    if (local) row.push(n2(r.igtf), r.unconverted || '');
    rows.push(row);
  };

  for (const s of stats) {
    line({
      label: s.label,
      currency: s.currency,
      kind: PAYMENT_KIND_LABELS[s.kind] ?? s.kind,
      count: s.count,
      tickets: s.tickets,
      received: n2(s.received),
      changeOut: n2(s.changeOut),
      amount: n2(s.amount),
      equivBase: s.equivBase,
      equivLocal: s.equivLocal,
      amountBase: s.amountBase,
      share: s.share,
      igtf: s.igtf,
      unconverted: s.unconverted
    });
  }
  if (local) {
    rows.push([]);
    for (const g of groups) {
      line({
        label: g.side === 'base' ? `Total en divisas (${g.currency})` : `Total en moneda local (${g.currency})`,
        currency: g.currency,
        kind: '',
        count: g.count,
        tickets: '',
        received: '',
        changeOut: n2(g.changeOut),
        amount: n2(g.amount),
        equivBase: g.equivBase,
        equivLocal: g.equivLocal,
        amountBase: g.amountBase,
        share: g.share,
        igtf: g.igtf,
        unconverted: g.unconverted
      });
    }
  }
  return toCsv(rows);
}

/** Historial de tasas del período (cada actualización registrada). */
export function fxHistoryCsv(entries: FxHistoryEntry[], baseline: FxHistoryEntry | null, opts: { localCurrency: string; baseCurrency: string }): string {
  const unit = `${opts.localCurrency} por ${opts.baseCurrency}`;
  const rows: Cell[][] = [['Fecha y hora', `BCV (${unit})`, `Paralelo (${unit})`, `Propia (${unit})`, 'Brecha paralelo vs BCV %', 'Fecha de vigencia BCV', 'Origen', 'Registró', 'Nota']];
  const push = (e: FxHistoryEntry, note: string) =>
    rows.push([
      stamp(e.createdAt),
      n4(e.bcv),
      n4(e.parallel),
      n4(e.custom),
      pctOrEmpty(rateGap(e.bcv, e.parallel)),
      e.bcvDate ?? '',
      e.source === 'auto' ? 'Automática' : 'Manual',
      e.userName ?? '',
      note
    ]);
  if (baseline) push(baseline, 'Vigente al iniciar el período');
  const sorted = [...entries].sort((a, b) => (toDate(a.createdAt)?.getTime() ?? 0) - (toDate(b.createdAt)?.getTime() ?? 0));
  for (const e of sorted) push(e, '');
  return toCsv(rows);
}

export function cashSessionsCsv(sessions: CashSession[], opts: CurrencyCsvOptions): string {
  const local = opts.dual || sessions.some(sessionHasLocal);
  const L = opts.localCurrency;
  const header: Cell[] = ['Folio', 'Apertura', 'Cierre', 'Cajero', 'Cerró', 'Fondo inicial', 'Efectivo', 'Tarjeta', 'Transferencia', 'Venta registrada', 'Tickets'];
  header.push('Efectivo esperado', 'Efectivo declarado', 'Diferencia');
  if (local) header.push(`Fondo inicial (${L})`, `Efectivo esperado (${L})`, `Efectivo declarado (${L})`, `Diferencia (${L})`, 'IGTF');
  header.push('Estado', 'Desglose por forma de pago', 'Notas');
  const rows: Cell[][] = [header];
  for (const s of sessions) {
    const breakdown = sessionMethodBreakdown(s, opts.baseCurrency)
      .map((m) => `${m.label}: ${n2(m.amount)} ${m.currency}${m.count ? ` (${m.count})` : ''}`)
      .join(' | ');
    const row: Cell[] = [
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
      n2(s.difference)
    ];
    if (local) row.push(n2(s.openingFloatLocal), n2(s.expectedCashLocal), n2(s.declaredCashLocal), n2(s.differenceLocal), n2(s.totals?.igtf));
    row.push(AUDIT_LABEL[sessionAuditStatus(s)], breakdown, s.notes ?? '');
    rows.push(row);
  }
  return toCsv(rows);
}

export function dailySummaryCsv(days: TimeBucket[], dailyGoal: number | null, opts: CurrencyCsvOptions): string {
  const header: Cell[] = ['Fecha', 'Tickets', 'Ingresos', 'Utilidad', 'Margen %', 'Ticket promedio', 'Anulaciones', 'Monto anulado'];
  if (opts.dual) header.push(`Ingresos (${opts.localCurrency})`, `Utilidad (${opts.localCurrency})`, 'Tasa promedio', 'Ventas sin tasa');
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
    if (opts.dual) row.push(n2(d.revenueLocal), n2(d.profitLocal), n4(bucketAvgRate(d)), d.localMissing || '');
    if (dailyGoal) row.push(n2(dailyGoal), pct(safePct(d.revenue, dailyGoal)));
    rows.push(row);
  }
  return toCsv(rows);
}

export function downloadCsv(name: string, csv: string) {
  downloadFile(`${name}.csv`, csv);
}
