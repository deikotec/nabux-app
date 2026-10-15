import { toDate } from '@/lib/format';
import { marginPct, normalize, productMatches, stockStatus, toCsv } from '@/lib/utils';
import type { Product, Supplier } from '@/types';

/* ------------------------------------------------------------------ */
/* Filtros y orden                                                     */
/* ------------------------------------------------------------------ */

export type StatusFilter = 'all' | 'ok' | 'low' | 'out' | 'inactive';
export type SortKey = 'name' | 'stock' | 'margin' | 'recent';

export interface Filters {
  search: string;
  category: string;
  status: StatusFilter;
  supplier: string;
  sort: SortKey;
}

/** Valor del filtro de proveedor para "Sin proveedor". */
export const NO_SUPPLIER = '__none__';

export const DEFAULT_FILTERS: Filters = { search: '', category: '', status: 'all', supplier: '', sort: 'name' };

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
  return f.search.trim() !== '' || f.category !== '' || f.status !== 'all' || f.supplier !== '';
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
    return productMatches(p, f.search);
  });
}

const time = (p: Product) => toDate(p.createdAt)?.getTime() ?? 0;

export function sortProducts(list: Product[], sort: SortKey): Product[] {
  const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true });
  const out = [...list];
  switch (sort) {
    case 'stock':
      return out.sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0) || byName(a, b));
    case 'margin':
      return out.sort((a, b) => marginPct(a.costPrice, a.salePrice) - marginPct(b.costPrice, b.salePrice) || byName(a, b));
    case 'recent':
      return out.sort((a, b) => time(b) - time(a) || byName(a, b));
    default:
      return out.sort(byName);
  }
}

/* ------------------------------------------------------------------ */
/* Márgenes y KPIs                                                     */
/* ------------------------------------------------------------------ */

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

export function computeKpis(products: Product[]): InventoryKpis {
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
      marginSum += marginPct(Number(p.costPrice) || 0, Number(p.salePrice));
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

export function productsToCsv(products: Product[], suppliersById: Map<string, Supplier>): string {
  const rows: (string | number)[][] = [[...CSV_HEADERS, 'valor_inventario']];
  for (const p of products) {
    const stock = Number(p.stock) || 0;
    const cost = Number(p.costPrice) || 0;
    rows.push([
      p.name,
      p.sku,
      p.barcode ?? '',
      p.category,
      p.brand ?? '',
      p.unit,
      cost,
      Number(p.salePrice) || 0,
      stock,
      Number(p.minStock) || 0,
      p.location ?? '',
      supplierName(p, suppliersById),
      Math.round(Math.max(0, stock) * cost * 100) / 100
    ]);
  }
  return toCsv(rows);
}

export function templateCsv(): string {
  return toCsv([[...CSV_HEADERS]]);
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
