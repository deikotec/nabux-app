/**
 * Lector de Excel (.xlsx / .xlsm) sin dependencias, en el navegador.
 *
 * Un .xlsx es un ZIP con XML dentro: con `DecompressionStream('deflate-raw')` y unos parsers
 * de cadena se lee entero sin sumar cientos de KB al bundle (misma decisión que el lector del
 * catálogo de bdee-flow, que hace lo mismo con `zlib` en el servidor).
 *
 * Además de las celdas recupera las FOTOS de los productos:
 *  - las que flotan sobre la hoja, ancladas a una celda (lo habitual en catálogos de proveedor);
 *  - las que Excel 365 coloca dentro de la celda («Colocar en celda» / función IMAGEN).
 *
 * No lee .xls (Excel 97-2003), .ods ni libros protegidos con contraseña: lo dice con un error
 * que se puede mostrar tal cual.
 */

export type XlsxErrorCode = 'NOT_ZIP' | 'LEGACY' | 'CORRUPT' | 'NOT_WORKBOOK' | 'NO_SHEETS';

/** Un fallo del archivo, no del código: el mensaje se muestra al usuario. */
export class XlsxError extends Error {
  readonly code: XlsxErrorCode;

  constructor(code: XlsxErrorCode, message: string) {
    super(message);
    this.name = 'XlsxError';
    this.code = code;
  }
}

/** Valor de celda: los números llegan como número (sin ambigüedad de separadores), el resto como texto. */
export type CellValue = string | number;

export interface SheetRow {
  /** Número de fila de Excel (base 1). */
  line: number;
  cells: CellValue[];
}

export interface SheetImage {
  blob: Blob;
  /** Nombre del archivo dentro del libro (ej. image12.png). */
  name: string;
}

export interface Sheet {
  name: string;
  hidden: boolean;
  rows: SheetRow[];
  /** Rangos de las Tablas de Excel declaradas ("A3:H250"). */
  tableRanges: string[];
  /** Foto de cada fila (número de fila de Excel → imagen). */
  images: Map<number, SheetImage>;
}

/* ------------------------------------------------------------------ */
/* ZIP                                                                 */
/* ------------------------------------------------------------------ */

interface ZipEntry {
  name: string;
  method: number;
  data: Uint8Array<ArrayBuffer>;
}

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
/** Firma de los documentos OLE: .xls de 97-2003 o un .xlsx cifrado con contraseña. */
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

const utf8 = new TextDecoder('utf-8');

function readZip(bytes: Uint8Array<ArrayBuffer>): Map<string, ZipEntry> {
  if (OLE_MAGIC.every((b, i) => bytes[i] === b)) {
    throw new XlsxError(
      'LEGACY',
      'Es un Excel antiguo (.xls) o un archivo protegido con contraseña. Ábrelo en Excel y usa «Guardar como» → Libro de Excel (.xlsx).'
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 22 || view.getUint32(0, true) !== SIG_LOCAL) {
    throw new XlsxError('NOT_ZIP', 'El archivo no es un Excel válido (.xlsx).');
  }

  // El directorio central está al final; el comentario del ZIP mide como mucho 64 KB.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66_000); i--) {
    if (view.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new XlsxError('CORRUPT', 'El archivo está dañado y no se puede abrir.');

  const total = view.getUint16(eocd + 10, true);
  let off = view.getUint32(eocd + 16, true);
  const entries = new Map<string, ZipEntry>();
  for (let n = 0; n < total; n++) {
    if (off + 46 > bytes.length || view.getUint32(off, true) !== SIG_CENTRAL) {
      throw new XlsxError('CORRUPT', 'El archivo está dañado y no se puede abrir.');
    }
    const method = view.getUint16(off + 10, true);
    const compressedSize = view.getUint32(off + 20, true);
    const nameLen = view.getUint16(off + 28, true);
    const extraLen = view.getUint16(off + 30, true);
    const commentLen = view.getUint16(off + 32, true);
    const local = view.getUint32(off + 42, true);
    const name = utf8.decode(bytes.subarray(off + 46, off + 46 + nameLen)).replace(/\\/g, '/');
    // El campo "extra" de la cabecera LOCAL puede medir distinto que el del directorio central:
    // usar el de la central desplaza el inicio de los datos (el error clásico de los lectores a mano).
    const localNameLen = view.getUint16(local + 26, true);
    const localExtraLen = view.getUint16(local + 28, true);
    const start = local + 30 + localNameLen + localExtraLen;
    entries.set(name.toLowerCase(), { name, method, data: bytes.subarray(start, start + compressedSize) });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflate(entry: ZipEntry): Promise<Uint8Array<ArrayBuffer>> {
  if (entry.method === 0) return entry.data;
  if (entry.method !== 8) throw new XlsxError('CORRUPT', 'El archivo usa una compresión que no se puede leer.');
  const stream = new Blob([entry.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* ------------------------------------------------------------------ */
/* XML                                                                 */
/* ------------------------------------------------------------------ */

/** Quita los prefijos de espacio de nombres de las etiquetas (`<x:row>` → `<row>`, `<xdr:pic>` → `<pic>`). */
function stripNs(xml: string): string {
  return xml.replace(/<(\/?)[A-Za-z_][\w.-]*:/g, '<$1');
}

function attr(attrs: string, name: string): string | undefined {
  const re = new RegExp(`(?:^|\\s)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`);
  const m = re.exec(attrs);
  return m ? (m[1] ?? m[2]) : undefined;
}

/** Atributo de relación (`r:id`, `r:embed`) sin depender del prefijo que eligió quien generó el archivo. */
function relAttr(attrs: string, local: 'id' | 'embed'): string | undefined {
  const m = new RegExp(`\\s[\\w.-]+:${local}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs);
  return m ? (m[1] ?? m[2]) : undefined;
}

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

/** Texto de todos los `<t>` de un fragmento (texto enriquecido partido en trozos), sin la guía fonética. */
function joinTexts(fragment: string): string {
  const clean = fragment.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  return [...clean.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => unescapeXml(t[1])).join('');
}

/** Resuelve un `Target` relativo al archivo que lo declara. */
function resolvePath(fromFile: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = fromFile.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

function relsPathOf(file: string): string {
  const parts = file.split('/');
  const name = parts.pop();
  return [...parts, '_rels', `${name}.rels`].join('/');
}

interface Rel {
  id: string;
  type: string;
  target: string;
}

/** "B12" → 1 (columna base 0). */
function columnIndex(ref: string): number {
  let n = 0;
  for (const c of ref.replace(/\d+$/, '').toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/** 0 → "A", 27 → "AB". */
export function columnLetter(index: number): string {
  let s = '';
  let n = index + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Libro                                                               */
/* ------------------------------------------------------------------ */

/** Formatos internos de Excel que son fechas sin decirlo en el código de formato. */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
/** Excel cuenta días desde el 30/12/1899. */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp'
};

/** Tope de fotos por libro: más allá, el navegador se queda sin memoria antes de subirlas. */
const MAX_IMAGES = 5000;
/** Altura por defecto de una fila (15 pt) en EMU; sirve para decidir a qué fila pertenece una foto. */
const DEFAULT_ROW_EMU = 190_500;

class Book {
  constructor(private readonly entries: Map<string, ZipEntry>) {}

  has(path: string) {
    return this.entries.has(path.toLowerCase());
  }

  async text(path: string): Promise<string> {
    const entry = this.entries.get(path.toLowerCase());
    if (!entry) return '';
    return stripNs(utf8.decode(await inflate(entry)));
  }

  async rels(ownerPath: string): Promise<Rel[]> {
    const xml = await this.text(relsPathOf(ownerPath));
    const out: Rel[] = [];
    for (const m of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
      const id = attr(m[1], 'Id');
      const target = attr(m[1], 'Target');
      if (!id || !target || attr(m[1], 'TargetMode') === 'External') continue;
      out.push({ id, type: attr(m[1], 'Type') ?? '', target: resolvePath(ownerPath, target) });
    }
    return out;
  }

  /** Imagen de la ruta dada, o null si el formato no se puede mostrar en el navegador (EMF, WMF, TIFF…). */
  async image(path: string): Promise<SheetImage | null> {
    const entry = this.entries.get(path.toLowerCase());
    if (!entry) return null;
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const type = IMAGE_TYPES[ext];
    if (!type) return null;
    const bytes = await inflate(entry);
    return { blob: new Blob([bytes], { type }), name: entry.name.split('/').pop() ?? entry.name };
  }
}

function readSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\s*\/>/g)].map((m) => (m[1] ? joinTexts(m[1]) : ''));
}

/** Índices de estilo de celda que pintan una fecha, para no devolver «45678». */
function readDateStyles(xml: string): Set<number> {
  const custom = new Set<number>();
  for (const m of xml.matchAll(/<numFmt\b([^>]*)\/?>/g)) {
    const id = Number(attr(m[1], 'numFmtId'));
    const code = unescapeXml(attr(m[1], 'formatCode') ?? '').replace(/\[[^\]]*\]|"[^"]*"/g, '');
    if (/[dmyh]/i.test(code)) custom.add(id);
  }
  const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? '';
  const styles = new Set<number>();
  let index = 0;
  for (const m of cellXfs.matchAll(/<xf\b([^>]*?)\/?>/g)) {
    const id = Number(attr(m[1], 'numFmtId') ?? '0');
    if (BUILTIN_DATE_FORMATS.has(id) || custom.has(id)) styles.add(index);
    index++;
  }
  return styles;
}

function serialToDate(serial: number): string {
  return new Date(EXCEL_EPOCH + Math.round(serial) * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Fotos «dentro de la celda» (Excel 365). La cadena es larga pero fija:
 * celda `vm` → metadata.xml (valueMetadata → futureMetadata) → valor enriquecido (rdrichvalue.xml)
 * → relación (richValueRel.xml) → archivo en xl/media.
 * Devuelve, para cada `vm` (base 1), la ruta de la imagen.
 */
async function readCellImageTargets(book: Book): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const metadata = await book.text('xl/metadata.xml');
  if (!metadata) return out;

  // Bloques de futureMetadata XLRICHVALUE: índice → índice del valor enriquecido.
  const future = /<futureMetadata\b[^>]*name="XLRICHVALUE"[^>]*>([\s\S]*?)<\/futureMetadata>/.exec(metadata)?.[1] ?? '';
  const richIndexByFuture = [...future.matchAll(/<bk>([\s\S]*?)<\/bk>/g)].map((m) => Number(/<rvb\b[^>]*\bi="(\d+)"/.exec(m[1])?.[1] ?? NaN));
  const valueMeta = /<valueMetadata\b[^>]*>([\s\S]*?)<\/valueMetadata>/.exec(metadata)?.[1] ?? '';
  const vmToRich = [...valueMeta.matchAll(/<bk>([\s\S]*?)<\/bk>/g)].map((m) => {
    const v = Number(/<rc\b[^>]*\bv="(\d+)"/.exec(m[1])?.[1] ?? NaN);
    return richIndexByFuture[v] ?? v;
  });

  // Estructuras: en qué posición viene el identificador de la imagen.
  const structures = [...(await book.text('xl/richData/rdrichvaluestructure.xml')).matchAll(/<s\b[^>]*>([\s\S]*?)<\/s>/g)].map((m) =>
    [...m[1].matchAll(/<k\b([^>]*)\/?>/g)].findIndex((k) => attr(k[1], 'n') === '_rvRel:LocalImageIdentifier')
  );
  const values = [...(await book.text('xl/richData/rdrichvalue.xml')).matchAll(/<rv\b([^>]*)>([\s\S]*?)<\/rv>/g)].map((m) => {
    const keyPos = structures[Number(attr(m[1], 's') ?? '0')] ?? 0;
    const vs = [...m[2].matchAll(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/g)].map((v) => v[1]);
    return keyPos >= 0 ? Number(vs[keyPos]) : NaN;
  });

  const relXmlPath = 'xl/richData/richValueRel.xml';
  const relIds = [...(await book.text(relXmlPath)).matchAll(/<rel\b([^>]*)\/?>/g)].map((m) => relAttr(m[1], 'id') ?? '');
  const relTargets = new Map((await book.rels(relXmlPath)).map((r) => [r.id, r.target]));

  vmToRich.forEach((rich, i) => {
    const relIndex = values[rich];
    if (!Number.isFinite(relIndex)) return;
    const target = relTargets.get(relIds[relIndex]);
    if (target) out.set(i + 1, target);
  });
  return out;
}

/** Fotos flotantes de un dibujo: fila (base 0) → { columna, ruta }. */
async function readDrawingImages(book: Book, drawingPath: string): Promise<{ row: number; col: number; target: string }[]> {
  const xml = await book.text(drawingPath);
  if (!xml) return [];
  const rels = new Map((await book.rels(drawingPath)).map((r) => [r.id, r.target]));
  const out: { row: number; col: number; target: string }[] = [];
  for (const m of xml.matchAll(/<(twoCellAnchor|oneCellAnchor)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const body = m[2];
    const from = /<from>([\s\S]*?)<\/from>/.exec(body)?.[1];
    if (!from) continue;
    const embed = /<blip\b([^>]*)\/?>/.exec(body);
    const target = embed ? rels.get(relAttr(embed[1], 'embed') ?? '') : undefined;
    if (!target) continue;
    let row = Number(/<row>(\d+)<\/row>/.exec(from)?.[1] ?? NaN);
    const col = Number(/<col>(\d+)<\/col>/.exec(from)?.[1] ?? 0);
    if (!Number.isFinite(row)) continue;
    // Una foto que empieza en la parte baja de una fila y se mete en la siguiente es de la siguiente.
    const rowOff = Number(/<rowOff>(-?\d+)<\/rowOff>/.exec(from)?.[1] ?? 0);
    const to = /<to>([\s\S]*?)<\/to>/.exec(body)?.[1];
    const toRow = to ? Number(/<row>(\d+)<\/row>/.exec(to)?.[1] ?? row) : row;
    if (toRow > row && rowOff > DEFAULT_ROW_EMU / 2) row += 1;
    out.push({ row, col, target });
  }
  return out;
}

/**
 * Lee un libro de Excel completo: hojas, celdas (números como número) y fotos por fila.
 * Lanza `XlsxError` con un mensaje legible si el archivo no se puede leer.
 */
export async function readWorkbook(buffer: ArrayBuffer): Promise<Sheet[]> {
  const book = new Book(readZip(new Uint8Array(buffer)));
  const workbookPath = 'xl/workbook.xml';
  const workbook = await book.text(workbookPath);
  if (!workbook) throw new XlsxError('NOT_WORKBOOK', 'El archivo no es un libro de Excel.');

  const relList = await book.rels(workbookPath);
  const wbRels = new Map(relList.map((r) => [r.id, r.target]));
  const sstPath = relList.find((r) => r.type.endsWith('/sharedStrings'))?.target ?? 'xl/sharedStrings.xml';
  const stylesPath = relList.find((r) => r.type.endsWith('/styles'))?.target ?? 'xl/styles.xml';
  const shared = readSharedStrings(await book.text(sstPath));
  const dateStyles = readDateStyles(await book.text(stylesPath));
  const cellImages = await readCellImageTargets(book);
  let imageCount = 0;

  const sheets: Sheet[] = [];
  for (const s of workbook.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const attrs = s[1];
    const path = wbRels.get(relAttr(attrs, 'id') ?? '');
    if (!path || !book.has(path)) continue;
    const xml = await book.text(path);
    if (!xml) continue;

    const rows: SheetRow[] = [];
    /** Fila (base 1) → { columna, ruta } de las fotos dentro de celda. */
    const inCell = new Map<number, { col: number; target: string }>();
    let lastLine = 0;
    const sheetData = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml)?.[1] ?? '';
    for (const r of sheetData.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const line = Number(attr(r[1], 'r') ?? lastLine + 1);
      lastLine = line;
      if (!r[2]) continue;
      const cells: CellValue[] = [];
      let lastCol = -1;
      for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const cAttrs = c[1];
        const body = c[2] ?? '';
        const ref = attr(cAttrs, 'r');
        const col = ref ? columnIndex(ref) : lastCol + 1;
        lastCol = col;
        const vm = attr(cAttrs, 'vm');
        if (vm) {
          const target = cellImages.get(Number(vm));
          if (target && !inCell.has(line)) inCell.set(line, { col, target });
        }
        const type = attr(cAttrs, 't') ?? 'n';
        const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let value: CellValue;
        if (type === 's') value = shared[Number(v)] ?? '';
        else if (type === 'inlineStr') value = joinTexts(body);
        else if (type === 'str') value = unescapeXml(v ?? '');
        else if (type === 'e') value = ''; // #¡REF!, #N/A, #¡VALOR!: no es un dato
        else if (type === 'b') value = v === '1' ? 'si' : 'no';
        else if (type === 'd') value = (v ?? '').slice(0, 10);
        else if (v === undefined || v.trim() === '') value = '';
        else {
          const n = Number(v);
          if (!Number.isFinite(n)) value = unescapeXml(v);
          else if (dateStyles.has(Number(attr(cAttrs, 's') ?? '-1'))) value = serialToDate(n);
          // 12.300000000000001 → 12.3 (ruido de coma flotante de Excel).
          else value = Number(n.toPrecision(15));
        }
        cells[col] = value;
      }
      // Los huecos de un array disperso rompen map/filter más arriba.
      for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = '';
      rows.push({ line, cells });
    }

    const sheetRels = await book.rels(path);
    const tableRanges: string[] = [];
    for (const rel of sheetRels.filter((x) => x.type.endsWith('/table'))) {
      const ref = /<table\b[^>]*\bref="([^"]*)"/.exec(await book.text(rel.target))?.[1];
      if (ref) tableRanges.push(ref);
    }

    // Fotos: primero las de dentro de la celda, luego las flotantes. Una por fila (la de más a la izquierda).
    const byRow = new Map<number, { col: number; target: string }>();
    for (const [line, img] of inCell) byRow.set(line, img);
    for (const rel of sheetRels.filter((x) => x.type.endsWith('/drawing'))) {
      for (const img of await readDrawingImages(book, rel.target)) {
        const line = img.row + 1;
        const prev = byRow.get(line);
        if (!prev || img.col < prev.col) byRow.set(line, { col: img.col, target: img.target });
      }
    }
    const images = new Map<number, SheetImage>();
    for (const [line, { target }] of byRow) {
      if (imageCount >= MAX_IMAGES) break;
      const img = await book.image(target);
      if (img) {
        images.set(line, img);
        imageCount++;
      }
    }

    sheets.push({
      name: unescapeXml(attr(attrs, 'name') ?? `Hoja ${sheets.length + 1}`),
      hidden: /state\s*=\s*"(hidden|veryHidden)"/.test(attrs),
      rows,
      tableRanges,
      images
    });
  }

  if (!sheets.length) throw new XlsxError('NO_SHEETS', 'El libro no tiene ninguna hoja con datos.');
  return sheets;
}
