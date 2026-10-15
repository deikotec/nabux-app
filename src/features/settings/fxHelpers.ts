import type { LucideIcon } from 'lucide-react';
import { Banknote, Bitcoin, CreditCard, HandCoins, Landmark, Smartphone, Wallet } from 'lucide-react';
import { CURRENCIES, DEFAULT_FX_SETTINGS, DEFAULT_PAYMENT_METHODS, VE_PAYMENT_METHODS } from '@/config/app';
import { formatDate, toDate } from '@/lib/format';
import { isDualCurrency } from '@/lib/payments';
import { dayKey } from '@/lib/dates';
import type { BusinessPatch } from '@/services/business';
import type { Business, FxHistoryEntry, FxSettings, PaymentKind, PaymentMethodConfig, RateSource } from '@/types';

/** Opción "Venezuela · Dólar + Bolívar" del catálogo de monedas (base USD, local VES). */
export const VE_OPTION = CURRENCIES.find((c) => !!c.baseCurrency) ?? CURRENCIES[0];

export const RATE_SOURCES: RateSource[] = ['bcv', 'parallel', 'custom'];

export const RATE_SOURCE_HELP: Record<RateSource, string> = {
  bcv: 'La oficial del Banco Central de Venezuela. Es la legal para facturar y declarar el IVA.',
  parallel: 'Referencia del mercado (promedio de monitores). Úsala solo si tu negocio cobra a esa tasa.',
  custom: 'La fijas tú (por ejemplo, un promedio o una tasa redondeada). Siempre se actualiza a mano.'
};

export const RATE_SHORT_LABELS: Record<RateSource, string> = { bcv: 'BCV', parallel: 'Paralelo', custom: 'Propia' };

/** Para frases: "la tasa BCV", "la tasa paralela", "la tasa propia". */
export const RATE_PHRASE: Record<RateSource, string> = { bcv: 'la tasa BCV', parallel: 'la tasa paralela', custom: 'la tasa propia' };

/** Redondeos disponibles para montos en bolívares. */
export const LOCAL_ROUNDING_OPTIONS = [0.01, 1, 5, 10] as const;

/** ¿Negocio venezolano? (país VE o modo bimonetario activo). */
export function isVenezuela(b: Pick<Business, 'country' | 'fx'>): boolean {
  return b.country === 'VE' || isDualCurrency(b);
}

/** Nombre de la identificación fiscal según el país. */
export function taxIdLabel(b: Pick<Business, 'country' | 'fx'>): string {
  return isVenezuela(b) ? 'RIF' : 'RFC / NIT / RUC';
}

/* ---------------- Formas de pago ---------------- */

const PREDEFINED_METHOD_IDS = new Set([...VE_PAYMENT_METHODS, ...DEFAULT_PAYMENT_METHODS].map((m) => m.id));

/** Las predeterminadas no se eliminan (solo se desactivan) para no romper ventas antiguas. */
export function isPredefinedMethod(id: string): boolean {
  return PREDEFINED_METHOD_IDS.has(id);
}

/** Id único para una forma de pago personalizada ("custom_x7k2"). */
export function newMethodId(taken: Iterable<string>): string {
  const used = new Set(taken);
  for (;;) {
    const id = `custom_${Math.random().toString(36).slice(2, 6)}`;
    if (!used.has(id) && !PREDEFINED_METHOD_IDS.has(id)) return id;
  }
}

export const KIND_ICONS: Record<PaymentKind, LucideIcon> = {
  cash: Banknote,
  mobile: Smartphone,
  card: CreditCard,
  transfer: Landmark,
  crypto: Bitcoin,
  credit: HandCoins,
  other: Wallet
};

/** ¿El negocio ya configuró formas de pago en moneda local? */
export function hasLocalMethods(b: Pick<Business, 'paymentMethods'>): boolean {
  return !!b.paymentMethods?.some((m) => m.currency === 'local');
}

/** Formas de pago de Venezuela + las que ya tenía el negocio (desactivadas, para conservar el historial). */
export function mergeVeMethods(existing: PaymentMethodConfig[]): PaymentMethodConfig[] {
  const veIds = new Set(VE_PAYMENT_METHODS.map((m) => m.id));
  return [...VE_PAYMENT_METHODS.map((m) => ({ ...m })), ...existing.filter((m) => !veIds.has(m.id)).map((m) => ({ ...m, active: false }))];
}

/** Configuración bimonetaria activa conservando lo que el negocio tuviera antes. */
export function enabledFxSettings(business: Pick<Business, 'fx'>): FxSettings {
  return {
    ...DEFAULT_FX_SETTINGS,
    ...(business.fx ?? {}),
    enabled: true,
    localCurrency: VE_OPTION.code,
    localLocale: VE_OPTION.locale
  };
}

/**
 * Campos a escribir para activar el modo bimonetario: país, formato es-VE, fx y (si no hay)
 * las formas de pago de Venezuela. La moneda base y el IVA los decide quien llama.
 */
export function enableFxPatch(business: Business, opts: { useVeMethods: boolean }): BusinessPatch {
  const patch: BusinessPatch = {
    country: VE_OPTION.country ?? 'VE',
    locale: VE_OPTION.baseLocale ?? VE_OPTION.locale,
    fx: enabledFxSettings(business)
  };
  if (!business.paymentMethods?.length) patch.paymentMethods = VE_PAYMENT_METHODS.map((m) => ({ ...m }));
  else if (opts.useVeMethods) patch.paymentMethods = mergeVeMethods(business.paymentMethods);
  return patch;
}

/* ---------------- Tasas ---------------- */

const rateFormatter = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/** Solo el número de una tasa ("879,1234"). */
export function rateNumber(n: number | null | undefined): string {
  return n ? rateFormatter.format(n) : '—';
}

/** "2026-10-15" → "15 oct 2026". */
export function formatIsoDay(iso: string | null | undefined, withYear = true): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return formatDate(d, withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
}

export interface RatePoint {
  key: string;
  value: number;
}

/**
 * Serie diaria de la tasa BCV a partir del historial (más reciente primero):
 * un punto por día de vigencia (el último registrado), en orden cronológico.
 */
export function bcvSeries(entries: FxHistoryEntry[], max = 30): RatePoint[] {
  const byDay = new Map<string, RatePoint>();
  for (const e of entries) {
    if (!e.bcv || e.bcv <= 0) continue;
    const created = toDate(e.createdAt);
    const key = e.bcvDate?.slice(0, 10) ?? (created ? dayKey(created) : null);
    if (!key || byDay.has(key)) continue;
    byDay.set(key, { key, value: e.bcv });
  }
  return [...byDay.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-max);
}

/** Variación porcentual entre el primer y el último punto. */
export function seriesChange(points: RatePoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0].value;
  const last = points[points.length - 1].value;
  return first > 0 ? ((last - first) / first) * 100 : null;
}
