import { formatNumber } from '@/lib/format';
import { round2 } from '@/lib/utils';
import type { Product } from '@/types';
import type { CartLine, LineStockState, TicketDiscount } from './types';

/** Productos visibles en el grid antes de "Mostrar más". */
export const GRID_PAGE_SIZE = 60;

/** Unidades que admiten cantidades con decimales (granel). */
const DECIMAL_UNITS = new Set(['kg', 'litro', 'metro']);

export function allowsDecimalQty(unit: string | undefined | null): boolean {
  return DECIMAL_UNITS.has((unit ?? '').trim().toLowerCase());
}

/** Redondea cantidades a 3 decimales (gramos / mililitros). */
export function roundQty(n: number): number {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

/**
 * Interpreta la entrada rápida del escáner/teclado.
 * Soporta multiplicador "3*CODIGO" (o "1.5*CODIGO" para granel).
 */
export function parseScanInput(raw: string): { qty: number; code: string } {
  const text = raw.trim();
  const m = text.match(/^(\d+(?:[.,]\d+)?)\s*\*\s*(.+)$/);
  if (m) {
    const qty = Number(m[1].replace(',', '.'));
    const code = m[2].trim();
    if (qty > 0 && code) return { qty: roundQty(qty), code };
  }
  return { qty: 1, code: text };
}

/**
 * Billetes rápidos: los 3 redondeos superiores "naturales" del total
 * (1-2-5 × 10ⁿ, sin pasos ridículamente pequeños). Ej: 16.90 → 20, 50, 100.
 * Funciona igual para monedas de valores altos (COP, CLP, PYG…).
 */
export function quickCashOptions(total: number, count = 3): number[] {
  const t = round2(total);
  if (!(t > 0)) return [];
  const out: number[] = [];
  for (let exp = 0; out.length < count && exp < 13; exp++) {
    for (const mult of [1, 2, 5]) {
      const step = mult * 10 ** exp;
      if (step < t / 4) continue;
      const value = Math.ceil(t / step - 1e-9) * step;
      if (value > t + 0.004 && !out.includes(value)) out.push(value);
      if (out.length >= count) break;
    }
  }
  return out.sort((a, b) => a - b);
}

/** Convierte el descuento capturado a monto, con tope por % máximo permitido. */
export function discountToAmount(discount: TicketDiscount | null, gross: number, maxPct: number): number {
  if (!discount || !(gross > 0) || !(maxPct > 0)) return 0;
  const raw = discount.mode === 'pct' ? (gross * discount.value) / 100 : discount.value;
  const cap = (gross * maxPct) / 100;
  return round2(Math.max(0, Math.min(raw, cap, gross)));
}

/** Estado de stock de una línea del ticket (después de vender la cantidad del ticket). */
export function lineStockState(line: CartLine, product: Product | undefined, allowNegative: boolean): LineStockState {
  if (!line.productId) return { tone: 'free', label: 'Monto libre', detail: 'Artículo no catalogado: no descuenta inventario' };
  if (!product || product.active === false) {
    return { tone: 'gone', label: 'No disponible', detail: 'El producto fue eliminado o desactivado del catálogo' };
  }
  const stock = Number(product.stock) || 0;
  if (line.qty > stock) {
    return allowNegative
      ? { tone: 'low', label: 'Stock negativo', detail: `Solo hay ${formatNumber(stock)} disponibles; el stock quedará en negativo` }
      : { tone: 'over', label: 'Excede stock', detail: `Solo hay ${formatNumber(stock)} disponibles` };
  }
  const left = stock - line.qty;
  if (left <= (Number(product.minStock) || 0)) {
    return { tone: 'low', label: 'Bajo stock', detail: `Quedarán ${formatNumber(left)} después de esta venta (mínimo ${formatNumber(product.minStock)})` };
  }
  return { tone: 'ok', label: 'Stock OK', detail: `Quedarán ${formatNumber(left)} después de esta venta` };
}

export function newId(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** ¿El foco está en un campo donde el usuario escribe? */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Marca que identifica el panel de ticket en el modal móvil (no bloquea atajos). */
export const POS_SHEET_ATTR = 'data-pos-sheet';

/** Hay algún diálogo abierto (el que sea). */
export function anyDialogOpen(): boolean {
  return !!document.querySelector('[role="dialog"]');
}

/** Hay un diálogo abierto distinto del panel de ticket móvil. */
export function blockingDialogOpen(): boolean {
  return Array.from(document.querySelectorAll('[role="dialog"]')).some((d) => !d.querySelector(`[${POS_SHEET_ATTR}]`));
}

/** Monedas cuyo símbolo de Intl está desactualizado (VES → "Bs.S"): se formatean a mano. */
const BILL_SYMBOLS: Record<string, string> = { VES: 'Bs.' };

/** Formato de billete sin decimales cuando el monto es entero ($20, $1,000, Bs. 12.000). */
export function formatBill(amount: number, currency: string, locale: string): string {
  const whole = Number.isInteger(amount);
  const digits = { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 };
  try {
    const symbol = BILL_SYMBOLS[currency];
    if (symbol) return `${symbol} ${new Intl.NumberFormat(locale, digits).format(amount)}`;
    return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', ...digits }).format(amount);
  } catch {
    return String(amount);
  }
}

/* ------------------------------------------------------------------ */
/* Captura de montos según el idioma (es-VE: 1.234,56 · es-MX: 1,234.56) */
/* ------------------------------------------------------------------ */

const separatorCache = new Map<string, { decimal: string; group: string }>();

export function numberSeparators(locale: string): { decimal: string; group: string } {
  let s = separatorCache.get(locale);
  if (!s) {
    let decimal = '.';
    let group = ',';
    try {
      const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
      decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.';
      group = parts.find((p) => p.type === 'group')?.value ?? (decimal === ',' ? '.' : ',');
    } catch {
      /* locale inválido: formato inglés */
    }
    s = { decimal, group };
    separatorCache.set(locale, s);
  }
  return s;
}

/**
 * Interpreta un monto escrito por el cajero, tolerante al separador:
 * - con punto y coma, el último es el decimal ("1.234,56" o "1,234.56");
 * - un separador repetido es de miles ("1.234.567");
 * - un único separador de miles del idioma seguido de 3 dígitos es de miles (es-VE: "11.753" = 11753),
 *   salvo con `thousands: false` (tasas: "879.123" = 879,123);
 * - en otro caso es el decimal ("12.5", "12,5").
 * Devuelve null si no hay número.
 */
export function parseAmount(raw: string, locale: string, opts: { maxDecimals?: number; thousands?: boolean } = {}): number | null {
  const { maxDecimals = 2, thousands = true } = opts;
  const s = raw.trim().replace(/\s/g, '');
  if (!/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let intPart = s;
  let frac = '';
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = Math.max(lastDot, lastComma);
    intPart = s.slice(0, dec);
    frac = s.slice(dec + 1);
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const idx = Math.max(lastDot, lastComma);
    const count = s.split(sep).length - 1;
    const after = s.length - idx - 1;
    const isGroup = count > 1 || (thousands && sep === numberSeparators(locale).group && after === 3);
    if (!isGroup) {
      intPart = s.slice(0, idx);
      frac = s.slice(idx + 1);
    }
  }
  const n = Number(`${intPart.replace(/[.,]/g, '') || '0'}.${frac.replace(/[.,]/g, '') || '0'}`);
  if (!Number.isFinite(n)) return null;
  const f = 10 ** maxDecimals;
  return Math.round(n * f) / f;
}

/** Texto para mostrar un monto en un campo editable ("11.753,84" en es-VE). */
export function formatAmountInput(value: number | '' | null | undefined, locale: string, maxDecimals = 2): string {
  if (value === '' || value === null || value === undefined || !Number.isFinite(value)) return '';
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(2, maxDecimals),
      maximumFractionDigits: maxDecimals
    }).format(value);
  } catch {
    return String(value);
  }
}

/** Importe de las líneas exentas de impuesto, después del descuento (moneda base). */
export function exemptAmount(lines: Pick<CartLine, 'unitPrice' | 'qty' | 'taxExempt'>[], discount: number): number {
  const gross = lines.reduce((acc, l) => acc + l.unitPrice * l.qty, 0);
  if (!(gross > 0)) return 0;
  const exempt = lines.reduce((acc, l) => acc + (l.taxExempt ? l.unitPrice * l.qty : 0), 0);
  const factor = (gross - Math.min(Math.max(0, discount || 0), gross)) / gross;
  return round2(exempt * factor);
}
