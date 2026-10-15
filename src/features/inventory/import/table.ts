/**
 * Dónde empieza la tabla de productos dentro de una hoja.
 *
 * Una lista de precios casi nunca empieza en A1: hay un logo, un título, la fecha, una fila en
 * blanco… y al final un TOTAL que no es un producto. Se prueba, en este orden:
 *  1. una Tabla de Excel declarada (su rango es la respuesta);
 *  2. la fila con más encabezados conocidos (Nombre, Precio, Stock…);
 *  3. la primera fila que se comporta como cabecera: varios textos cuyas columnas siguen
 *     rellenas en las filas de debajo;
 *  4. la primera fila con datos.
 */
import { columnLetter, type Sheet, type SheetRow } from '@/lib/xlsx';
import { headerScore } from './fields';
import { cellText, looksNumeric } from './numbers';
import type { Cell, ImportTable, TableRow } from './types';

/** Filas donde se busca la cabecera. */
const HEADER_SEARCH = 40;
/** Filas que tienen que confirmar a una cabecera candidata. */
const CONFIRM_ROWS = 5;

const filled = (c: Cell | undefined) => cellText(c) !== '';

function columnIndex(ref: string): number {
  let n = 0;
  for (const c of ref.replace(/\d+$/, '').toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

function slice(rows: SheetRow[], from: number, to: number, cols: number[]): TableRow[] {
  return rows
    .filter((r) => r.line >= from && r.line <= to)
    .map((r) => ({ line: r.line, cells: cols.map((c) => r.cells[c] ?? '') }))
    .filter((r) => r.cells.some(filled));
}

/** Quita filas de totales: "TOTAL", "Subtotal"… y una última fila casi vacía con un número mayor que todo lo de su columna. */
function dropTotals(rows: TableRow[]): { rows: TableRow[]; dropped: number[] } {
  const dropped: number[] = [];
  let out = rows.filter((r) => {
    const texts = r.cells.map(cellText).filter(Boolean);
    const first = texts[0] ?? '';
    if (texts.length <= 4 && /^(sub\s*-?\s*)?total(es)?\b|^gran total\b/i.test(first)) {
      dropped.push(r.line);
      return false;
    }
    return true;
  });
  if (out.length >= 3) {
    const last = out[out.length - 1];
    const content = last.cells.filter(filled);
    const numericCol = last.cells.findIndex((c) => filled(c) && looksNumeric(c));
    if (content.length <= 2 && numericCol >= 0) {
      const toNum = (c: Cell | undefined) => (typeof c === 'number' ? c : Number(cellText(c).replace(/[^\d.-]/g, '')) || 0);
      const max = Math.max(...out.slice(0, -1).map((r) => toNum(r.cells[numericCol])));
      if (toNum(last.cells[numericCol]) > max) {
        dropped.push(last.line);
        out = out.slice(0, -1);
      }
    }
  }
  return { rows: out, dropped };
}

function build(sheet: Sheet, headerRow: SheetRow | undefined, headerLine: number, lastLine: number, cols: number[], confidence: ImportTable['confidence']): ImportTable | null {
  const header = cols.map((c) => cellText(headerRow?.cells[c]) || `Columna ${columnLetter(c)}`);
  const { rows, dropped } = dropTotals(slice(sheet.rows, headerLine + 1, lastLine, cols));
  if (!rows.length) return null;
  const images = new Map([...sheet.images].filter(([line]) => line > headerLine && line <= lastLine));
  return { sheet: sheet.name, headerLine, header, rows, images, dropped, confidence };
}

/** Columnas de la tabla: las que tienen encabezado y las que, sin él, traen datos en al menos el 10 % de las filas. */
function columnsFor(sheet: Sheet, header: SheetRow): number[] {
  const below = sheet.rows.filter((r) => r.line > header.line);
  const width = Math.max(header.cells.length, ...below.slice(0, 200).map((r) => r.cells.length));
  const cols: number[] = [];
  for (let c = 0; c < width; c++) {
    if (filled(header.cells[c])) cols.push(c);
    else if (below.length && below.filter((r) => filled(r.cells[c])).length / below.length >= 0.1) cols.push(c);
  }
  return cols;
}

function fromDeclared(sheet: Sheet): ImportTable[] {
  const out: ImportTable[] = [];
  for (const range of sheet.tableRanges) {
    const [start, end] = range.split(':');
    if (!start || !end) continue;
    const headerLine = Number(start.replace(/^[A-Z]+/i, ''));
    const lastLine = Number(end.replace(/^[A-Z]+/i, ''));
    const cols: number[] = [];
    for (let c = columnIndex(start); c <= columnIndex(end); c++) cols.push(c);
    const t = build(
      sheet,
      sheet.rows.find((r) => r.line === headerLine),
      headerLine,
      lastLine,
      cols,
      'declared'
    );
    if (t) out.push(t);
  }
  return out;
}

function byAliases(sheet: Sheet, lastLine: number): ImportTable | null {
  let best: { row: SheetRow; score: number } | null = null;
  for (const row of sheet.rows.slice(0, HEADER_SEARCH)) {
    const score = headerScore(row.cells);
    if (score >= 2 && (!best || score > best.score)) best = { row, score };
  }
  return best ? build(sheet, best.row, best.row.line, lastLine, columnsFor(sheet, best.row), 'aliases') : null;
}

function byShape(sheet: Sheet, lastLine: number): ImportTable | null {
  for (const candidate of sheet.rows.slice(0, HEADER_SEARCH)) {
    const cols = candidate.cells.map((v, i) => ({ v, i })).filter(({ v }) => filled(v) && !looksNumeric(v)).map(({ i }) => i);
    if (cols.length < 2) continue;
    const next = sheet.rows.filter((r) => r.line > candidate.line).slice(0, CONFIRM_ROWS);
    if (!next.length) continue;
    // La cabecera de verdad es la fila cuyas columnas siguen rellenas debajo. Un título suelto
    // ("LISTA DE PRECIOS OCTUBRE") no cumple esto nunca.
    const confirmed = next.filter((r) => cols.filter((c) => filled(r.cells[c])).length >= cols.length * 0.6);
    if (confirmed.length < Math.min(2, next.length)) continue;
    const t = build(sheet, candidate, candidate.line, lastLine, columnsFor(sheet, candidate), 'heuristic');
    if (t) return t;
  }
  return null;
}

function firstRow(sheet: Sheet, lastLine: number): ImportTable | null {
  const header = sheet.rows.find((r) => r.cells.some(filled));
  return header ? build(sheet, header, header.line, lastLine, columnsFor(sheet, header), 'first-row') : null;
}

/** Tablas de productos de un libro, la más grande primero (es la propuesta; las demás se ofrecen). */
export function detectTables(sheets: Sheet[]): ImportTable[] {
  const out: ImportTable[] = [];
  for (const sheet of sheets) {
    if (sheet.hidden || !sheet.rows.length) continue;
    const declared = fromDeclared(sheet);
    if (declared.length) {
      out.push(...declared);
      continue;
    }
    const lastLine = sheet.rows[sheet.rows.length - 1].line;
    const t = byAliases(sheet, lastLine) ?? byShape(sheet, lastLine) ?? firstRow(sheet, lastLine);
    if (t) out.push(t);
  }
  return out.sort((a, b) => b.rows.length - a.rows.length);
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

/** Separador más probable mirando las primeras líneas: coma, punto y coma o tabulador (copiado de una hoja). */
function detectSeparator(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
  let best = ',';
  let bestScore = -1;
  for (const sep of [',', ';', '\t']) {
    const counts = lines.map((l) => l.split(sep).length - 1);
    const score = counts.filter((n) => n > 0).length * 1000 + counts.reduce((a, b) => a + b, 0);
    if (score > bestScore) {
      best = sep;
      bestScore = score;
    }
  }
  return best;
}

/** Parser CSV que conserva el número de línea de cada fila (para decir "fila 37" en los errores). */
export function parseCsvRows(text: string): SheetRow[] {
  const clean = text.replace(/^﻿/, '');
  const sep = detectSeparator(clean);
  const rows: SheetRow[] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;
  const push = () => {
    row.push(cell);
    if (row.some((c) => c.trim() !== '')) rows.push({ line: rowLine, cells: row.map((c) => c.trim()) });
    row = [];
    cell = '';
  };
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
    } else if (ch === '"') inQuotes = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      push();
      line++;
      rowLine = line;
    } else cell += ch;
  }
  if (cell !== '' || row.length) push();
  return rows;
}

export function tablesFromCsv(text: string): ImportTable[] {
  return detectTables([{ name: '', hidden: false, rows: parseCsvRows(text), tableRanges: [], images: new Map() }]);
}

/** Lee un archivo de texto probando UTF-8 y, si hay caracteres inválidos, Windows-1252 (CSV guardado desde Excel). */
export async function readTextFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const text = new TextDecoder('utf-8').decode(buf);
  if (!text.includes('�')) return text;
  try {
    return new TextDecoder('windows-1252').decode(buf);
  } catch {
    return text;
  }
}
