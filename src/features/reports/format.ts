import type { TS } from '@/types';
import { toDate } from '@/lib/format';

/** Hora en formato 24 h ("15:42"), más compacta que "03:42 p.m." para tablas y encabezados. */
export function hhmm(value: TS | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "1 agotado" / "3 agotados". */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** Monto compacto para ejes de gráficas en moneda local: "Bs. 850k", "Bs. 1,2M". */
export function compactAmount(n: number, symbol: string, locale = 'es-VE'): string {
  const abs = Math.abs(n);
  const fmt = (v: number, d: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: d }).format(v);
  let body: string;
  if (abs >= 1e9) body = `${fmt(n / 1e9, 1)}MM`;
  else if (abs >= 1e6) body = `${fmt(n / 1e6, 1)}M`;
  else if (abs >= 1e3) body = `${fmt(n / 1e3, abs >= 1e5 ? 0 : 1)}k`;
  else body = fmt(n, 0);
  return `${symbol} ${body}`;
}

/** Variación con signo y coma decimal: "+12,3 %". */
export function signedPct(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const body = new Intl.NumberFormat('es-VE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Math.abs(v));
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${body} %`;
}

/** Porcentaje sin signo con coma decimal: "34,6 %". */
export function plainPct(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${new Intl.NumberFormat('es-VE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v)} %`;
}

/**
 * Formateadores bimonetarios que la página entrega a cada sección.
 * Con `dual = false` las secciones se ven exactamente como en una sola moneda.
 */
export interface ReportFx {
  dual: boolean;
  baseCurrency: string;
  localCurrency: string;
  /** Monto ya expresado en moneda local → "Bs. 1.234,56". */
  formatLocal: (amountLocal: number | null | undefined) => string;
  /** Compacto para ejes → "Bs. 1,2M". */
  compactLocal: (amountLocal: number) => string;
  /** Monto en cualquier moneda ISO ("USD", "VES"). */
  moneyIn: (amount: number | null | undefined, currency: string) => string;
  /** "41,00 Bs/$". */
  formatRate: (rate: number | null | undefined) => string;
  /** Símbolos cortos para selectores: "$" y "Bs". */
  baseSymbol: string;
  localSymbol: string;
  /** IGTF configurado (on/off y tasa en %). */
  igtfEnabled: boolean;
  igtfRate: number;
}
