import { roundTo } from '@/lib/fx';
import { amountToCover, applyPayments, fxSettingsOf, igtfFraction, type PaymentDraft, type PaymentResult } from '@/lib/payments';
import { round2 } from '@/lib/utils';
import type { Business, PaymentMethodConfig } from '@/types';
import type { PaymentEntry } from './types';

type Biz = Pick<Business, 'currency' | 'fx'>;

/** Pago del POS con sus montos ya resueltos (sugeridos o capturados) y su efecto sobre la venta. */
export interface ResolvedEntry extends PaymentEntry {
  /** Configuración del método (null si ya no está activo). */
  method: PaymentMethodConfig | null;
  isLocal: boolean;
  /** Monto que se cobra con este pago, en la moneda del método (null = no se puede calcular: sin tasa). */
  value: number | null;
  /** Monto exacto que cubriría lo que faltaba antes de este pago (botón "Exacto/Resto"). */
  exact: number | null;
  /** Lo que faltaba por cubrir antes de este pago (moneda base). */
  remainingBefore: number;
  /** Equivalente en moneda base de lo entregado (incluye IGTF y vuelto). */
  grossBase: number | null;
  /** Parte de la venta que cubre (moneda base, sin IGTF). */
  coverage: number;
  /** IGTF de este pago (moneda base). */
  igtf: number;
  /** Lo que excede lo que faltaba (moneda base). */
  excess: number;
  /** Es un pago en moneda local y no hay tasa. */
  needsRate: boolean;
  /** Pide referencia y está vacía. */
  missingReference: boolean;
}

export interface PaymentPlan {
  entries: ResolvedEntry[];
  /** Pagos listos para `checkout` (solo los que tienen monto). */
  drafts: PaymentDraft[];
  result: PaymentResult;
  /** Total entregado por el cliente en moneda base (venta + IGTF + vuelto). */
  paid: number;
}

/**
 * Monto sugerido para cubrir `remaining` con un método. Parte de `amountToCover` (redondea hacia arriba
 * para no quedarse corto), pero si el redondeo al más cercano también cubre la venta sin dejar vuelto,
 * usa ese: coincide con el total en Bs que ve el cajero y el IGTF queda redondeado al céntimo
 * (total $13,37 → $13,77 y no $13,78, que en el ticket no cuadraría con "Total pagado").
 */
export function suggestAmount(input: {
  remaining: number;
  method: PaymentMethodConfig;
  business: Biz;
  rate: number | null;
  prior: PaymentDraft[];
  total: number;
  methods: PaymentMethodConfig[];
}): number | null {
  const { remaining, method, business, rate, prior, total, methods } = input;
  if (!(remaining > 0)) return 0;
  const up = amountToCover(remaining, method, business, rate);
  if (up === null) return null;
  const fx = fxSettingsOf(business);
  const isLocal = method.currency === 'local';
  if (isLocal && !rate) return null;
  const exact = remaining * (1 + igtfFraction(method, fx)) * (isLocal ? (rate as number) : 1);
  const near = roundTo(exact, isLocal ? fx.localRounding || 0.01 : 0.01);
  if (near > 0 && near < up) {
    const check = applyPayments({ total, drafts: [...prior, { methodId: method.id, amount: near }], methods, business, rate });
    if (check.remaining === 0 && check.excess === 0) return near;
  }
  return up;
}

/**
 * Resuelve los pagos capturados en orden: calcula los montos automáticos, el IGTF, lo cubierto,
 * lo que falta y el vuelto (usa `applyPayments`, la misma lógica con la que `checkout` guarda la venta).
 */
export function resolvePlan(input: {
  entries: PaymentEntry[];
  total: number;
  methods: PaymentMethodConfig[];
  business: Biz;
  rate: number | null;
}): PaymentPlan {
  const { entries, total, methods, business, rate } = input;
  const drafts: PaymentDraft[] = [];
  let before = applyPayments({ total, drafts, methods, business, rate });

  const resolved = entries.map((e): ResolvedEntry => {
    const method = methods.find((m) => m.id === e.methodId) ?? null;
    const isLocal = method?.currency === 'local';
    const needsRate = isLocal && !(rate && rate > 0);
    const remainingBefore = before.remaining;
    // El monto sugerido parte del saldo exacto (no redondeado) para que el resto en Bs sea preciso.
    const exact = method ? suggestAmount({ remaining: before.remainingRaw, method, business, rate, prior: drafts, total, methods }) : null;
    const value = e.auto ? exact : e.amount === '' ? null : e.amount;
    const amount = value ?? 0;
    if (method && amount > 0) {
      const ref = e.reference.trim();
      drafts.push({ methodId: method.id, amount, ...(ref ? { reference: ref } : {}) });
    }
    const after = applyPayments({ total, drafts, methods, business, rate });
    const entry: ResolvedEntry = {
      ...e,
      method,
      isLocal,
      value,
      exact,
      remainingBefore,
      grossBase: needsRate ? null : isLocal ? amount / (rate as number) : amount,
      coverage: round2(before.remaining - after.remaining),
      igtf: round2(after.igtf - before.igtf),
      excess: round2(after.excess - before.excess),
      needsRate,
      missingReference: !!method?.requiresReference && amount > 0 && !e.reference.trim()
    };
    before = after;
    return entry;
  });

  return {
    entries: resolved,
    drafts,
    result: before,
    paid: round2(before.covered + before.igtf + before.excess)
  };
}

/** Billetes de dólar para sumar rápido lo que entrega el cliente. */
export const BASE_BILLS = [1, 5, 10, 20, 50, 100];

/**
 * Redondeos "útiles" hacia arriba para cobrar en efectivo en moneda local (Bs):
 * pasos 1-2-5 × 10ⁿ a partir de ~1% del monto. Ej: 11.753,84 → 11.800 · 12.000 · 15.000 · 20.000.
 */
export function localRoundUps(amount: number, count = 4): number[] {
  const t = round2(amount);
  if (!(t > 0)) return [];
  const out: number[] = [];
  for (let exp = 0; out.length < count && exp < 13; exp++) {
    for (const mult of [1, 2, 5]) {
      const step = mult * 10 ** exp;
      if (step < t / 100) continue;
      const value = Math.ceil(t / step - 1e-9) * step;
      if (value > t + 0.004 && !out.includes(value)) out.push(value);
      if (out.length >= count) break;
    }
  }
  return out.sort((a, b) => a - b);
}
