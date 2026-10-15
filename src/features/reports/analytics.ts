/**
 * Agregaciones puras para Reportes & Analíticas.
 * Nada de React ni Firestore aquí: reciben arreglos ya cargados y devuelven estructuras listas para pintar.
 */
import { PAYMENT_LABELS } from '@/config/app';
import { addDays, dayKey, eachDay, startOfDay, startOfWeek, WEEKDAY_SHORT, type DateRange, type RangePreset } from '@/lib/dates';
import { toDate } from '@/lib/format';
import { round2, stockStatus } from '@/lib/utils';
import type { CashSession, PaymentMethod, Product, Sale, SaleItem, StockMovement } from '@/types';

/* ------------------------------------------------------------------ */
/* Utilidades generales                                                */
/* ------------------------------------------------------------------ */

export const isCompleted = (s: Pick<Sale, 'status'>) => s.status === 'completed';
export const isVoided = (s: Pick<Sale, 'status'>) => s.status === 'voided';

const num = (v: unknown) => Number(v) || 0;

/** Variación porcentual; null si no hay base de comparación. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function safePct(part: number, whole: number): number {
  return whole ? (part / whole) * 100 : 0;
}

/** Número de días calendario que abarca un rango (inclusive). */
export function rangeDayCount(range: DateRange): number {
  return eachDay(range.from, range.to).length;
}

/** Texto corto de un rango: "1 – 15 oct" o "28 sep – 15 oct". */
export function formatRangeLabel(range: DateRange): string {
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-MX', opts).format(d);
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  if (dayKey(range.from) === dayKey(range.to)) return fmt(range.from, { weekday: 'long', day: 'numeric', month: 'short' });
  const sameMonth = sameYear && range.from.getMonth() === range.to.getMonth();
  const from = fmt(range.from, sameMonth ? { day: 'numeric' } : sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  const to = fmt(range.to, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  return `${from} – ${to}`;
}

/** Etiqueta para la comparación contra el período anterior. */
export function compareLabel(preset: RangePreset): string {
  switch (preset) {
    case 'today':
      return 'vs ayer';
    case '7d':
      return 'vs 7 días previos';
    case '30d':
      return 'vs 30 días previos';
    case 'month':
      return 'vs lapso anterior';
    default:
      return 'vs período anterior';
  }
}

/* ------------------------------------------------------------------ */
/* Resumen general                                                     */
/* ------------------------------------------------------------------ */

export interface SalesSummary {
  /** Ingresos cobrados (total con impuestos) de ventas completadas. */
  revenue: number;
  /** Venta neta (sin impuestos) — base del margen. */
  subtotal: number;
  cost: number;
  profit: number;
  tax: number;
  discount: number;
  /** Tickets completados. */
  count: number;
  units: number;
  avgTicket: number;
  /** Ticket completado más alto del período. */
  maxTicket: number;
  /** Artículos promedio por ticket. */
  itemsPerTicket: number;
  /** profit / subtotal en %. */
  marginPct: number;
  voidedCount: number;
  voidedAmount: number;
}

export function summarizeSales(sales: Sale[]): SalesSummary {
  const s: SalesSummary = {
    revenue: 0,
    subtotal: 0,
    cost: 0,
    profit: 0,
    tax: 0,
    discount: 0,
    count: 0,
    units: 0,
    avgTicket: 0,
    maxTicket: 0,
    itemsPerTicket: 0,
    marginPct: 0,
    voidedCount: 0,
    voidedAmount: 0
  };
  for (const sale of sales) {
    if (isVoided(sale)) {
      s.voidedCount += 1;
      s.voidedAmount += num(sale.total);
      continue;
    }
    if (!isCompleted(sale)) continue;
    s.revenue += num(sale.total);
    s.subtotal += num(sale.subtotal);
    s.cost += num(sale.cost);
    s.profit += num(sale.profit);
    s.tax += num(sale.tax);
    s.discount += num(sale.discount);
    s.units += num(sale.itemCount);
    s.maxTicket = Math.max(s.maxTicket, num(sale.total));
    s.count += 1;
  }
  s.avgTicket = s.count ? s.revenue / s.count : 0;
  s.itemsPerTicket = s.count ? s.units / s.count : 0;
  s.marginPct = safePct(s.profit, s.subtotal);
  for (const k of ['revenue', 'subtotal', 'cost', 'profit', 'tax', 'discount', 'avgTicket', 'maxTicket', 'itemsPerTicket', 'voidedAmount'] as const) s[k] = round2(s[k]);
  return s;
}

/* ------------------------------------------------------------------ */
/* Series de tiempo (día / hora / semana)                              */
/* ------------------------------------------------------------------ */

export type Granularity = 'hour' | 'day' | 'week';

/** Hoy (o un rango de un solo día) → por hora; rangos largos → por semana; resto → por día. */
export function pickGranularity(preset: RangePreset, range: DateRange): Granularity {
  if (preset === 'today' || dayKey(range.from) === dayKey(range.to)) return 'hour';
  if (rangeDayCount(range) > 62) return 'week';
  return 'day';
}

export interface TimeBucket {
  key: string;
  label: string;
  /** Texto largo para tooltips ("jue 24 oct", "14:00 – 15:00"). */
  longLabel: string;
  start: Date;
  /** Días calendario que cubre el bucket dentro del rango (para escalar la meta). */
  days: number;
  revenue: number;
  subtotal: number;
  profit: number;
  count: number;
  voidedCount: number;
  voidedAmount: number;
  isCurrent: boolean;
}

function emptyBucket(key: string, label: string, longLabel: string, start: Date, days: number, isCurrent: boolean): TimeBucket {
  return { key, label, longLabel, start, days, revenue: 0, subtotal: 0, profit: 0, count: 0, voidedCount: 0, voidedAmount: 0, isCurrent };
}

function addSaleToBucket(b: TimeBucket, sale: Sale) {
  if (isVoided(sale)) {
    b.voidedCount += 1;
    b.voidedAmount += num(sale.total);
  } else if (isCompleted(sale)) {
    b.count += 1;
    b.revenue += num(sale.total);
    b.subtotal += num(sale.subtotal);
    b.profit += num(sale.profit);
  }
}

function finalize(buckets: TimeBucket[]): TimeBucket[] {
  return buckets.map((b) => ({
    ...b,
    revenue: round2(b.revenue),
    subtotal: round2(b.subtotal),
    profit: round2(b.profit),
    voidedAmount: round2(b.voidedAmount)
  }));
}

const fmtDayShort = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
const fmtDayLong = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
const hh = (h: number) => `${String(h).padStart(2, '0')}h`;

/** Ventas agrupadas por día calendario del rango (incluye días sin ventas). */
export function groupByDay(sales: Sale[], range: DateRange, now = new Date()): TimeBucket[] {
  const today = dayKey(now);
  const buckets = eachDay(range.from, range.to).map((d) => {
    const key = dayKey(d);
    return emptyBucket(key, key === today ? 'Hoy' : fmtDayShort.format(d), fmtDayLong.format(d), d, 1, key === today);
  });
  const index = new Map(buckets.map((b) => [b.key, b]));
  for (const sale of sales) {
    const d = toDate(sale.createdAt);
    if (!d) continue;
    const b = index.get(dayKey(d));
    if (b) addSaleToBucket(b, sale);
  }
  return finalize(buckets);
}

/**
 * Ventas por hora de un día. Muestra al menos de minHour a maxHour y se amplía
 * si hubo ventas fuera de ese horario.
 */
export function groupByHour(sales: Sale[], day: Date, now = new Date(), minHour = 8, maxHour = 21): TimeBucket[] {
  const isToday = dayKey(day) === dayKey(now);
  let from = minHour;
  let to = Math.max(maxHour, isToday ? now.getHours() : 0);
  for (const sale of sales) {
    const d = toDate(sale.createdAt);
    if (!d) continue;
    from = Math.min(from, d.getHours());
    to = Math.max(to, d.getHours());
  }
  const base = startOfDay(day);
  const buckets: TimeBucket[] = [];
  for (let h = from; h <= to; h++) {
    const start = new Date(base);
    start.setHours(h);
    buckets.push(emptyBucket(String(h), hh(h), `${String(h).padStart(2, '0')}:00 – ${String(h + 1).padStart(2, '0')}:00`, start, 1, isToday && now.getHours() === h));
  }
  const index = new Map(buckets.map((b) => [b.key, b]));
  for (const sale of sales) {
    const d = toDate(sale.createdAt);
    if (!d || dayKey(d) !== dayKey(day)) continue;
    const b = index.get(String(d.getHours()));
    if (b) addSaleToBucket(b, sale);
  }
  return finalize(buckets);
}

/** Ventas por semana (lunes a domingo) recortadas al rango. */
export function groupByWeek(sales: Sale[], range: DateRange, now = new Date()): TimeBucket[] {
  const buckets: TimeBucket[] = [];
  const nowKey = dayKey(startOfWeek(now));
  let cur = startOfWeek(range.from);
  const endDay = startOfDay(range.to);
  while (cur <= endDay) {
    const weekEnd = addDays(cur, 6);
    const clipFrom = cur < range.from ? startOfDay(range.from) : cur;
    const clipTo = weekEnd > endDay ? endDay : weekEnd;
    const days = eachDay(clipFrom, clipTo).length;
    const key = dayKey(cur);
    buckets.push(
      emptyBucket(key, `Sem ${fmtDayShort.format(clipFrom)}`, `${fmtDayShort.format(clipFrom)} – ${fmtDayShort.format(clipTo)}`, clipFrom, days, key === nowKey)
    );
    cur = addDays(cur, 7);
  }
  const index = new Map(buckets.map((b) => [b.key, b]));
  for (const sale of sales) {
    const d = toDate(sale.createdAt);
    if (!d) continue;
    const b = index.get(dayKey(startOfWeek(d)));
    if (b) addSaleToBucket(b, sale);
  }
  return finalize(buckets);
}

export function buildTimeSeries(sales: Sale[], range: DateRange, granularity: Granularity, now = new Date()): TimeBucket[] {
  if (granularity === 'hour') return groupByHour(sales, range.from, now);
  if (granularity === 'week') return groupByWeek(sales, range, now);
  return groupByDay(sales, range, now);
}

/* ------------------------------------------------------------------ */
/* Productos                                                           */
/* ------------------------------------------------------------------ */

export interface ProductStat {
  key: string;
  productId: string | null;
  name: string;
  sku: string;
  category: string;
  units: number;
  /** Ingresos asignados (total cobrado prorrateando descuento e impuestos). */
  revenue: number;
  /** Venta neta sin impuestos (base del margen). */
  net: number;
  cost: number;
  profit: number;
  marginPct: number;
  tickets: number;
}

export type ProductSort = 'revenue' | 'units' | 'profit';

/**
 * Prorratea cada línea del ticket: los ingresos suman exactamente al total cobrado
 * y la utilidad es consistente con la utilidad del ticket (venta neta − costo).
 */
function lineShares(sale: Sale, item: SaleItem) {
  const gross = num(sale.gross);
  const line = num(item.total) || num(item.unitPrice) * num(item.qty);
  const revenue = gross ? (line * num(sale.total)) / gross : 0;
  const net = gross ? (line * num(sale.subtotal)) / gross : 0;
  const cost = num(item.unitCost) * num(item.qty);
  return { revenue, net, cost };
}

export function productPerformance(sales: Sale[], productsById?: Map<string, Product>): ProductStat[] {
  const map = new Map<string, ProductStat & { saleIds: Set<string> }>();
  for (const sale of sales) {
    if (!isCompleted(sale)) continue;
    for (const item of sale.items ?? []) {
      const key = item.productId ?? `free:${item.name}`;
      const product = item.productId ? productsById?.get(item.productId) : undefined;
      let stat = map.get(key);
      if (!stat) {
        stat = {
          key,
          productId: item.productId,
          name: product?.name ?? item.name,
          sku: product?.sku ?? item.sku ?? '',
          category: item.category || product?.category || '',
          units: 0,
          revenue: 0,
          net: 0,
          cost: 0,
          profit: 0,
          marginPct: 0,
          tickets: 0,
          saleIds: new Set()
        };
        map.set(key, stat);
      }
      const { revenue, net, cost } = lineShares(sale, item);
      stat.units += num(item.qty);
      stat.revenue += revenue;
      stat.net += net;
      stat.cost += cost;
      stat.saleIds.add(sale.id);
    }
  }
  return Array.from(map.values())
    .map(({ saleIds, ...s }) => ({
      ...s,
      units: round2(s.units),
      revenue: round2(s.revenue),
      net: round2(s.net),
      cost: round2(s.cost),
      profit: round2(s.net - s.cost),
      marginPct: safePct(s.net - s.cost, s.net),
      tickets: saleIds.size
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function topProducts(stats: ProductStat[], sort: ProductSort, n = 5): ProductStat[] {
  return [...stats].sort((a, b) => b[sort] - a[sort] || b.revenue - a.revenue).slice(0, n);
}

/** Ids de productos con al menos una venta completada. */
export function soldProductIds(sales: Sale[]): Set<string> {
  const set = new Set<string>();
  for (const sale of sales) {
    if (!isCompleted(sale)) continue;
    for (const item of sale.items ?? []) if (item.productId) set.add(item.productId);
  }
  return set;
}

/* ------------------------------------------------------------------ */
/* Categorías                                                          */
/* ------------------------------------------------------------------ */

export const NO_CATEGORY = 'Sin categoría';

export interface CategoryStat {
  category: string;
  revenue: number;
  profit: number;
  units: number;
  share: number;
  marginPct: number;
}

interface CategoryAcc {
  category: string;
  revenue: number;
  net: number;
  cost: number;
  units: number;
}

/** Ventas por categoría (las de menor venta se agrupan en "Otras" si pasan de `limit`). */
export function salesByCategory(stats: ProductStat[], limit = 7): CategoryStat[] {
  const map = new Map<string, CategoryAcc>();
  for (const p of stats) {
    const category = p.category?.trim() || NO_CATEGORY;
    const c = map.get(category) ?? { category, revenue: 0, net: 0, cost: 0, units: 0 };
    c.revenue += p.revenue;
    c.net += p.net;
    c.cost += p.cost;
    c.units += p.units;
    map.set(category, c);
  }
  let groups = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  if (groups.length > limit) {
    const rest = groups.slice(limit - 1);
    const other = rest.reduce<CategoryAcc>(
      (acc, c) => ({ ...acc, revenue: acc.revenue + c.revenue, net: acc.net + c.net, cost: acc.cost + c.cost, units: acc.units + c.units }),
      { category: `Otras (${rest.length})`, revenue: 0, net: 0, cost: 0, units: 0 }
    );
    groups = [...groups.slice(0, limit - 1), other];
  }
  const total = groups.reduce((a, c) => a + c.revenue, 0);
  return groups.map((c) => ({
    category: c.category,
    revenue: round2(c.revenue),
    profit: round2(c.net - c.cost),
    units: round2(c.units),
    share: safePct(c.revenue, total),
    marginPct: safePct(c.net - c.cost, c.net)
  }));
}

/* ------------------------------------------------------------------ */
/* Métodos de pago                                                     */
/* ------------------------------------------------------------------ */

export interface PaymentStat {
  method: PaymentMethod;
  label: string;
  amount: number;
  count: number;
  share: number;
}

const METHOD_ORDER: PaymentMethod[] = ['cash', 'card', 'transfer'];

export function salesByPaymentMethod(sales: Sale[]): PaymentStat[] {
  const acc = new Map<PaymentMethod, { amount: number; count: number }>(METHOD_ORDER.map((m) => [m, { amount: 0, count: 0 }]));
  let total = 0;
  for (const sale of sales) {
    if (!isCompleted(sale)) continue;
    const m = acc.get(sale.paymentMethod) ?? { amount: 0, count: 0 };
    m.amount += num(sale.total);
    m.count += 1;
    acc.set(sale.paymentMethod, m);
    total += num(sale.total);
  }
  return Array.from(acc.entries()).map(([method, v]) => ({
    method,
    label: PAYMENT_LABELS[method] ?? method,
    amount: round2(v.amount),
    count: v.count,
    share: safePct(v.amount, total)
  }));
}

/* ------------------------------------------------------------------ */
/* Cajeros                                                             */
/* ------------------------------------------------------------------ */

export interface CashierStat {
  cashierId: string;
  name: string;
  tickets: number;
  revenue: number;
  profit: number;
  avgTicket: number;
  voidedCount: number;
  voidedAmount: number;
  share: number;
}

export function salesByCashier(sales: Sale[]): CashierStat[] {
  const map = new Map<string, Omit<CashierStat, 'avgTicket' | 'share'>>();
  let total = 0;
  for (const sale of sales) {
    const id = sale.cashierId || sale.cashierName || '—';
    const c = map.get(id) ?? { cashierId: id, name: sale.cashierName || 'Sin nombre', tickets: 0, revenue: 0, profit: 0, voidedCount: 0, voidedAmount: 0 };
    if (isVoided(sale)) {
      c.voidedCount += 1;
      c.voidedAmount += num(sale.total);
    } else if (isCompleted(sale)) {
      c.tickets += 1;
      c.revenue += num(sale.total);
      c.profit += num(sale.profit);
      total += num(sale.total);
    }
    map.set(id, c);
  }
  return Array.from(map.values())
    .map((c) => ({
      ...c,
      revenue: round2(c.revenue),
      profit: round2(c.profit),
      voidedAmount: round2(c.voidedAmount),
      avgTicket: c.tickets ? round2(c.revenue / c.tickets) : 0,
      share: safePct(c.revenue, total)
    }))
    .sort((a, b) => b.revenue - a.revenue || b.tickets - a.tickets);
}

/* ------------------------------------------------------------------ */
/* Mapa de calor semanal                                               */
/* ------------------------------------------------------------------ */

/** Lunes primero. Índices de Date.getDay() en ese orden. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export interface HeatmapData {
  rows: string[];
  cols: string[];
  /** Etiquetas largas de cada franja ("08:00 – 10:00"). */
  slotLabels: string[];
  values: number[][];
  max: number;
  total: number;
  peak: { day: string; slot: string; count: number } | null;
  /** Tickets por día de la semana (mismo orden que rows). */
  dayTotals: number[];
  /** Tickets por franja (mismo orden que cols). */
  slotTotals: number[];
  busiestDay: { label: string; count: number } | null;
  busiestSlot: { label: string; count: number } | null;
  quietestSlot: { label: string; count: number } | null;
}

function extreme(labels: string[], totals: number[], pickMax: boolean) {
  let best: { label: string; count: number } | null = null;
  totals.forEach((count, i) => {
    if (!best || (pickMax ? count > best.count : count < best.count)) best = { label: labels[i], count };
  });
  return best as { label: string; count: number } | null;
}

/** Tickets por día de la semana × franjas de `step` horas (por defecto 08h–22h, se amplía si hubo ventas fuera). */
export function weeklyHeatmap(sales: Sale[], opts: { startHour?: number; endHour?: number; step?: number } = {}): HeatmapData {
  const step = opts.step ?? 2;
  const points: { dow: number; hour: number }[] = [];
  let minHour = 24;
  let maxHour = 0;
  for (const sale of sales) {
    if (!isCompleted(sale)) continue;
    const d = toDate(sale.createdAt);
    if (!d) continue;
    points.push({ dow: d.getDay(), hour: d.getHours() });
    minHour = Math.min(minHour, d.getHours());
    maxHour = Math.max(maxHour, d.getHours());
  }
  const start = Math.min(opts.startHour ?? 8, Math.floor(minHour / step) * step);
  const end = Math.max(opts.endHour ?? 22, Math.floor(maxHour / step) * step + step);
  const slots: number[] = [];
  for (let h = start; h < end; h += step) slots.push(h);

  const values = WEEK_ORDER.map(() => slots.map(() => 0));
  for (const p of points) {
    const row = WEEK_ORDER.indexOf(p.dow);
    const col = Math.floor((p.hour - start) / step);
    if (row >= 0 && col >= 0 && col < slots.length) values[row][col] += 1;
  }

  let peak: HeatmapData['peak'] = null;
  values.forEach((r, ri) =>
    r.forEach((v, ci) => {
      if (v > 0 && (!peak || v > peak.count)) peak = { day: WEEKDAY_SHORT[WEEK_ORDER[ri]], slot: `${hh(slots[ci])}–${hh(slots[ci] + step)}`, count: v };
    })
  );

  const dayTotals = values.map((r) => r.reduce((a, v) => a + v, 0));
  const slotTotals = slots.map((_, ci) => values.reduce((a, r) => a + r[ci], 0));
  const dayNames = WEEK_ORDER.map((d) => WEEKDAY_FULL[d]);
  const slotNames = slots.map((h) => `${hh(h)}–${hh(h + step)}`);
  const hasData = points.length > 0;

  return {
    rows: WEEK_ORDER.map((d) => WEEKDAY_SHORT[d]),
    cols: slots.map(hh),
    slotLabels: slots.map((h) => `${String(h).padStart(2, '0')}:00 – ${String(Math.min(24, h + step)).padStart(2, '0')}:00`),
    values,
    max: Math.max(0, ...values.flat()),
    total: points.length,
    peak,
    dayTotals,
    slotTotals,
    busiestDay: hasData ? extreme(dayNames, dayTotals, true) : null,
    busiestSlot: hasData ? extreme(slotNames, slotTotals, true) : null,
    quietestSlot: hasData ? extreme(slotNames, slotTotals, false) : null
  };
}

/* ------------------------------------------------------------------ */
/* Mermas (salidas de inventario)                                      */
/* ------------------------------------------------------------------ */

export interface ShrinkLine {
  productId: string;
  name: string;
  units: number;
  amount: number;
}

export interface ShrinkSummary {
  amount: number;
  units: number;
  count: number;
  lines: ShrinkLine[];
}

/** Valoriza las salidas tipo "out" al costo registrado en el movimiento o, si falta, al costo actual del producto. */
export function shrinkFromMovements(movements: StockMovement[], productsById: Map<string, Product>): ShrinkSummary {
  const map = new Map<string, ShrinkLine>();
  let amount = 0;
  let units = 0;
  let count = 0;
  for (const m of movements) {
    if (m.type !== 'out') continue;
    const qty = Math.abs(num(m.qty));
    const product = productsById.get(m.productId);
    const unitCost = m.unitCost != null && num(m.unitCost) > 0 ? num(m.unitCost) : num(product?.costPrice);
    const value = qty * unitCost;
    amount += value;
    units += qty;
    count += 1;
    const line = map.get(m.productId) ?? { productId: m.productId, name: product?.name ?? m.productName, units: 0, amount: 0 };
    line.units += qty;
    line.amount += value;
    map.set(m.productId, line);
  }
  return {
    amount: round2(amount),
    units: round2(units),
    count,
    lines: Array.from(map.values())
      .map((l) => ({ ...l, amount: round2(l.amount), units: round2(l.units) }))
      .sort((a, b) => b.amount - a.amount)
  };
}

export type LossLevel = 'none' | 'low' | 'watch' | 'high';

/** Clasifica las pérdidas (anulaciones + mermas) según su peso sobre los ingresos. */
export function lossLevel(loss: number, revenue: number): { pct: number; level: LossLevel } {
  if (loss <= 0) return { pct: 0, level: 'none' };
  if (revenue <= 0) return { pct: 100, level: 'high' };
  const pct = (loss / revenue) * 100;
  return { pct, level: pct < 1 ? 'low' : pct < 3 ? 'watch' : 'high' };
}

/* ------------------------------------------------------------------ */
/* Cortes de caja (Z)                                                  */
/* ------------------------------------------------------------------ */

export type AuditStatus = 'balanced' | 'short' | 'over';

export function auditStatus(difference: number | null | undefined): AuditStatus {
  const d = round2(num(difference));
  if (Math.abs(d) < 0.01) return 'balanced';
  return d < 0 ? 'short' : 'over';
}

export const AUDIT_LABEL: Record<AuditStatus, string> = {
  balanced: 'Cuadrada',
  short: 'Faltante',
  over: 'Sobrante'
};

/** Folio corto legible para un corte: Z-AB12CD. */
export function shortFolio(id: string): string {
  return `Z-${id.slice(0, 6).toUpperCase()}`;
}

export interface CashierOption {
  value: string;
  label: string;
}

export function sessionCashiers(sessions: CashSession[]): CashierOption[] {
  const map = new Map<string, string>();
  for (const s of sessions) if (s.openedBy && !map.has(s.openedBy)) map.set(s.openedBy, s.openedByName || 'Sin nombre');
  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

/* ------------------------------------------------------------------ */
/* Salud del inventario                                                */
/* ------------------------------------------------------------------ */

export interface IdleProduct {
  product: Product;
  /** Valor inmovilizado a costo (stock × costo). */
  value: number;
}

export interface InventoryHealth {
  costValue: number;
  retailValue: number;
  potentialProfit: number;
  potentialMarginPct: number;
  activeCount: number;
  unitsInStock: number;
  outCount: number;
  lowCount: number;
  idle: IdleProduct[];
  idleCount: number;
  idleValue: number;
  /** % del valor a costo que no rotó en el período. */
  idleShare: number;
}

export function inventoryHealth(products: Product[], soldIds: Set<string>, limit = 8): InventoryHealth {
  let costValue = 0;
  let retailValue = 0;
  let unitsInStock = 0;
  let outCount = 0;
  let lowCount = 0;
  let activeCount = 0;
  const idle: IdleProduct[] = [];
  for (const p of products) {
    if (p.active === false) continue;
    activeCount += 1;
    const stock = Math.max(0, num(p.stock));
    const status = stockStatus(p);
    if (status === 'out') outCount += 1;
    else if (status === 'low') lowCount += 1;
    unitsInStock += stock;
    const value = stock * num(p.costPrice);
    costValue += value;
    retailValue += stock * num(p.salePrice);
    if (stock > 0 && !soldIds.has(p.id)) idle.push({ product: p, value: round2(value) });
  }
  idle.sort((a, b) => b.value - a.value || num(b.product.stock) - num(a.product.stock));
  const idleValue = idle.reduce((a, i) => a + i.value, 0);
  return {
    costValue: round2(costValue),
    retailValue: round2(retailValue),
    potentialProfit: round2(retailValue - costValue),
    potentialMarginPct: safePct(retailValue - costValue, retailValue),
    activeCount,
    unitsInStock: round2(unitsInStock),
    outCount,
    lowCount,
    idle: idle.slice(0, limit),
    idleCount: idle.length,
    idleValue: round2(idleValue),
    idleShare: safePct(idleValue, costValue)
  };
}
