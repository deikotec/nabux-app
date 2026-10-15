import { UNITS } from '@/config/app';
import { generateSku, normalize, parseCsv, round2 } from '@/lib/utils';
import type { InventorySettings, Product, ProductInput, Supplier } from '@/types';
import { CSV_HEADERS, type CsvField } from './helpers';

/** Encabezados aceptados para cada columna (se comparan sin acentos, espacios ni mayúsculas). */
const FIELD_ALIASES: Record<CsvField, string[]> = {
  nombre: ['nombre', 'name', 'producto', 'nombre del producto', 'descripcion', 'articulo'],
  sku: ['sku', 'clave', 'codigo interno', 'referencia'],
  codigo_barras: ['codigo_barras', 'codigo de barras', 'barcode', 'ean', 'ean13', 'upc', 'codigo'],
  categoria: ['categoria', 'category', 'familia', 'departamento'],
  marca: ['marca', 'brand', 'fabricante'],
  unidad: ['unidad', 'unit', 'unidad de medida', 'um', 'medida'],
  costo: ['costo', 'cost', 'precio compra', 'precio de compra', 'costo unitario', 'costo proveedor'],
  precio: ['precio', 'price', 'precio venta', 'precio de venta', 'pvp', 'precio publico'],
  stock: ['stock', 'existencia', 'existencias', 'cantidad', 'inventario', 'stock inicial', 'stock actual'],
  stock_minimo: ['stock_minimo', 'stock minimo', 'minimo', 'min', 'stock min', 'stock_min'],
  ubicacion: ['ubicacion', 'location', 'pasillo', 'ubicacion en bodega'],
  proveedor: ['proveedor', 'supplier', 'distribuidor']
};

const REQUIRED: CsvField[] = ['nombre', 'precio'];

const keyOf = (h: string) => normalize(h).replace(/[^a-z0-9]/g, '');

const UNIT_ALIASES: Record<string, string> = {
  u: 'Unidad',
  ud: 'Unidad',
  uds: 'Unidad',
  unidades: 'Unidad',
  pza: 'Pieza',
  pz: 'Pieza',
  pzas: 'Pieza',
  piezas: 'Pieza',
  kg: 'Kg',
  kilo: 'Kg',
  kilos: 'Kg',
  kilogramo: 'Kg',
  kilogramos: 'Kg',
  g: 'Gramo',
  gr: 'Gramo',
  gramos: 'Gramo',
  l: 'Litro',
  lt: 'Litro',
  lts: 'Litro',
  litros: 'Litro',
  ml: 'Mililitro',
  mililitros: 'Mililitro',
  m: 'Metro',
  mt: 'Metro',
  metros: 'Metro',
  paq: 'Paquete',
  pack: 'Paquete',
  paquetes: 'Paquete',
  cajas: 'Caja',
  dz: 'Docena',
  docenas: 'Docena',
  pares: 'Par'
};

function resolveUnit(raw: string): string {
  const k = keyOf(raw);
  if (!k) return 'Unidad';
  const exact = UNITS.find((u) => keyOf(u) === k);
  return exact ?? UNIT_ALIASES[k] ?? raw.trim();
}

/**
 * Convierte texto a número tolerando símbolos de moneda y separadores locales
 * ("$1,234.50", "1.234,50", "12,5"). Devuelve null si está vacío y NaN si no es válido.
 */
export function parseNumber(raw: string | undefined): number | null {
  let s = (raw ?? '').trim();
  if (!s) return null;
  s = s.replace(/[^\d.,-]/g, '');
  if (!s || s === '-') return Number.NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // El último separador es el decimal.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const parts = s.split(',');
    // "1,234" o "1,234,567" → miles; "12,5" → decimal.
    s = parts.length > 2 || (parts.length === 2 && parts[1].length === 3) ? parts.join('') : parts.join('.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

export type ImportStatus = 'valid' | 'skip' | 'error';

export interface ImportRow {
  /** Número de línea en el archivo (1 = encabezados). */
  line: number;
  input: ProductInput;
  status: ImportStatus;
  /** Errores (la fila no se importa) o motivo de omisión. */
  problems: string[];
  /** Avisos informativos (ej. SKU generado). */
  notes: string[];
}

export interface ImportParseResult {
  rows: ImportRow[];
  /** Columnas obligatorias que no se encontraron. */
  missing: CsvField[];
  /** Encabezados del archivo que no se reconocieron (se ignoran). */
  ignored: string[];
  detected: CsvField[];
  counts: Record<ImportStatus, number>;
}

interface ParseContext {
  products: Product[];
  suppliers: Supplier[];
  categories: string[];
  settings: InventorySettings;
}

export function buildImportRows(text: string, ctx: ParseContext): ImportParseResult {
  const table = parseCsv(text);
  const counts: Record<ImportStatus, number> = { valid: 0, skip: 0, error: 0 };
  if (!table.length) return { rows: [], missing: [...REQUIRED], ignored: [], detected: [], counts };

  // 1. Mapeo tolerante de encabezados.
  const header = table[0];
  const index: Partial<Record<CsvField, number>> = {};
  const ignored: string[] = [];
  header.forEach((h, i) => {
    const k = keyOf(h);
    const field = CSV_HEADERS.find((f) => index[f] === undefined && FIELD_ALIASES[f].some((a) => keyOf(a) === k));
    if (field) index[field] = i;
    else if (h.trim()) ignored.push(h.trim());
  });
  const missing = REQUIRED.filter((f) => index[f] === undefined);
  const detected = CSV_HEADERS.filter((f) => index[f] !== undefined);
  if (missing.length) return { rows: [], missing, ignored, detected, counts };

  // 2. Índices del catálogo actual.
  const existingSkus = new Map<string, Product>();
  const existingCodes = new Map<string, Product>();
  for (const p of ctx.products) {
    if (p.sku) existingSkus.set(p.sku.trim().toUpperCase(), p);
    if (p.barcode) existingCodes.set(normalize(p.barcode), p);
  }
  const suppliersByName = new Map(ctx.suppliers.map((s) => [normalize(s.name), s]));
  const categoriesByKey = new Map(ctx.categories.map((c) => [normalize(c), c]));
  const seenSkus = new Set<string>();
  const seenCodes = new Set<string>();

  const rows: ImportRow[] = [];
  table.slice(1).forEach((cells, i) => {
    const get = (f: CsvField) => {
      const idx = index[f];
      return idx === undefined ? '' : (cells[idx] ?? '').trim();
    };
    const problems: string[] = [];
    const notes: string[] = [];
    let status: ImportStatus = 'valid';

    const name = get('nombre');
    if (!name) problems.push('Falta el nombre');

    const rawCategory = get('categoria');
    const category = rawCategory ? (categoriesByKey.get(normalize(rawCategory)) ?? rawCategory) : 'General';
    if (!rawCategory) notes.push('Sin categoría: se usará "General"');

    const price = parseNumber(get('precio'));
    if (price === null) problems.push('Falta el precio de venta');
    else if (Number.isNaN(price) || price <= 0) problems.push(`Precio inválido ("${get('precio')}")`);

    const cost = parseNumber(get('costo'));
    if (cost !== null && (Number.isNaN(cost) || cost < 0)) problems.push(`Costo inválido ("${get('costo')}")`);

    const stock = parseNumber(get('stock'));
    if (stock !== null && Number.isNaN(stock)) problems.push(`Stock inválido ("${get('stock')}")`);
    else if (stock !== null && stock < 0) problems.push('El stock no puede ser negativo');

    const minStock = parseNumber(get('stock_minimo'));
    if (minStock !== null && (Number.isNaN(minStock) || minStock < 0)) problems.push(`Stock mínimo inválido ("${get('stock_minimo')}")`);

    // Código de barras: no debe repetirse ni en el catálogo ni en el archivo.
    const barcode = get('codigo_barras');
    if (barcode) {
      const code = normalize(barcode);
      const owner = existingCodes.get(code) ?? existingSkus.get(barcode.toUpperCase());
      if (owner) problems.push(`Código de barras ya usado por "${owner.name}"`);
      else if (seenCodes.has(code)) problems.push('Código de barras repetido en el archivo');
      seenCodes.add(code);
    }

    // SKU: se genera si falta; si ya existe en el catálogo la fila se omite.
    let sku = get('sku').toUpperCase();
    if (!sku) {
      for (let t = 0; t < 25; t++) {
        const candidate = generateSku(ctx.settings.skuPrefix, category).toUpperCase();
        if (!existingSkus.has(candidate) && !seenSkus.has(candidate)) {
          sku = candidate;
          break;
        }
      }
      notes.push(`SKU generado: ${sku}`);
    } else if (seenSkus.has(sku)) {
      problems.push(`SKU ${sku} repetido en el archivo`);
    }
    const existing = existingSkus.get(sku);
    seenSkus.add(sku);

    // Proveedor por nombre.
    const rawSupplier = get('proveedor');
    const supplier = rawSupplier ? suppliersByName.get(normalize(rawSupplier)) : undefined;
    if (rawSupplier && !supplier) notes.push(`Proveedor "${rawSupplier}" no registrado: se guardará solo el nombre`);

    if (problems.length) status = 'error';
    else if (existing) {
      status = 'skip';
      problems.push(`El SKU ${sku} ya existe ("${existing.name}"): se omite`);
    }

    const input: ProductInput = {
      name,
      sku,
      barcode,
      category,
      brand: get('marca'),
      unit: resolveUnit(get('unidad')),
      costPrice: cost !== null && !Number.isNaN(cost) ? round2(cost) : 0,
      salePrice: price !== null && !Number.isNaN(price) ? round2(price) : 0,
      stock: stock !== null && !Number.isNaN(stock) ? stock : 0,
      minStock: minStock !== null && !Number.isNaN(minStock) ? minStock : ctx.settings.lowStockDefault,
      location: get('ubicacion'),
      supplierId: supplier?.id ?? null,
      supplierName: supplier?.name ?? (rawSupplier || null),
      active: true
    };
    counts[status]++;
    rows.push({ line: i + 2, input, status, problems, notes });
  });

  return { rows, missing, ignored, detected, counts };
}

/** Lee un archivo de texto probando UTF-8 y, si hay caracteres inválidos, Windows-1252 (CSV de Excel). */
export async function readTextFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('�')) return utf8;
  try {
    return new TextDecoder('windows-1252').decode(buf);
  } catch {
    return utf8;
  }
}
