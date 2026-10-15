import { DEFAULT_FX_SETTINGS, DEFAULT_PAYMENT_METHODS, PAYMENT_LABELS, VE_PAYMENT_METHODS } from '@/config/app';
import type { Business, FxSettings, LegacyPaymentMethod, PaymentKind, PaymentMethodConfig, Sale, SalePayment } from '@/types';
import { ceilTo } from './fx';
import { round2 } from './utils';

/** Configuración bimonetaria efectiva del negocio (con valores por defecto). */
export function fxSettingsOf(business: Pick<Business, 'fx'> | null | undefined): FxSettings {
  return { ...DEFAULT_FX_SETTINGS, ...(business?.fx ?? {}) };
}

/** ¿El negocio trabaja en modo bimonetario (USD + moneda local)? */
export function isDualCurrency(business: Pick<Business, 'fx'> | null | undefined): boolean {
  return !!business?.fx?.enabled;
}

/** Formas de pago del negocio (las guardadas o las predeterminadas según el modo). */
export function paymentMethodsOf(business: Pick<Business, 'paymentMethods' | 'fx'> | null | undefined): PaymentMethodConfig[] {
  if (business?.paymentMethods?.length) return business.paymentMethods;
  return isDualCurrency(business) ? VE_PAYMENT_METHODS : DEFAULT_PAYMENT_METHODS;
}

export function activePaymentMethods(business: Pick<Business, 'paymentMethods' | 'fx'> | null | undefined) {
  const dual = isDualCurrency(business);
  // Sin modo bimonetario no se ofrecen métodos en moneda local.
  return paymentMethodsOf(business).filter((m) => m.active && (dual || m.currency === 'base'));
}

/** Moneda ISO de un método según el negocio. */
export function methodCurrency(method: Pick<PaymentMethodConfig, 'currency'>, business: Pick<Business, 'currency' | 'fx'>): string {
  return method.currency === 'local' ? fxSettingsOf(business).localCurrency : business.currency;
}

/** Tasa IGTF efectiva (en fracción) para un método. */
export function igtfFraction(method: Pick<PaymentMethodConfig, 'igtf'>, fx: FxSettings): number {
  return fx.enabled && fx.igtfEnabled && method.igtf ? Math.max(0, fx.igtfRate || 0) / 100 : 0;
}

/* ------------------------------------------------------------------ */

export interface PaymentDraft {
  methodId: string;
  /** Monto entregado en la moneda del método. */
  amount: number;
  reference?: string;
}

export interface PaymentResult {
  lines: SalePayment[];
  /** Monto de la venta ya cubierto (moneda base). */
  covered: number;
  /** IGTF total (moneda base). */
  igtf: number;
  /** Lo que falta por cubrir de la venta (moneda base, sin IGTF, redondeado a céntimos). */
  remaining: number;
  /** Lo que falta sin redondear: úsalo para sugerir montos en otra moneda sin perder precisión. */
  remainingRaw: number;
  /** Excedente entregado = vuelto (moneda base, redondeado a céntimos). */
  excess: number;
  /** Vuelto sin redondear (moneda base), para convertirlo a otra moneda sin perder precisión. */
  excessRaw: number;
  /** Total cobrado al cliente = total + IGTF aplicado (moneda base). */
  amountDue: number;
}

/**
 * Aplica los pagos en orden sobre el total de la venta.
 * - Los pagos en moneda local se convierten con `rate` (Bs por $).
 * - El IGTF se calcula solo sobre la parte de un pago en divisas que cubre la venta (no sobre el vuelto):
 *   si falta R y el pago en $ es X, se aplica min(X, R × (1 + igtf)); el resto es vuelto.
 */
export function applyPayments(input: {
  total: number;
  drafts: PaymentDraft[];
  methods: PaymentMethodConfig[];
  business: Pick<Business, 'currency' | 'fx'>;
  rate: number | null | undefined;
}): PaymentResult {
  const fx = fxSettingsOf(input.business);
  let remaining = round2(input.total);
  let igtfTotal = 0;
  let excess = 0;
  // Tolerancia por redondeo en moneda local (ej. cobrar Bs redondeados a 10): no genera vuelto.
  let tolerance = 0.01 - 1e-9;
  const lines: SalePayment[] = [];

  for (const d of input.drafts) {
    const m = input.methods.find((x) => x.id === d.methodId);
    const amount = Number(d.amount) || 0;
    if (!m || amount <= 0) continue;
    const isLocal = m.currency === 'local';
    if (isLocal && !(input.rate && input.rate > 0)) continue;
    const gross = isLocal ? amount / (input.rate as number) : amount;
    const r = igtfFraction(m, fx);
    const needed = Math.max(0, remaining) * (1 + r);
    const applied = Math.min(gross, needed);
    const coverage = applied / (1 + r);
    const igtf = applied - coverage;
    remaining -= coverage;
    igtfTotal += igtf;
    excess += gross - applied;
    if (isLocal) tolerance = Math.max(tolerance, (fx.localRounding || 0.01) / (input.rate as number) + 1e-9);
    lines.push({
      methodId: m.id,
      label: m.label,
      currency: methodCurrency(m, input.business),
      kind: m.kind,
      amount: round2(amount),
      amountBase: round2(coverage),
      igtf: round2(igtf),
      ...(d.reference?.trim() ? { reference: d.reference.trim() } : {})
    });
  }

  if (remaining < 0.005) remaining = 0;
  return {
    lines,
    covered: round2(input.total - remaining),
    igtf: round2(igtfTotal),
    remaining: round2(remaining),
    remainingRaw: Math.max(0, remaining),
    // Restos menores a un céntimo (o a un paso de redondeo en Bs) no son vuelto.
    excess: excess < tolerance ? 0 : round2(excess),
    excessRaw: excess < tolerance ? 0 : excess,
    amountDue: round2(input.total + igtfTotal)
  };
}

/**
 * Monto a cobrar con un método para cubrir `remainingBase` (incluye IGTF si aplica),
 * en la moneda del método. En moneda local se redondea hacia arriba (al paso configurado) para no
 * quedarse corto; en moneda base, al céntimo más cercano (la tolerancia de medio céntimo lo cubre).
 */
export function amountToCover(
  remainingBase: number,
  method: PaymentMethodConfig,
  business: Pick<Business, 'fx'>,
  rate: number | null | undefined
): number | null {
  const fx = fxSettingsOf(business);
  const base = Math.max(0, remainingBase) * (1 + igtfFraction(method, fx));
  if (method.currency === 'local') {
    if (!rate) return null;
    return ceilTo(base * rate, fx.localRounding || 0.01);
  }
  return round2(base);
}

/** Convierte un monto en base a la moneda de un método (para el vuelto). */
export function baseToMethod(amountBase: number, method: PaymentMethodConfig, rate: number | null | undefined): number | null {
  if (method.currency === 'local') return rate ? round2(amountBase * rate) : null;
  return round2(amountBase);
}

/* ------------------------------------------------------------------ */

const LEGACY_KIND: Record<LegacyPaymentMethod, PaymentKind> = { cash: 'cash', card: 'card', transfer: 'transfer' };

/** Pagos de una venta, normalizando ventas antiguas (un solo método, sin `payments`). */
export function salePayments(sale: Pick<Sale, 'payments' | 'paymentMethod' | 'total' | 'currency'>): SalePayment[] {
  if (sale.payments?.length) return sale.payments;
  const pm = sale.paymentMethod as LegacyPaymentMethod;
  return [
    {
      methodId: pm,
      label: PAYMENT_LABELS[pm] ?? pm,
      currency: sale.currency ?? '',
      kind: LEGACY_KIND[pm] ?? 'other',
      amount: sale.total,
      amountBase: sale.total,
      igtf: 0
    }
  ];
}

/** Etiqueta del método de una venta ("Pago móvil", "Mixto (2)"…). */
export function saleMethodLabel(sale: Pick<Sale, 'payments' | 'paymentMethod' | 'total' | 'currency'>): string {
  const p = salePayments(sale);
  if (p.length > 1) return `Mixto (${p.length})`;
  return p[0]?.label ?? '—';
}

/** Ids de métodos usados en una venta (para filtros). */
export function saleMethodIds(sale: Pick<Sale, 'payments' | 'paymentMethod' | 'total' | 'currency'>): string[] {
  return salePayments(sale).map((p) => p.methodId);
}
