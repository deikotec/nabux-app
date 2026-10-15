import type { TS } from '@/types';

const moneyFormatters = new Map<string, Intl.NumberFormat>();

/** Símbolos que Intl muestra desactualizados (ej. VES → "Bs.S"). */
const SYMBOL_OVERRIDES: Record<string, string> = { VES: 'Bs.' };

export function formatMoney(amount: number | null | undefined, currency = 'MXN', locale = 'es-MX'): string {
  const override = SYMBOL_OVERRIDES[currency];
  if (override) {
    const n = Number(amount) || 0;
    const body = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
    return `${n < 0 ? '-' : ''}${override} ${body}`;
  }
  const key = `${locale}|${currency}`;
  let fmt = moneyFormatters.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' });
    } catch {
      fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
    }
    moneyFormatters.set(key, fmt);
  }
  return fmt.format(Number(amount) || 0);
}

/** Símbolo de la moneda ("$", "€", "S/", "Q"…). */
export function currencySymbol(currency = 'MXN', locale = 'es-MX'): string {
  if (SYMBOL_OVERRIDES[currency]) return SYMBOL_OVERRIDES[currency];
  try {
    const part = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value ?? '$';
  } catch {
    return '$';
  }
}

/** Formato compacto para ejes de gráficas: $1.2k, $3.4M */
export function formatMoneyCompact(amount: number, currency = 'MXN', locale = 'es-MX'): string {
  if (SYMBOL_OVERRIDES[currency]) {
    const body = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(amount || 0);
    return `${SYMBOL_OVERRIDES[currency]} ${body}`;
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount || 0);
  } catch {
    return formatMoney(amount, currency, locale);
  }
}

export function formatNumber(n: number | null | undefined, locale = 'es-MX', maxDecimals = 2): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: maxDecimals }).format(Number(n) || 0);
}

export function formatPercent(n: number | null | undefined, decimals = 1, withSign = false): string {
  const v = Number(n) || 0;
  const s = `${v.toFixed(decimals)}%`;
  return withSign && v > 0 ? `+${s}` : s;
}

/** Convierte Timestamp | Date | number | null en Date (o null). */
export function toDate(value: TS | Date | number | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number' || typeof value === 'string') return new Date(value);
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') return (value as { toDate: () => Date }).toDate();
  return null;
}

export function formatDate(value: TS | Date | number | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('es-MX', opts).format(d);
}

export function formatTime(value: TS | Date | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(d);
}

export function formatDateTime(value: TS | Date | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
}

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

/** "hace 5 minutos", "ayer", "hace 3 días" */
export function formatRelative(value: TS | Date | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return 'justo ahora';
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
  return formatDate(d);
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function firstName(name?: string | null): string {
  return (name ?? '').trim().split(/\s+/)[0] || '';
}
