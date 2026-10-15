import { dayKey } from '@/lib/dates';
import { formatNumber, toDate } from '@/lib/format';
import { salePayments } from '@/lib/payments';
import { downloadFile, normalize, round2, toCsv } from '@/lib/utils';
import type { PaymentMethodConfig, RateSource, Sale, SaleItem, SalePayment } from '@/types';

export const SALE_STATUS_LABEL: Record<Sale['status'], string> = {
  completed: 'Completada',
  voided: 'Anulada'
};

/** Valor del filtro de método para ventas con más de una forma de pago. */
export const MIXED_FILTER = 'mixed';

const RATE_SOURCE_SHORT: Record<RateSource, string> = { bcv: 'BCV', parallel: 'Paralelo', custom: 'Propia' };

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

/* ---------------- Pagos y monedas ---------------- */

type PaymentsOf = Pick<Sale, 'payments' | 'paymentMethod' | 'total' | 'currency'>;

/** ¿La venta se cobró con más de una forma de pago? */
export function isMixedSale(sale: PaymentsOf, payments: SalePayment[] = salePayments(sale)): boolean {
  return payments.length > 1 || sale.paymentMethod === MIXED_FILTER;
}

/** "Efectivo $ + Pago móvil" (o el nombre del único método). */
export function saleMethodsText(sale: PaymentsOf): string {
  const p = salePayments(sale);
  return p.length > 1 ? `Mixto: ${p.map((x) => x.label).join(' + ')}` : (p[0]?.label ?? '—');
}

/** ¿La venta usó la forma de pago indicada? ('all' = cualquiera, 'mixed' = más de una). */
export function saleMatchesMethod(sale: PaymentsOf, method: string): boolean {
  if (method === 'all') return true;
  const payments = salePayments(sale);
  if (method === MIXED_FILTER) return isMixedSale(sale, payments);
  return payments.some((p) => p.methodId === method);
}

/**
 * Total de la venta en moneda local con la tasa guardada en ESA venta (nunca la tasa actual).
 * Devuelve null si la venta no tiene tasa registrada (ventas antiguas o de una sola moneda).
 */
export function saleLocalTotal(sale: Pick<Sale, 'total' | 'totalLocal' | 'rate'>): number | null {
  if (sale.totalLocal !== null && sale.totalLocal !== undefined && Number.isFinite(Number(sale.totalLocal))) return Number(sale.totalLocal);
  if (sale.rate && sale.rate > 0) return round2((Number(sale.total) || 0) * sale.rate);
  return null;
}

/** Referencias de pago de la venta (pago móvil, Zelle, transferencias…). */
export function saleReferences(sale: PaymentsOf): string[] {
  return salePayments(sale)
    .map((p) => p.reference?.trim())
    .filter((r): r is string => !!r);
}

/** Búsqueda libre por folio, cliente, cajero, producto (nombre / SKU), forma de pago o referencia de pago. */
export function saleMatches(sale: Sale, query: string): boolean {
  const q = normalize(query).replace(/#/g, '');
  if (!q) return true;
  const payments = salePayments(sale);
  const refs = payments.flatMap((p) => (p.reference ? [p.reference, p.reference.replace(/[^0-9a-z]/gi, '')] : []));
  const haystack = normalize(
    [sale.folio, sale.customerName, sale.cashierName, ...(sale.items ?? []).flatMap((i) => [i.name, i.sku]), ...payments.map((p) => p.label), ...refs]
      .filter(Boolean)
      .join(' ')
  );
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

export interface MethodOption {
  value: string;
  label: string;
}

/**
 * Opciones del filtro por forma de pago:
 * - `configured`: formas de pago del negocio (activas, o inactivas que aparecen en las ventas cargadas).
 * - `legacy`: métodos que aparecen en las ventas pero ya no están configurados (ventas antiguas).
 */
export function methodFilterOptions(sales: Sale[], methods: PaymentMethodConfig[], dual: boolean): { configured: MethodOption[]; legacy: MethodOption[] } {
  const present = new Map<string, string>();
  for (const s of sales) for (const p of salePayments(s)) if (!present.has(p.methodId)) present.set(p.methodId, p.label);
  const configured: MethodOption[] = methods
    .filter((m) => present.has(m.id) || (m.active && (dual || m.currency === 'base')))
    .map((m) => ({ value: m.id, label: m.active ? m.label : `${m.label} (inactiva)` }));
  const known = new Set(methods.map((m) => m.id));
  const legacy: MethodOption[] = Array.from(present)
    .filter(([id]) => !known.has(id) && id !== MIXED_FILTER)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  return { configured, legacy };
}

/* ---------------- Estadísticas ---------------- */

export interface SalesStats {
  /** Total cobrado en ventas completadas (moneda base, sin IGTF). */
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
  /** Total en moneda local: suma de cada venta a SU tasa (solo ventas que la tienen). */
  totalLocal: number;
  /** Ventas completadas sin monto en moneda local (sin tasa registrada). */
  localMissing: number;
  voidedLocal: number;
  /** Ventas anuladas sin tasa registrada. */
  voidedLocalMissing: number;
}

export function salesStats(sales: Sale[]): SalesStats {
  let total = 0;
  let count = 0;
  let units = 0;
  let profit = 0;
  let voidedTotal = 0;
  let voidedCount = 0;
  let totalLocal = 0;
  let localMissing = 0;
  let voidedLocal = 0;
  let voidedLocalMissing = 0;
  for (const s of sales) {
    const local = saleLocalTotal(s);
    if (s.status === 'voided') {
      voidedTotal += Number(s.total) || 0;
      if (local === null) voidedLocalMissing += 1;
      else voidedLocal += local;
      voidedCount += 1;
      continue;
    }
    total += Number(s.total) || 0;
    units += Number(s.itemCount) || 0;
    profit += Number(s.profit) || 0;
    if (local === null) localMissing += 1;
    else totalLocal += local;
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
    voidedCount,
    totalLocal: round2(totalLocal),
    localMissing,
    voidedLocal: round2(voidedLocal),
    voidedLocalMissing
  };
}

/* ---------------- CSV ---------------- */

const n2 = (v: number | null | undefined) => (Number(v) || 0).toFixed(2);
const rateText = (v: number | null | undefined) => (v && v > 0 ? String(Math.round(v * 10000) / 10000) : '');

function stamp(d: Date | null) {
  if (!d) return '';
  return `${dayKey(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export interface SalesCsvOptions {
  includeProfit: boolean;
  /** Modo bimonetario: agrega IGTF, tasa, total en moneda local y vuelto. */
  dual?: boolean;
  /** Formas de pago del negocio (para nombrar el método del vuelto). */
  methods?: PaymentMethodConfig[];
  baseCurrency?: string;
  localCurrency?: string;
}

/**
 * CSV con el detalle de ventas (montos sin símbolo para que la hoja de cálculo los sume).
 * Incluye una columna por pago (método, moneda, monto, referencia) cuando hay modo bimonetario,
 * pagos mixtos o referencias.
 */
export function salesToCsv(sales: Sale[], opts: SalesCsvOptions): string {
  const { includeProfit, methods = [] } = opts;
  const dual = !!opts.dual || sales.some((s) => !!s.rate);
  const base = opts.baseCurrency || 'USD';
  const local = opts.localCurrency || 'VES';
  const paymentsOf = new Map(sales.map((s) => [s.id, salePayments(s)]));
  const withDetail = dual || sales.some((s) => (paymentsOf.get(s.id)?.length ?? 0) > 1 || paymentsOf.get(s.id)?.some((p) => !!p.reference));
  const slots = withDetail ? Math.max(1, ...sales.map((s) => paymentsOf.get(s.id)?.length ?? 0)) : 0;
  const methodLabel = (id: string | null | undefined, sale: Sale) =>
    id ? (methods.find((m) => m.id === id)?.label ?? paymentsOf.get(sale.id)?.find((p) => p.methodId === id)?.label ?? id) : '';

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
    dual ? `Total ${base}` : 'Total',
    ...(includeProfit ? ['Utilidad'] : []),
    ...(dual ? ['IGTF', `Total cobrado ${base}`, `Tasa (${local}/${base})`, 'Fuente de tasa', `Total ${local}`] : []),
    ...Array.from({ length: slots }, (_, i) => [`Pago ${i + 1} método`, `Pago ${i + 1} moneda`, `Pago ${i + 1} monto`, `Pago ${i + 1} referencia`]).flat(),
    ...(dual ? ['Vuelto método', 'Vuelto moneda', 'Vuelto monto'] : []),
    'Estado',
    'Motivo de anulación'
  ];

  const rows = sales.map((s) => {
    const payments = paymentsOf.get(s.id) ?? [];
    const igtf = Number(s.igtf) || 0;
    const localTotal = saleLocalTotal(s);
    const changeAmount = Number(s.changeAmount) || 0;
    return [
      s.folio,
      stamp(toDate(s.createdAt)),
      s.customerName || '',
      s.cashierName || '',
      saleMethodsText(s),
      (s.items ?? []).map((i) => `${i.name} x${formatQty(i.qty)}`).join('; '),
      Number(s.itemCount) || 0,
      n2(s.subtotal),
      n2(s.tax),
      n2(s.discount),
      n2(s.total),
      ...(includeProfit ? [n2(s.profit)] : []),
      ...(dual
        ? [
            n2(igtf),
            n2(s.amountDue ?? (Number(s.total) || 0) + igtf),
            rateText(s.rate),
            s.rateSource ? RATE_SOURCE_SHORT[s.rateSource] : '',
            localTotal === null ? '' : n2(localTotal)
          ]
        : []),
      ...Array.from({ length: slots }, (_, i) => {
        const p = payments[i];
        return p ? [p.label, p.currency || s.currency || base, n2(p.amount), p.reference ?? ''] : ['', '', '', ''];
      }).flat(),
      ...(dual
        ? changeAmount > 0
          ? [methodLabel(s.changeMethodId, s), s.changeCurrency || s.currency || base, n2(changeAmount)]
          : (Number(s.change) || 0) > 0
            ? ['Efectivo', s.currency || base, n2(s.change)]
            : ['', '', '']
        : []),
      SALE_STATUS_LABEL[s.status] ?? s.status,
      s.voidReason ?? ''
    ];
  });
  return toCsv([header, ...rows]);
}

export function exportSalesCsv(filename: string, sales: Sale[], opts: SalesCsvOptions) {
  downloadFile(filename, salesToCsv(sales, opts));
}
