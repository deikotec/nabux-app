/**
 * Lo que se le pregunta a la IA al importar.
 *
 * Dos reglas, heredadas del importador de bdee-flow:
 *  1. **No lee todas las filas.** Para el archivo ve las columnas con ejemplos y hasta 300 nombres
 *     repartidos por todo el archivo; importar 5.000 productos cuesta lo mismo que importar 300.
 *     Solo los productos que las palabras clave no logran colocar se le preguntan en lotes, con tope.
 *  2. **No puede tumbar una importación.** Cualquier fallo devuelve un error legible y el
 *     importador sigue con sus reglas automáticas. Todo lo que propone se valida antes de usarse:
 *     columnas que no existen, campos inventados o categorías fuera de la lista se descartan.
 */
import { blobToBase64, generateJson } from '@/lib/ai';
import { compressImage } from '@/lib/image';
import { normalize } from '@/lib/utils';
import { canonicalCategory, categoryIndex, categoryKey, sampleNames, tidyCategory, wordsFromName, type CategoryRule } from './categorize';
import type { ColumnInfo, FieldKey, Target } from './types';

const MAX_CATEGORIES = 24;
const MAX_WORDS = 14;
/** Nombres por llamada al clasificar. */
const CLASSIFY_BATCH = 120;
/** Tope de llamadas de clasificación por importación. */
export const MAX_CLASSIFY_CALLS = 10;

const FIELD_HELP: Record<FieldKey, string> = {
  nombre: 'nombre o descripción del producto',
  sku: 'código interno o referencia del negocio',
  codigo_barras: 'código de barras EAN/UPC',
  categoria: 'categoría, familia o departamento',
  marca: 'marca o fabricante',
  unidad: 'unidad de venta (unidad, kg, litro, caja…)',
  costo: 'precio de compra / costo unitario',
  precio: 'precio de venta al público (moneda principal)',
  precio_bs: 'precio de venta en bolívares',
  stock: 'existencia o cantidad disponible',
  stock_minimo: 'stock mínimo o punto de reorden',
  ubicacion: 'ubicación en tienda o depósito',
  proveedor: 'proveedor o distribuidor',
  exento: 'si el producto está exento de IVA (o la tasa de IVA)',
  imagen: 'enlace (URL) a una foto del producto'
};

export interface BusinessHints {
  businessType?: string;
  /** Moneda principal (ej. "USD"). */
  currency: string;
  /** Moneda local en modo bimonetario (ej. "VES"). */
  localCurrency?: string | null;
  categories: string[];
}

function context(h: BusinessHints) {
  return {
    tipo_de_negocio: h.businessType || 'comercio minorista',
    moneda_principal: h.currency,
    ...(h.localCurrency ? { moneda_local: h.localCurrency } : {}),
    categorias_existentes: h.categories.filter((c) => normalize(c) !== 'general')
  };
}

/** Reglas de categoría limpias: nombres válidos, sin duplicados, alineados con las existentes. */
function cleanRules(raw: unknown, existing: string[]): CategoryRule[] {
  if (!Array.isArray(raw)) return [];
  const index = categoryIndex(existing);
  const byKey = new Map<string, CategoryRule>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const name = canonicalCategory(tidyCategory(String(rec.nombre ?? '')), index);
    if (!name || normalize(name) === 'general' || normalize(name) === 'otros') continue;
    const key = categoryKey(name);
    const words = (Array.isArray(rec.palabras) ? rec.palabras : [])
      .map((w) => normalize(String(w ?? '')).replace(/[^a-z0-9ñ ]+/g, ' ').trim())
      .filter((w) => w.length >= 3);
    const prev = byKey.get(key);
    const merged = [...new Set([...(prev?.words ?? []), ...words, ...wordsFromName(name)])].slice(0, MAX_WORDS);
    byKey.set(key, { name: prev?.name ?? name, words: merged });
    if (byKey.size >= MAX_CATEGORIES) break;
  }
  return [...byKey.values()];
}

/* ------------------------------------------------------------------ */
/* 1. Columnas y categorías de un archivo                              */
/* ------------------------------------------------------------------ */

export interface TableAnalysis {
  mapping: { index: number; target: Target }[];
  rules: CategoryRule[];
}

export async function analyzeTable(input: { infos: ColumnInfo[]; names: string[]; fields: FieldKey[]; hints: BusinessHints }): Promise<TableAnalysis> {
  const allowed = [...input.fields, 'ignorar'] as const;
  const fieldList = input.fields.map((f) => `   - ${f}: ${FIELD_HELP[f]}`).join('\n');
  const system = [
    'Eres un experto en inventarios de comercios de Latinoamérica (bodegas, abastos, ferreterías, farmacias, tiendas).',
    'Te doy las columnas de una hoja de productos (con ejemplos de sus valores) y una muestra de nombres de productos.',
    '',
    'Devuelve dos cosas:',
    '1. "columnas": para cada columna, a qué campo del inventario corresponde. Campos permitidos:',
    fieldList,
    '   - ignorar: cualquier otra cosa (totales, precios al mayor, observaciones, columnas vacías…).',
    '   Cada campo puede ir en UNA sola columna. Fíjate en los ejemplos, no solo en el encabezado.',
    '2. "categorias": una clasificación PLANA (sin subcategorías) de estos productos para los filtros del punto de venta,',
    '   de 3 a 20 categorías. Si una categoría existente encaja, usa EXACTAMENTE su nombre. Las nuevas: cortas, en español,',
    '   en plural y con mayúscula inicial (ej. "Bebidas", "Limpieza", "Charcutería"). Para cada una, "palabras": hasta 12',
    '   palabras en minúscula y sin acentos que, si aparecen en el nombre de un producto, lo colocan ahí',
    '   (ej. Bebidas: refresco, jugo, agua, malta, gaseosa). Si no hay columna de nombres, devuelve "categorias": [].',
    '',
    'No inventes productos: las categorías describen lo que hay en ESTA hoja.'
  ].join('\n');
  const content = JSON.stringify({
    ...context(input.hints),
    columnas: input.infos.map((i) => ({ indice: i.index, encabezado: i.header, ejemplos: i.samples })),
    nombres_de_productos: sampleNames(input.names)
  });
  const res = await generateJson<{ columnas?: { indice?: number; campo?: string }[]; categorias?: unknown }>({
    system,
    parts: [content],
    schema: {
      type: 'object',
      properties: {
        columnas: {
          type: 'array',
          items: {
            type: 'object',
            properties: { indice: { type: 'integer' }, campo: { type: 'string', enum: allowed } },
            required: ['indice', 'campo']
          }
        },
        categorias: {
          type: 'array',
          items: {
            type: 'object',
            properties: { nombre: { type: 'string' }, palabras: { type: 'array', items: { type: 'string' } } },
            required: ['nombre', 'palabras']
          }
        }
      },
      required: ['columnas', 'categorias']
    }
  });

  // Una columna que no existe o un campo que no está en la lista es una alucinación: fuera.
  const mapping: TableAnalysis['mapping'] = [];
  const seen = new Set<number>();
  for (const c of Array.isArray(res.columnas) ? res.columnas : []) {
    const index = Number(c?.indice);
    const target = String(c?.campo ?? '') as Target;
    if (!Number.isInteger(index) || index < 0 || index >= input.infos.length || seen.has(index)) continue;
    if (!(allowed as readonly string[]).includes(target)) continue;
    seen.add(index);
    mapping.push({ index, target });
  }
  return { mapping, rules: input.names.length ? cleanRules(res.categorias, input.hints.categories) : [] };
}

/**
 * Categorías para productos que YA están en el inventario (organizar el catálogo).
 * Igual que al importar: la IA ve una muestra de nombres y propone categorías con palabras clave.
 */
export async function proposeCategories(names: string[], hints: BusinessHints): Promise<CategoryRule[]> {
  const system = [
    'Eres un experto en inventarios de comercios de Latinoamérica. Te doy una muestra de los nombres de los productos de un comercio',
    'y las categorías que ya usa. Propón una clasificación PLANA (sin subcategorías) para los filtros del punto de venta y los reportes:',
    'de 3 a 20 categorías. Si una categoría existente encaja, usa EXACTAMENTE su nombre. Las nuevas: cortas, en español, en plural y con',
    'mayúscula inicial. No uses categorías genéricas como "General", "Varios" u "Otros".',
    'Para cada una, "palabras": hasta 12 palabras en minúscula y sin acentos que, si aparecen en el nombre de un producto, lo colocan ahí.'
  ].join('\n');
  const res = await generateJson<{ categorias?: unknown }>({
    system,
    parts: [JSON.stringify({ ...context(hints), nombres_de_productos: sampleNames(names) })],
    schema: {
      type: 'object',
      properties: {
        categorias: {
          type: 'array',
          items: {
            type: 'object',
            properties: { nombre: { type: 'string' }, palabras: { type: 'array', items: { type: 'string' } } },
            required: ['nombre', 'palabras']
          }
        }
      },
      required: ['categorias']
    }
  });
  return cleanRules(res.categorias, hints.categories);
}

/* ------------------------------------------------------------------ */
/* 2. Productos que las palabras clave no colocaron                    */
/* ------------------------------------------------------------------ */

/**
 * Clasifica nombres en una lista cerrada de categorías, en lotes y con tope de llamadas.
 * Prefiere "ninguna" a forzar: un producto sin categoría se ve y se arregla; uno mal clasificado, no.
 * Devuelve nombre → categoría para los que encontró sitio.
 */
export async function classifyNames(
  names: string[],
  categories: string[],
  hints: BusinessHints,
  onProgress?: (done: number, total: number) => void
): Promise<{ assigned: Map<string, string>; pending: number }> {
  const assigned = new Map<string, string>();
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const list = [...new Set(categories.filter((c) => normalize(c) !== 'general'))];
  if (!unique.length || !list.length) return { assigned, pending: unique.length };
  const valid = new Map(list.map((c) => [categoryKey(c), c]));
  const todo = unique.slice(0, CLASSIFY_BATCH * MAX_CLASSIFY_CALLS);
  const system = [
    'Clasificas productos de un comercio en una lista CERRADA de categorías.',
    'Para cada producto (por su número "i") di a qué categoría pertenece usando exactamente uno de los nombres de la lista,',
    'o "ninguna" si no encaja claramente en ninguna. Prefiere "ninguna" antes que forzar una categoría equivocada.'
  ].join('\n');
  for (let start = 0; start < todo.length; start += CLASSIFY_BATCH) {
    const batch = todo.slice(start, start + CLASSIFY_BATCH);
    const res = await generateJson<{ asignaciones?: { i?: number; categoria?: string }[] }>({
      system,
      parts: [JSON.stringify({ tipo_de_negocio: hints.businessType || 'comercio minorista', categorias: list, productos: batch.map((nombre, i) => ({ i, nombre })) })],
      schema: {
        type: 'object',
        properties: {
          asignaciones: {
            type: 'array',
            items: {
              type: 'object',
              properties: { i: { type: 'integer' }, categoria: { type: 'string', enum: [...list, 'ninguna'] } },
              required: ['i', 'categoria']
            }
          }
        },
        required: ['asignaciones']
      }
    });
    for (const a of Array.isArray(res.asignaciones) ? res.asignaciones : []) {
      const i = Number(a?.i);
      const cat = valid.get(categoryKey(String(a?.categoria ?? '')));
      if (Number.isInteger(i) && batch[i] && cat) assigned.set(batch[i], cat);
    }
    onProgress?.(Math.min(start + CLASSIFY_BATCH, todo.length), todo.length);
  }
  return { assigned, pending: unique.length - todo.length };
}

/* ------------------------------------------------------------------ */
/* 3. Fotos                                                            */
/* ------------------------------------------------------------------ */

export type PhotoMode = 'list' | 'product';

export interface PhotoProduct {
  nombre: string;
  marca: string;
  categoria: string;
  unidad: string;
  precio: number;
  costo: number;
  cantidad: number;
  sku: string;
  codigo_barras: string;
}

export interface PhotoReading {
  kind: 'lista' | 'factura' | 'catalogo' | 'producto' | 'otro';
  /** Código ISO de la moneda de los precios, o "" si no se sabe. */
  currency: string;
  products: PhotoProduct[];
}

const PHOTO_SCHEMA = {
  type: 'object',
  properties: {
    tipo: { type: 'string', enum: ['lista', 'factura', 'catalogo', 'producto', 'otro'] },
    moneda: { type: 'string' },
    productos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          marca: { type: 'string' },
          categoria: { type: 'string' },
          unidad: { type: 'string' },
          precio: { type: 'number' },
          costo: { type: 'number' },
          cantidad: { type: 'number' },
          sku: { type: 'string' },
          codigo_barras: { type: 'string' }
        },
        required: ['nombre', 'marca', 'categoria', 'unidad', 'precio', 'costo', 'cantidad', 'sku', 'codigo_barras']
      }
    }
  },
  required: ['tipo', 'moneda', 'productos']
};

const PHOTO_RULES = [
  '- "nombre": nombre comercial completo con su presentación (tamaño, peso o volumen), ej. "Harina PAN 1 kg", "Refresco Coca-Cola 2 L".',
  '- "categoria": si una de las categorías existentes encaja, EXACTAMENTE ese nombre; si no, una corta en español y en plural.',
  '- Números sin símbolos ni separadores de miles, con punto decimal. Si un dato no aparece usa 0 (y "" en los textos).',
  '- "moneda": código ISO de la moneda de los precios (USD, VES, MXN, COP, EUR…) según el símbolo o el contexto (Bs = VES), o "" si no se sabe.',
  '- "codigo_barras" y "sku" solo si se ven escritos. No inventes datos.'
].join('\n');

function photoSystem(mode: PhotoMode): string {
  if (mode === 'product') {
    return [
      'La foto muestra UN producto de un comercio (su empaque, etiqueta o el artículo). Identifícalo para darlo de alta en el inventario.',
      'Devuelve un solo elemento en "productos" (o ninguno si no se reconoce un producto). "tipo": "producto".',
      'Si se ve una etiqueta con el precio de venta, ponlo en "precio"; si no, 0. "cantidad": 0.',
      PHOTO_RULES
    ].join('\n');
  }
  return [
    'Lees fotos de listas de precios, facturas o notas de compra, catálogos y pizarras para cargar productos en el inventario de un comercio.',
    'Extrae TODOS los productos que aparezcan, uno por renglón, en el mismo orden y sin inventar ninguno.',
    '- Si es una FACTURA o nota de compra: el precio unitario va en "costo", la cantidad comprada en "cantidad" y "precio" en 0.',
    '- Si es una lista de precios, catálogo o etiqueta: el precio va en "precio".',
    '- Ignora totales, subtotales, impuestos, descuentos, fletes y los datos del cliente o del proveedor.',
    PHOTO_RULES
  ].join('\n');
}

/** Prepara la foto para la IA: más grande que una miniatura (hay letra pequeña que leer) pero liviana. */
async function photoPart(file: Blob, name: string): Promise<{ mimeType: string; data: string }> {
  let blob: Blob = file;
  try {
    blob = await compressImage(file, 2048, 0.85);
  } catch {
    /* formato que el navegador no sabe abrir (HEIC en Chrome): se envía tal cual */
  }
  let mimeType = blob.type;
  if (!mimeType || mimeType === 'application/octet-stream') {
    const ext = name.split('.').pop()?.toLowerCase();
    mimeType = ext === 'heic' ? 'image/heic' : ext === 'heif' ? 'image/heif' : ext === 'png' ? 'image/png' : 'image/jpeg';
  }
  if (blob.size > 15 * 1024 * 1024) throw new Error('La foto es demasiado grande (máx. 15 MB).');
  return { mimeType, data: await blobToBase64(blob) };
}

const str = (v: unknown, max = 120) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const amount = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export async function readPhoto(file: Blob, name: string, mode: PhotoMode, hints: BusinessHints): Promise<PhotoReading> {
  const part = await photoPart(file, name);
  const res = await generateJson<{ tipo?: string; moneda?: string; productos?: unknown[] }>({
    system: photoSystem(mode),
    parts: [JSON.stringify(context(hints)), part],
    schema: PHOTO_SCHEMA,
    vision: true,
    temperature: 0.1,
    maxOutputTokens: 16_384
  });
  const kinds = ['lista', 'factura', 'catalogo', 'producto', 'otro'] as const;
  const kind = (kinds as readonly string[]).includes(String(res.tipo)) ? (res.tipo as PhotoReading['kind']) : 'otro';
  const products: PhotoProduct[] = [];
  for (const raw of Array.isArray(res.productos) ? res.productos : []) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const nombre = str(r.nombre, 160);
    if (!nombre) continue;
    products.push({
      nombre,
      marca: str(r.marca, 60),
      categoria: str(r.categoria, 40),
      unidad: str(r.unidad, 20),
      precio: amount(r.precio),
      costo: amount(r.costo),
      cantidad: amount(r.cantidad),
      sku: str(r.sku, 40),
      codigo_barras: str(r.codigo_barras, 40).replace(/\s+/g, '')
    });
    if (mode === 'product') break;
  }
  return { kind, currency: str(res.moneda, 6).toUpperCase(), products };
}
