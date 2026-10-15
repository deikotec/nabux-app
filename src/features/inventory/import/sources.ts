/** Leer lo que el usuario sube: un Excel/CSV (tabla) o fotos (borradores leídos por la IA o por el nombre del archivo). */
import { readWorkbook, XlsxError } from '@/lib/xlsx';
import { round2 } from '@/lib/utils';
import type { PhotoMode, PhotoReading } from './aiImport';
import { readTextFile, tablesFromCsv, detectTables } from './table';
import type { Draft, DraftValues, ImportTable } from './types';

/** Tope de tamaño de archivo: los .xlsx con fotos pesan, pero más allá el navegador sufre. */
export const MAX_FILE_MB = 40;
/** Tope de filas por importación. */
export const MAX_ROWS = 20_000;
/** Tope de fotos por tanda (cada una es una llamada a la IA). */
export const MAX_PHOTOS = 30;

export const TABLE_ACCEPT = '.xlsx,.xlsm,.csv,.txt,.tsv,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const PHOTO_ACCEPT = 'image/*,.heic,.heif';

export interface TableSource {
  fileName: string;
  format: 'xlsx' | 'csv';
  tables: ImportTable[];
}

export function isTableFile(file: File): boolean {
  return /\.(xlsx|xlsm|csv|txt|tsv|xls|ods|numbers)$/i.test(file.name) || /csv|spreadsheet|excel|text\/plain/.test(file.type);
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name);
}

export async function readTableFile(file: File): Promise<TableSource> {
  const name = file.name.toLowerCase();
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`El archivo pesa más de ${MAX_FILE_MB} MB. Divídelo en varios archivos.`);
  if (/\.xls$/.test(name)) throw new Error('Es un Excel antiguo (.xls). Ábrelo en Excel y usa «Guardar como» → Libro de Excel (.xlsx).');
  if (/\.(ods|numbers)$/.test(name)) throw new Error('Guarda el archivo como Excel (.xlsx) o CSV y vuelve a intentarlo.');

  let tables: ImportTable[];
  let format: TableSource['format'];
  if (/\.(xlsx|xlsm)$/.test(name) || file.type.includes('spreadsheetml')) {
    format = 'xlsx';
    try {
      tables = detectTables(await readWorkbook(await file.arrayBuffer()));
    } catch (e) {
      if (e instanceof XlsxError) throw new Error(e.message);
      if (e instanceof TypeError && /DecompressionStream/.test(e.message)) {
        throw new Error('Tu navegador no puede abrir archivos de Excel. Actualízalo o exporta el archivo como CSV.');
      }
      throw e;
    }
  } else {
    format = 'csv';
    tables = tablesFromCsv(await readTextFile(file));
  }
  if (!tables.length) throw new Error('No encontramos ninguna tabla de productos en el archivo.');
  if (tables[0].rows.length > MAX_ROWS) {
    throw new Error(`El archivo tiene ${tables[0].rows.length.toLocaleString('es')} filas y el tope es ${MAX_ROWS.toLocaleString('es')}. Divídelo en varios archivos.`);
  }
  return { fileName: file.name, format, tables };
}

/* ------------------------------------------------------------------ */
/* Fotos                                                               */
/* ------------------------------------------------------------------ */

/** "coca_cola-2L (1).jpg" → "Coca cola 2L". */
export function nameFromFile(fileName: string): string {
  const base = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/\(\d+\)$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
}

/** Lo que dice el nombre de una foto: un código de barras, un SKU o el nombre del producto. Las fotos de cámara ("IMG_2031") no dicen nada. */
export function valuesFromFileName(fileName: string): DraftValues {
  const base = fileName.replace(/\.[^.]+$/, '').trim();
  const cameraName =
    /^(img|dsc|dcim|pxl|mvimg|photo|foto|image|imagen|whatsapp( image)?|screenshot|captura( de pantalla)?|signal|telegram)(?![a-z])[\s_-]*\d/i.test(base) ||
    /\d{4}[-_.]\d{2}[-_.]\d{2}|\d{8}[_-]\d{6}/.test(base);
  if (cameraName) return {};
  if (/^\d{8,14}$/.test(base)) return { codigo_barras: base };
  if (/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/i.test(base) && /\d/.test(base) && !/\s/.test(base)) return { sku: base.toUpperCase() };
  const name = nameFromFile(fileName);
  return name ? { nombre: name } : {};
}

export interface PhotoContext {
  dual: boolean;
  /** Moneda local (VES) en modo bimonetario. */
  localCurrency: string | null;
  /** Tasa Bs por $ (para pasar costos en Bs a $). */
  rate: number | null;
}

/** Convierte lo que leyó la IA de una foto en borradores. */
export function photoDrafts(reading: PhotoReading, file: File, index: number, mode: PhotoMode, ctx: PhotoContext): { drafts: Draft[]; notes: string[] } {
  const notes: string[] = [];
  const local = ctx.dual && !!ctx.localCurrency && reading.currency === ctx.localCurrency;
  if (local && !ctx.rate && reading.products.some((p) => p.costo > 0)) notes.push(`${file.name}: los costos están en Bs y no hay tasa de cambio para pasarlos a $.`);
  const drafts = reading.products.map((p, j) => {
    const values: DraftValues = {};
    if (p.nombre) values.nombre = p.nombre;
    if (p.marca) values.marca = p.marca;
    if (p.unidad) values.unidad = p.unidad;
    if (p.sku) values.sku = p.sku;
    if (/^\d{8,14}$/.test(p.codigo_barras)) values.codigo_barras = p.codigo_barras;
    if (p.precio > 0) {
      if (local) values.precio_bs = p.precio;
      else values.precio = p.precio;
    }
    if (p.costo > 0) {
      if (!local) values.costo = p.costo;
      else if (ctx.rate) values.costo = round2(p.costo / ctx.rate);
    }
    if (p.cantidad > 0) values.stock = p.cantidad;
    return {
      id: `P${index}-${j}`,
      origin: reading.products.length > 1 ? `${file.name} · renglón ${j + 1}` : file.name,
      values,
      image: mode === 'product' ? { blob: file, name: file.name } : null,
      aiCategory: p.categoria || undefined,
      fromAi: true
    } satisfies Draft;
  });
  return { drafts, notes };
}

/** Sin IA: una foto = un producto, con lo que diga el nombre del archivo. */
export function fileNameDraft(file: File, index: number): Draft {
  return { id: `P${index}-0`, origin: file.name, values: valuesFromFileName(file.name), image: { blob: file, name: file.name } };
}
