import { toDate } from '@/lib/format';
import { marginPct, normalize, productMatches, round2, stockStatus, toCsv } from '@/lib/utils';
import type { Product, Supplier } from '@/types';

/* ------------------------------------------------------------------ */
/* Filtros y orden                                                     */
/* ------------------------------------------------------------------ */

export type StatusFilter = 'all' | 'ok' | 'low' | 'out' | 'inactive';
export type SortKey = 'name' | 'stock' | 'margin' | 'recent';
/** Filtro de IVA: todos, solo exentos o solo gravados. */
export type TaxFilter = '' | 'exempt' | 'taxed';

export interface Filters {
  search: string;
  category: string;
  status: StatusFilter;
  supplier: string;
  tax: TaxFilter;
  sort: SortKey;
}

/** Valor del filtro de proveedor para "Sin proveedor". */
export const NO_SUPPLIER = '__none__';

export const DEFAULT_FILTERS: Filters = { search: '', category: '', status: 'all', supplier: '', tax: '', sort: 'name' };

export function taxOptions(taxName: string): { value: TaxFilter; label: string }[] {
  return [
    { value: '', label: 'Todos' },
    { value: 'exempt', label: `Exentos de ${taxName}` },
    { value: 'taxed', label: 'Gravados' }
  ];
}

export const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'ok', label: 'Óptimo' },
  { value: 'low', label: 'Por agotarse' },
  { value: 'out', label: 'Agotado' },
  { value: 'inactive', label: 'Inactivos' }
];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name', label: 'Nombre (A-Z)' },
  { value: 'stock', label: 'Menor stock' },
  { value: 'margin', label: 'Menor margen' },
  { value: 'recent', label: 'Más recientes' }
];

export const PAGE_SIZES = [10, 25, 50, 100];

/** Traduce `?estado=` de la URL al filtro de estado. */
export function statusFromParam(value: string | null): StatusFilter | null {
  switch (normalize(value)) {
    case 'bajo':
    case 'low':
    case 'por-agotarse':
      return 'low';
    case 'agotado':
    case 'agotados':
    case 'out':
      return 'out';
    case 'optimo':
    case 'ok':
      return 'ok';
    case 'inactivo':
    case 'inactivos':
      return 'inactive';
    case 'todos':
    case 'all':
      return 'all';
    default:
      return null;
  }
}

export function hasActiveFilters(f: Filters) {
  return f.search.trim() !== '' || f.category !== '' || f.status !== 'all' || f.supplier !== '' || f.tax !== '';
}

export function isActive(p: Product) {
  return p.active !== false;
}

export function filterProducts(products: Product[], f: Filters): Product[] {
  const catKey = normalize(f.category);
  return products.filter((p) => {
    if (f.status === 'inactive') {
      if (isActive(p)) return false;
    } else if (f.status !== 'all') {
      if (!isActive(p) || stockStatus(p) !== f.status) return false;
    }
    if (catKey && normalize(p.category) !== catKey) return false;
    if (f.supplier === NO_SUPPLIER) {
      if (p.supplierId || p.supplierName) return false;
    } else if (f.supplier && p.supplierId !== f.supplier) return false;
    if (f.tax === 'exempt' && !p.taxExempt) return false;
    if (f.tax === 'taxed' && p.taxExempt) return false;
    return productMatches(p, f.search);
  });
}

const time = (p: Product) => toDate(p.createdAt)?.getTime() ?? 0;

export function sortProducts(list: Product[], sort: SortKey, tax: TaxCtx | null = null): Product[] {
  const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true });
  const out = [...list];
  switch (sort) {
    case 'stock':
      return out.sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0) || byName(a, b));
    case 'margin':
      return out.sort((a, b) => productMargin(a, tax) - productMargin(b, tax) || byName(a, b));
    case 'recent':
      return out.sort((a, b) => time(b) - time(a) || byName(a, b));
    default:
      return out.sort(byName);
  }
}

/* ------------------------------------------------------------------ */
/* Márgenes y KPIs                                                     */
/* ------------------------------------------------------------------ */

/**
 * Impuesto para calcular márgenes reales (sobre el precio sin IVA). Solo se usa en negocios de
 * Venezuela, donde hay productos exentos; en el resto el margen se calcula como siempre.
 */
export interface TaxCtx {
  /** Tasa en %, ej. 16. */
  rate: number;
  /** Los precios de venta ya incluyen el impuesto. */
  included: boolean;
  /** "IVA". */
  name: string;
}

/** Precio sin impuesto (base imponible) de un precio de venta. */
export function netPrice(price: number, exempt: boolean | undefined, tax: TaxCtx | null): number {
  const p = Number(price) || 0;
  if (!tax || exempt || !tax.included || tax.rate <= 0) return p;
  return p / (1 + tax.rate / 100);
}

/** Precio que hay que capturar para obtener una base sin impuesto dada (inverso de `netPrice`). */
export function grossFromNet(net: number, exempt: boolean | undefined, tax: TaxCtx | null): number {
  if (!tax || exempt || !tax.included || tax.rate <= 0) return net;
  return net * (1 + tax.rate / 100);
}

/** Margen bruto (%) de un costo y un precio; sobre el precio sin IVA cuando aplica. */
export function marginOf(cost: number, price: number, exempt: boolean | undefined, tax: TaxCtx | null): number {
  return marginPct(Number(cost) || 0, netPrice(price, exempt, tax));
}

export function productMargin(p: Pick<Product, 'costPrice' | 'salePrice' | 'taxExempt'>, tax: TaxCtx | null): number {
  return marginOf(p.costPrice, p.salePrice, p.taxExempt, tax);
}

/** Redondea hacia arriba a centavos sin arrastrar errores de coma flotante (12.5 → 12.50, no 12.51). */
export function ceilCents(n: number): number {
  return Math.ceil(Math.round(n * 100 * 1e6) / 1e6) / 100;
}

export type MarginTone = 'good' | 'warn' | 'bad';

/** Verde si alcanza el mínimo recomendado, ámbar si es positivo pero bajo, rojo si no hay ganancia. */
export function marginTone(pct: number, minMarginPct: number): MarginTone {
  if (pct <= 0) return 'bad';
  if (pct < minMarginPct) return 'warn';
  return 'good';
}

export const MARGIN_CHIP: Record<MarginTone, string> = {
  good: 'bg-primary-fixed/50 text-on-primary-fixed-variant',
  warn: 'bg-amber-100 text-amber-800',
  bad: 'bg-red-100 text-red-800'
};

export interface InventoryKpis {
  activeCount: number;
  okCount: number;
  okPct: number;
  lowCount: number;
  outCount: number;
  costValue: number;
  saleValue: number;
  avgMargin: number | null;
}

export function computeKpis(products: Product[], tax: TaxCtx | null = null): InventoryKpis {
  let activeCount = 0;
  let okCount = 0;
  let lowCount = 0;
  let outCount = 0;
  let costValue = 0;
  let saleValue = 0;
  let marginSum = 0;
  let marginCount = 0;
  for (const p of products) {
    const stock = Math.max(0, Number(p.stock) || 0);
    // La valorización incluye todo lo que hay en bodega (también productos inactivos).
    costValue += stock * (Number(p.costPrice) || 0);
    saleValue += stock * (Number(p.salePrice) || 0);
    if (!isActive(p)) continue;
    activeCount++;
    const s = stockStatus(p);
    if (s === 'ok') okCount++;
    else if (s === 'low') lowCount++;
    else outCount++;
    if (Number(p.salePrice) > 0) {
      marginSum += productMargin(p, tax);
      marginCount++;
    }
  }
  return {
    activeCount,
    okCount,
    okPct: activeCount ? (okCount / activeCount) * 100 : 0,
    lowCount,
    outCount,
    costValue,
    saleValue,
    avgMargin: marginCount ? marginSum / marginCount : null
  };
}

/* ------------------------------------------------------------------ */
/* Proveedores                                                         */
/* ------------------------------------------------------------------ */

export function supplierName(p: Pick<Product, 'supplierId' | 'supplierName'>, suppliersById: Map<string, Supplier>): string {
  return (p.supplierId ? suppliersById.get(p.supplierId)?.name : undefined) ?? p.supplierName ?? '';
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

export const CSV_HEADERS = [
  'nombre',
  'sku',
  'codigo_barras',
  'categoria',
  'marca',
  'unidad',
  'costo',
  'precio',
  'stock',
  'stock_minimo',
  'ubicacion',
  'proveedor'
] as const;

export type CsvField = (typeof CSV_HEADERS)[number];

/** Columnas opcionales: `precio_bs` (bimonetario) y `exento` (IVA). */
export type CsvExtraField = 'precio_bs' | 'exento';
export type ImportField = CsvField | CsvExtraField;

export interface CsvOptions {
  /** Modo bimonetario: agrega `precio_bs` junto a `precio`. */
  dual?: boolean;
  /** Agrega la columna `exento` (si/no). */
  exempt?: boolean;
}

/** Encabezados en orden: los de siempre, `precio_bs` junto al precio y `exento` al final. */
export function csvColumns(opts: CsvOptions = {}): ImportField[] {
  const cols: ImportField[] = [];
  for (const h of CSV_HEADERS) {
    cols.push(h);
    if (h === 'precio' && opts.dual) cols.push('precio_bs');
  }
  if (opts.exempt) cols.push('exento');
  return cols;
}

export interface ExportOptions extends CsvOptions {
  /** $ → Bs a la tasa actual (null sin tasa: la celda queda vacía). */
  toLocal?: (usd: number) => number | null;
}

export function productsToCsv(products: Product[], suppliersById: Map<string, Supplier>, opts: ExportOptions = {}): string {
  // `exento` también se exporta si algún producto ya está marcado, para no perder el dato.
  const columns = csvColumns({ ...opts, exempt: opts.exempt || products.some((p) => p.taxExempt) });
  const rows: (string | number)[][] = [[...columns, 'valor_inventario']];
  for (const p of products) {
    const stock = Number(p.stock) || 0;
    const cost = Number(p.costPrice) || 0;
    const price = Number(p.salePrice) || 0;
    const values: Record<ImportField, string | number> = {
      nombre: p.name,
      sku: p.sku,
      codigo_barras: p.barcode ?? '',
      categoria: p.category,
      marca: p.brand ?? '',
      unidad: p.unit,
      costo: cost,
      precio: price,
      precio_bs: opts.toLocal?.(price) ?? '',
      stock,
      stock_minimo: Number(p.minStock) || 0,
      ubicacion: p.location ?? '',
      proveedor: supplierName(p, suppliersById),
      exento: p.taxExempt ? 'si' : 'no'
    };
    rows.push([...columns.map((c) => values[c]), Math.round(Math.max(0, stock) * cost * 100) / 100]);
  }
  return toCsv(rows);
}

export function templateCsv(opts: CsvOptions = {}): string {
  return toCsv([csvColumns(opts)]);
}

/**
 * Interpreta un "si/no" de CSV (si, sí, x, 1, true, exento… / no, 0, false, gravado…).
 * Devuelve null si está vacío y undefined si no se reconoce.
 */
export function parseYesNo(raw: string | undefined): boolean | null | undefined {
  const k = normalize(raw).replace(/[^a-z0-9]/g, '');
  if (!k) return null;
  if (['si', 's', 'x', '1', 'true', 'verdadero', 'yes', 'y', 'exento', 'e'].includes(k)) return true;
  if (['no', 'n', '0', 'false', 'falso', 'gravado', 'g'].includes(k)) return false;
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Ajuste masivo de precios                                            */
/* ------------------------------------------------------------------ */

export const ROUNDING_STEPS = [0.01, 0.05, 0.1, 0.5, 1] as const;

/** Mismo cálculo que `bulkAdjustPrices` (servicio), para la vista previa. */
export function adjustPrice(value: number, pct: number, step: number): number {
  const factor = 1 + (Number(pct) || 0) / 100;
  const s = step > 0 ? step : 0.01;
  return round2(Math.max(0, Math.round(((Number(value) || 0) * factor) / s) * s));
}

/** Sufijo de fecha para nombres de archivo: 2026-10-15 */
export function fileStamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Nombre de archivo seguro a partir del nombre del negocio. */
export function slug(text: string): string {
  return normalize(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'negocio';
}

/* ------------------------------------------------------------------ */
/* Escrituras con soporte sin conexión                                 */
/* ------------------------------------------------------------------ */

/**
 * Con conexión espera la confirmación del servidor. Sin conexión, Firestore deja la escritura
 * en cola (la promesa no resuelve hasta reconectar), así que no bloqueamos la interfaz.
 */
export async function commitWrite(p: Promise<unknown>, online: boolean, onError?: (e: unknown) => void): Promise<void> {
  if (online) {
    await p;
    return;
  }
  p.catch((e) => {
    console.error(e);
    onError?.(e);
  });
}

/** Ajustes de stock por tipo de movimiento manual. */
export type MoveType = 'in' | 'out' | 'adjust';

export const MOVE_REASONS = [
  'Compra a proveedor',
  'Devolución de cliente',
  'Merma o daño',
  'Caducidad',
  'Robo / faltante',
  'Conteo físico',
  'Uso interno',
  'Otro'
] as const;

export const DEFAULT_REASON: Record<MoveType, (typeof MOVE_REASONS)[number]> = {
  in: 'Compra a proveedor',
  out: 'Merma o daño',
  adjust: 'Conteo físico'
};
