import type { CellValue } from '@/lib/xlsx';

/** Cómo se escribe el decimal en una columna: "1.234,56" (es) o "1,234.56" (en). */
export type NumberReading = 'es' | 'en';

/** Texto de una celda (los números de Excel sin notación científica: "7591234567890"). */
export function cellText(value: CellValue | undefined | null): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return Number.isInteger(value) && Math.abs(value) < 1e21 ? value.toFixed(0) : String(value);
  }
  return value.trim();
}

/**
 * Convierte texto a número tolerando símbolos de moneda y separadores locales
 * ("$1,234.50", "1.234,50", "12,5"). Devuelve null si está vacío y NaN si no es válido.
 * Los números que ya vienen como número (celdas de Excel) se devuelven tal cual.
 */
export function parseNumber(raw: CellValue | undefined | null): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : Number.NaN;
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

const BS_PREFIX = /^\s*(bs\.?\s*s?\.?|ves|bsf|bsd)\s*/i;
const BS_SUFFIX = /\s*(bs\.?\s*s?\.?|ves|bsf|bsd)\s*$/i;

/** Como `parseNumber`, pero quita antes el símbolo de bolívares ("Bs. 1.234,56", "1.234,56 Bs", "VES 50"), cuyo punto confundiría al separador decimal. */
export function parseLocalNumber(raw: CellValue | undefined | null): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : Number.NaN;
  let s = (raw ?? '').replace(BS_PREFIX, '').replace(BS_SUFFIX, '').trim();
  // En bolívares "1.234" o "1.234.567" son miles (formato venezolano), no decimales.
  if (!s.includes(',') && /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return parseNumber(s);
}

/** Lee un número sabiendo cómo escribe los decimales su columna. */
export function parseWithReading(raw: CellValue | undefined | null, reading: NumberReading | null, local = false): number | null {
  if (typeof raw === 'number' || !reading) return local ? parseLocalNumber(raw) : parseNumber(raw);
  let s = (raw ?? '').replace(BS_PREFIX, '').replace(BS_SUFFIX, '').trim();
  if (!s) return null;
  s = s.replace(/[^\d.,-]/g, '');
  if (!s || s === '-') return Number.NaN;
  s = reading === 'es' ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * Decide, mirando TODA la columna, si el decimal es coma o punto. Un solo "12,50" decide que el
 * "1.234" de la fila siguiente son mil doscientos, no uno coma dos. Devuelve null si no hay pistas.
 */
export function detectReading(values: CellValue[]): NumberReading | null {
  const texts = values.filter((v): v is string => typeof v === 'string').map((v) => v.replace(/[^\d.,-]/g, '')).filter((v) => /\d/.test(v));
  if (!texts.length) return null;
  const both = texts.find((v) => v.includes('.') && v.includes(','));
  if (both) return both.lastIndexOf(',') > both.lastIndexOf('.') ? 'es' : 'en';
  // Un separador seguido de 1 o 2 cifras al final es decimal; de exactamente 3, es de miles.
  const decimalWith = (sep: string) =>
    texts.some((v) => {
      const cut = v.lastIndexOf(sep);
      if (cut < 0) return false;
      const tail = v.slice(cut + 1);
      return tail.length === 1 || tail.length === 2;
    });
  if (decimalWith(',')) return 'es';
  if (decimalWith('.')) return 'en';
  return null;
}

/** ¿Parece un número (con o sin moneda)? */
export function looksNumeric(value: CellValue): boolean {
  if (typeof value === 'number') return true;
  const s = value.trim();
  return s !== '' && /^[\s$€£]*(bs\.?|ves|usd|us\$)?\s*-?[\d.,]+\s*(bs\.?|ves|usd|\$)?\s*$/i.test(s) && /\d/.test(s);
}
