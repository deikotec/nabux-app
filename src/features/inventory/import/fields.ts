/**
 * Qué es cada columna del archivo.
 *
 * La regla, heredada del importador de bdee-flow: los NOMBRES de las columnas (o la IA) proponen
 * qué es cada una, y los DATOS tienen la última palabra. Una columna llamada «Precio» con textos
 * como «Consultar» no es un precio, y un «Código» lleno de números de 13 cifras es un código de barras.
 */
import { normalize } from '@/lib/utils';
import { cellText, detectReading, looksNumeric } from './numbers';
import type { Cell, ColumnInfo, ColumnMapping, FieldKey, ImportTable, Target } from './types';

interface FieldDef {
  key: FieldKey;
  numeric?: boolean;
  /** Encabezados que apuntan a este campo, de más a menos específicos (sin acentos). */
  aliases: string[];
  /** Palabras que, si aparecen en la cabecera, descartan este campo ("precio costo" no es el precio de venta). */
  exclude?: string[];
}

const FIELDS: FieldDef[] = [
  {
    key: 'nombre',
    aliases: [
      'nombre',
      'nombre del producto',
      'nombre producto',
      'producto',
      'descripcion',
      'descripcion del producto',
      'articulo',
      'item',
      'concepto',
      'detalle',
      'mercancia',
      'name',
      'product',
      'description'
    ],
    exclude: ['codigo', 'cod', 'categoria', 'marca', 'proveedor', 'unidad', 'precio', 'costo']
  },
  {
    key: 'sku',
    aliases: ['sku', 'codigo interno', 'cod interno', 'codigo producto', 'cod producto', 'codigo articulo', 'cod articulo', 'referencia', 'ref', 'clave', 'item code', 'part number']
  },
  {
    key: 'codigo_barras',
    aliases: ['codigo de barras', 'codigo barras', 'cod barras', 'cod de barras', 'barcode', 'ean', 'ean13', 'upc', 'gtin']
  },
  {
    key: 'categoria',
    aliases: ['categoria', 'category', 'familia', 'departamento', 'rubro', 'seccion', 'grupo', 'linea', 'clase', 'subcategoria']
  },
  { key: 'marca', aliases: ['marca', 'brand', 'fabricante', 'laboratorio'] },
  { key: 'unidad', aliases: ['unidad', 'unidad de medida', 'um', 'u m', 'medida', 'unit', 'uom'], exclude: ['precio', 'costo', 'cantidad', 'stock'] },
  {
    key: 'costo',
    numeric: true,
    aliases: [
      'costo',
      'precio costo',
      'precio de costo',
      'precio compra',
      'precio de compra',
      'costo unitario',
      'costo proveedor',
      'p costo',
      'cost',
      'compra',
      'costo usd'
    ],
    exclude: ['bs', 'bolivares', 'ves', 'total']
  },
  {
    key: 'precio',
    numeric: true,
    aliases: [
      'precio',
      'precio venta',
      'precio de venta',
      'pvp',
      'p v p',
      'precio publico',
      'precio al publico',
      'precio detal',
      'precio al detal',
      'detal',
      'precio unitario',
      'precio usd',
      'precio sugerido',
      'price',
      'venta',
      'tarifa'
    ],
    exclude: ['costo', 'compra', 'bs', 'bolivar', 'bolivares', 'ves', 'mayor', 'mayorista', 'total']
  },
  {
    key: 'precio_bs',
    numeric: true,
    aliases: ['precio bs', 'precio en bs', 'precio bolivares', 'precio en bolivares', 'precio ves', 'pvp bs', 'precio bs s', 'monto bs', 'bolivares', 'bs'],
    exclude: ['costo', 'compra', 'mayor', 'total']
  },
  {
    key: 'stock',
    numeric: true,
    aliases: ['stock', 'existencia', 'existencias', 'cantidad', 'cant', 'qty', 'inventario', 'stock inicial', 'stock actual', 'disponible', 'unidades disponibles'],
    exclude: ['minimo', 'min', 'reorden']
  },
  {
    key: 'stock_minimo',
    numeric: true,
    aliases: ['stock minimo', 'stock min', 'stock_minimo', 'minimo', 'min', 'existencia minima', 'punto de reorden', 'reorden']
  },
  { key: 'ubicacion', aliases: ['ubicacion', 'location', 'pasillo', 'estante', 'anaquel', 'ubicacion en bodega'] },
  { key: 'proveedor', aliases: ['proveedor', 'supplier', 'distribuidor', 'vendor'] },
  { key: 'exento', aliases: ['exento', 'exento iva', 'exento de iva', 'iva exento', 'exempt', 'tax exempt'] },
  { key: 'imagen', aliases: ['imagen', 'foto', 'url imagen', 'imagen url', 'link imagen', 'url foto', 'image', 'img', 'picture', 'photo', 'url', 'link'] }
];

/** Cabeceras que hablan de una tasa de impuesto: van a "exento" con 0 = exento. */
const RATE_ALIASES = ['iva', 'impuesto', 'alicuota', 'tasa iva', 'iva %', 'tax'];
/** "Código" a secas: es código de barras o SKU según lo que contenga. */
const GENERIC_CODE = ['codigo', 'cod', 'code', 'cod art'];
/** Último recurso para el precio cuando ninguna columna se llama así. */
const PRICE_FALLBACK = ['importe', 'monto', 'valor', 'neto', 'precio neto'];

/** Etiquetas para la pantalla. */
export function fieldLabel(key: Target, opts: { dual?: boolean; taxName?: string } = {}): string {
  switch (key) {
    case 'nombre':
      return 'Nombre del producto';
    case 'sku':
      return 'SKU / código interno';
    case 'codigo_barras':
      return 'Código de barras';
    case 'categoria':
      return 'Categoría';
    case 'marca':
      return 'Marca';
    case 'unidad':
      return 'Unidad';
    case 'costo':
      return opts.dual ? 'Costo ($)' : 'Costo';
    case 'precio':
      return opts.dual ? 'Precio de venta ($)' : 'Precio de venta';
    case 'precio_bs':
      return 'Precio de venta (Bs)';
    case 'stock':
      return 'Stock / cantidad';
    case 'stock_minimo':
      return 'Stock mínimo';
    case 'ubicacion':
      return 'Ubicación';
    case 'proveedor':
      return 'Proveedor';
    case 'exento':
      return `Exento de ${opts.taxName || 'IVA'}`;
    case 'imagen':
      return 'Foto (enlace)';
    default:
      return 'No importar';
  }
}

export const NUMERIC_FIELDS = new Set<FieldKey>(FIELDS.filter((f) => f.numeric).map((f) => f.key));

/** Campos que aplican a este negocio. */
export function availableFields(opts: { dual?: boolean; exempt?: boolean }): FieldKey[] {
  return FIELDS.map((f) => f.key).filter((k) => (k !== 'precio_bs' || opts.dual) && (k !== 'exento' || opts.exempt));
}

/** "Precio de Venta ($)" → "precio de venta". */
function words(text: string): string {
  return normalize(text).replace(/[^a-z0-9%]+/g, ' ').trim();
}

function contains(header: string, alias: string): boolean {
  return ` ${header} `.includes(` ${alias} `);
}

/** Puntuación de una cabecera para un campo: >=1000 coincidencia exacta, >=100 contiene el alias, 0 nada. */
function aliasScore(header: string, aliases: string[], exclude: string[] = []): number {
  if (!header) return 0;
  if (exclude.some((x) => contains(header, x))) return 0;
  let best = 0;
  aliases.forEach((alias, i) => {
    if (header === alias) best = Math.max(best, 1000 - i);
    else if (contains(header, alias)) best = Math.max(best, 100 + alias.length * 2 - i * 0.1);
  });
  return best;
}

/** ¿Cuántas celdas de esta fila parecen nombres de columna conocidos? Sirve para encontrar la cabecera. */
export function headerScore(cells: Cell[]): number {
  let n = 0;
  for (const c of cells) {
    if (typeof c !== 'string') continue;
    const h = words(c);
    if (!h || h.length > 40) continue;
    if (FIELDS.some((f) => aliasScore(h, f.aliases) > 0) || RATE_ALIASES.includes(h) || GENERIC_CODE.includes(h)) n++;
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* Análisis de columnas                                                */
/* ------------------------------------------------------------------ */

export function analyzeColumns(table: ImportTable): ColumnInfo[] {
  return table.header.map((header, index) => {
    const values = table.rows.map((r) => r.cells[index] ?? '');
    const texts = values.map(cellText);
    const filledTexts = texts.filter((t) => t !== '');
    const samples: string[] = [];
    for (const t of filledTexts) {
      if (!samples.includes(t)) samples.push(t.length > 48 ? `${t.slice(0, 47)}…` : t);
      if (samples.length >= 3) break;
    }
    const filled = filledTexts.length;
    const share = (pred: (t: string) => boolean) => (filled ? filledTexts.filter(pred).length / filled : 0);
    return {
      index,
      header,
      samples,
      filled,
      unique: new Set(filledTexts.map((t) => t.toLowerCase())).size,
      numeric: values.filter((v) => cellText(v) !== '' && looksNumeric(v)).length,
      barcodeLike: filled > 0 && share((t) => /^\d{8,14}$/.test(t)) >= 0.8,
      urlLike: filled > 0 && share((t) => /^https?:\/\/\S+$/i.test(t)) >= 0.5,
      maxWords: filledTexts.reduce((max, t) => Math.max(max, t.split(/\s+/).length), 0),
      reading: detectReading(values)
    };
  });
}

/** ¿Los datos de la columna encajan con el campo? */
export function fitsData(field: FieldKey, info: ColumnInfo): boolean {
  if (info.filled === 0) return true;
  const numericShare = info.numeric / info.filled;
  if (NUMERIC_FIELDS.has(field)) return numericShare >= 0.6;
  if (field === 'nombre') return numericShare < 0.5;
  if (field === 'imagen') return info.urlLike;
  if (field === 'codigo_barras') return info.barcodeLike || numericShare >= 0.8;
  return true;
}

/**
 * Propone qué es cada columna a partir de los encabezados y los datos.
 * Cada campo se asigna a una sola columna (la de mejor coincidencia).
 */
export function autoMap(infos: ColumnInfo[], allowed: FieldKey[]): ColumnMapping[] {
  const mapping: ColumnMapping[] = infos.map(() => ({ target: 'ignorar', source: 'none' }));
  const candidates: { col: number; field: FieldKey; score: number; rateLike?: boolean }[] = [];
  for (const info of infos) {
    const h = words(info.header);
    // Una columna sin datos no aporta nada (ej. "Foto" cuando las fotos flotan sobre la hoja).
    if (!h || info.filled === 0) continue;
    for (const f of FIELDS) {
      if (!allowed.includes(f.key)) continue;
      const score = aliasScore(h, f.aliases, f.exclude);
      if (score > 0 && fitsData(f.key, info)) candidates.push({ col: info.index, field: f.key, score });
    }
    if (allowed.includes('exento')) {
      const score = aliasScore(h, RATE_ALIASES, ['precio', 'costo', 'monto', 'total']);
      if (score > 0) candidates.push({ col: info.index, field: 'exento', score: score - 50, rateLike: true });
    }
    const generic = aliasScore(h, GENERIC_CODE, ['barras', 'proveedor', 'categoria', 'familia']);
    if (generic > 0) {
      const field: FieldKey = info.barcodeLike ? 'codigo_barras' : 'sku';
      if (allowed.includes(field)) candidates.push({ col: info.index, field, score: generic - 1 });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.col - b.col);
  const taken = new Set<FieldKey>();
  for (const c of candidates) {
    if (taken.has(c.field) || mapping[c.col].target !== 'ignorar') continue;
    mapping[c.col] = { target: c.field, source: c.score >= 1000 ? 'alias' : 'guess', rateLike: c.rateLike };
    taken.add(c.field);
  }

  // Sin columna de nombre: la de texto con más palabras (sin nombre no hay producto, y si se
  // equivoca se ve enseguida en la vista previa).
  if (!taken.has('nombre')) {
    const best = infos
      .filter((i) => mapping[i.index].target === 'ignorar' && i.filled > 0 && i.numeric / i.filled < 0.3 && !i.urlLike)
      .sort((a, b) => b.maxWords - a.maxWords || b.unique - a.unique)[0];
    if (best && best.maxWords >= 2) mapping[best.index] = { target: 'nombre', source: 'guess' };
  }

  // Sin ningún precio: "Importe", "Monto" o "Valor" (en una factura serían totales, por eso no
  // son alias del precio) se proponen como precio si son numéricos. Se ve en la revisión.
  if (!mapping.some((m) => m.target === 'precio' || m.target === 'precio_bs' || m.target === 'costo') && allowed.includes('precio')) {
    const best = infos.find(
      (i) => mapping[i.index].target === 'ignorar' && aliasScore(words(i.header), PRICE_FALLBACK, ['total', 'subtotal']) > 0 && fitsData('precio', i) && i.filled > 0
    );
    if (best) mapping[best.index] = { target: 'precio', source: 'guess' };
  }
  return mapping;
}

/**
 * Une lo que propuso la IA con lo detectado: la IA decide en las columnas dudosas, pero no
 * contra una coincidencia exacta de encabezado ni contra los datos (un precio tiene que ser número).
 */
export function mergeAiMapping(current: ColumnMapping[], ai: { index: number; target: Target }[], infos: ColumnInfo[], allowed: FieldKey[]): ColumnMapping[] {
  const next = current.map((m) => ({ ...m }));
  const strong = new Set(next.filter((m) => m.source === 'alias' || m.source === 'user').map((m) => m.target));
  for (const { index, target } of ai) {
    const cur = next[index];
    const info = infos[index];
    if (!cur || !info || cur.source === 'alias' || cur.source === 'user') continue;
    if (target === cur.target) {
      next[index] = { ...cur, source: 'ai' };
      continue;
    }
    if (target !== 'ignorar') {
      if (!allowed.includes(target) || strong.has(target) || !fitsData(target, info)) continue;
      // El campo lo tenía otra columna adivinada: se le quita.
      next.forEach((m, i) => {
        if (i !== index && m.target === target && m.source !== 'alias' && m.source !== 'user') next[i] = { target: 'ignorar', source: 'ai' };
      });
    }
    next[index] = { target, source: 'ai', rateLike: target === 'exento' ? cur.rateLike : undefined };
  }
  return next;
}

/** Campos obligatorios que faltan en el mapeo. */
export function missingRequired(mapping: ColumnMapping[], opts: { dual?: boolean }): string[] {
  const has = (k: FieldKey) => mapping.some((m) => m.target === k);
  const out: string[] = [];
  if (!has('nombre')) out.push(fieldLabel('nombre'));
  if (!has('precio') && !has('precio_bs') && !has('costo')) out.push(opts.dual ? 'Precio de venta ($ o Bs)' : fieldLabel('precio'));
  return out;
}
