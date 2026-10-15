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

/** Formato de billete sin decimales cuando el monto es entero ($20, $1,000). */
export function formatBill(amount: number, currency: string, locale: string): string {
  const whole = Number.isInteger(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2
    }).format(amount);
  } catch {
    return String(amount);
  }
}
