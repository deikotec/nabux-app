import type { CellValue, SheetImage } from '@/lib/xlsx';
import type { Product, ProductInput } from '@/types';
import type { ImportField } from '../helpers';
import type { NumberReading } from './numbers';

export type Cell = CellValue;

/** Campo del producto al que puede ir una columna. `imagen` = enlace a una foto. */
export type FieldKey = ImportField | 'imagen';
export type Target = FieldKey | 'ignorar';

export interface TableRow {
  /** Número de fila en el archivo (base 1). */
  line: number;
  cells: Cell[];
}

/** La tabla de productos encontrada dentro de un archivo. */
export interface ImportTable {
  /** Hoja de Excel ("" en CSV). */
  sheet: string;
  headerLine: number;
  header: string[];
  rows: TableRow[];
  /** Foto incrustada de cada fila (número de fila → imagen). */
  images: Map<number, SheetImage>;
  /** Filas descartadas por parecer totales. */
  dropped: number[];
  /** Cómo se encontró la cabecera: tabla de Excel declarada, por nombres conocidos o por forma. */
  confidence: 'declared' | 'aliases' | 'heuristic' | 'first-row';
}

/** Lo que se sabe de una columna mirando sus datos. */
export interface ColumnInfo {
  index: number;
  header: string;
  /** Hasta 3 valores de ejemplo distintos. */
  samples: string[];
  filled: number;
  unique: number;
  /** Valores que parecen números. */
  numeric: number;
  /** Casi todo son códigos EAN/UPC (8 a 14 dígitos). */
  barcodeLike: boolean;
  /** Casi todo son enlaces http(s). */
  urlLike: boolean;
  /** Máximo de palabras en un valor (los nombres de producto tienen varias). */
  maxWords: number;
  reading: NumberReading | null;
}

export type MappingSource = 'alias' | 'guess' | 'ai' | 'user' | 'none';

export interface ColumnMapping {
  target: Target;
  source: MappingSource;
  /** La cabecera habla de una tasa ("IVA 16%"): 0 = exento, >0 = gravado. */
  rateLike?: boolean;
}

export type DraftValues = Partial<Record<FieldKey, Cell>>;

/** Un producto tal como viene del archivo (o de la IA), antes de validarlo. */
export interface Draft {
  id: string;
  /** "Fila 12", "lista.jpg", … */
  origin: string;
  values: DraftValues;
  image: SheetImage | null;
  /** Categoría propuesta por la IA (solo se usa si el archivo no trae una). */
  aiCategory?: string;
  /** Los datos los leyó la IA de una foto: conviene revisarlos. */
  fromAi?: boolean;
}

export type RowStatus = 'new' | 'update' | 'skip' | 'error';

export type CategorySource = 'file' | 'ai' | 'default' | 'keep';

export interface ImportRow {
  draft: Draft;
  /** Valores efectivos (archivo + correcciones del usuario). */
  values: DraftValues;
  status: RowStatus;
  /** Errores (la fila no se importa) o motivo de omisión. */
  problems: string[];
  /** Avisos informativos. */
  notes: string[];
  /** Producto resultante: el nuevo, o el existente con los cambios aplicados. */
  input: ProductInput;
  existing?: Product;
  /** Cambios sobre el producto existente (status update). */
  patch?: Partial<ProductInput>;
  /** Etiquetas de lo que cambia ("precio", "costo", "foto"…). */
  changes: string[];
  /** Cambio de stock sobre el existente (status update). */
  stockDelta?: number;
  /** Precio en Bs del archivo, si el precio en $ se calculó a partir de él. */
  fromLocal?: number;
  /** El precio se calculó desde el costo con el margen indicado. */
  autoPriced?: boolean;
  categorySource: CategorySource;
}

export interface ImportOptions {
  /** Qué hacer con los productos que ya existen (mismo SKU, código de barras o nombre). */
  existing: 'skip' | 'update';
  /** Al actualizar: no tocar el stock, sumarlo como entrada o reemplazarlo (conteo). */
  stockMode: 'keep' | 'add' | 'set';
  /** Margen (%) para calcular el precio de venta desde el costo cuando falta; null = no calcular. */
  autoPriceMargin: number | null;
  /** Usar las categorías propuestas por la IA para los productos sin categoría. */
  useAiCategories: boolean;
  /** Renombres de categorías hechos en la revisión (clave normalizada → nombre nuevo). */
  renames: Record<string, string>;
}
