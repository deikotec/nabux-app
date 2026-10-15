import { useCallback, useMemo } from 'react';
import { useToast } from '@/components/ui';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useFx } from '@/contexts/FxContext';
import { baseToMethod, methodCurrency } from '@/lib/payments';
import { round2 } from '@/lib/utils';
import type { PaymentMethodConfig } from '@/types';
import { resolvePlan } from '../paymentPlan';
import { newId } from '../posUtils';
import type { PaymentEntry } from '../types';
import type { TicketApi } from './useTicket';

/**
 * Cobro del ticket: pagos múltiples (mixtos), multimoneda, IGTF y vuelto.
 * El estado (los pagos capturados) vive en el ticket; aquí se resuelve y se expone como acciones.
 */
export function usePayments(ticket: TicketApi) {
  const { business } = useActiveBusiness();
  const fx = useFx();
  const toast = useToast();
  const { payments, setPayments, changeMethodId, setChangeMethodId } = ticket;

  const methods = fx.methods;
  const rate = fx.enabled ? fx.rate : null;
  const total = ticket.totals.total;

  const plan = useMemo(() => resolvePlan({ entries: payments, total, methods, business, rate }), [payments, total, methods, business, rate]);
  const { result } = plan;

  /* ---------------- Vuelto ---------------- */

  const changeOptions = useMemo(() => methods.filter((m) => m.allowsChange && (m.currency !== 'local' || !!rate)), [methods, rate]);
  const hasChange = result.excess > 0.009;
  const changeMethod: PaymentMethodConfig | null = useMemo(() => {
    if (!hasChange) return null;
    const chosen = changeOptions.find((m) => m.id === changeMethodId);
    if (chosen) return chosen;
    // Por defecto, en la moneda del último pago en efectivo (igual que al guardar la venta).
    const lastCash = [...plan.entries].reverse().find((e) => e.method?.kind === 'cash' && (e.value ?? 0) > 0);
    return (
      changeOptions.find((m) => m.id === lastCash?.methodId) ?? changeOptions.find((m) => m.kind === 'cash') ?? changeOptions[0] ?? null
    );
  }, [hasChange, changeOptions, changeMethodId, plan.entries]);
  const changeAmount = changeMethod ? baseToMethod(result.excess, changeMethod, rate) : null;

  /* ---------------- Validaciones ---------------- */

  const missingRefs = plan.entries.filter((e) => e.missingReference);
  const needsRate = plan.entries.some((e) => e.needsRate);
  const noPayments = plan.drafts.length === 0;

  /* ---------------- Acciones ---------------- */

  const update = useCallback(
    (key: string, patch: Partial<PaymentEntry>) => setPayments((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p))),
    [setPayments]
  );

  /**
   * Toca una forma de pago:
   * - si el último pago aún tiene el monto sugerido, se cambia su método (corrige un toque equivocado);
   * - si falta dinero, agrega un pago por lo que resta (incluye IGTF si aplica);
   * Devuelve la clave del pago afectado (para enfocar su monto) o null.
   */
  const tapMethod = useCallback(
    (methodId: string): string | null => {
      const method = methods.find((m) => m.id === methodId);
      if (!method) return null;
      if (method.currency === 'local' && !rate) {
        toast.error('No hay tasa de cambio: actualízala para cobrar en bolívares.');
        return null;
      }
      const last = payments[payments.length - 1];
      if (last?.auto) {
        if (last.methodId !== methodId) {
          setPayments(payments.map((p) => (p.key === last.key ? { ...p, methodId, reference: '' } : p)));
          setChangeMethodId(null);
        }
        return last.key;
      }
      if (!(total > 0)) {
        toast.info('Agrega productos al ticket antes de registrar pagos.');
        return null;
      }
      if (result.remaining <= 0) {
        toast.info('El total ya está cubierto. Edita o quita un pago si quieres combinar otra forma de pago.');
        return null;
      }
      const key = newId('pay-');
      // Los pagos anteriores quedan fijos con su monto actual; el nuevo cubre lo que resta.
      const frozen = payments.map((p): PaymentEntry => {
        if (!p.auto) return p;
        const r = plan.entries.find((e) => e.key === p.key);
        return { ...p, auto: false, amount: r?.value ?? '' };
      });
      setPayments([...frozen, { key, methodId, amount: '', reference: '', auto: true }]);
      return key;
    },
    [methods, rate, payments, total, result.remaining, plan.entries, setPayments, setChangeMethodId, toast]
  );

  const setAmount = useCallback((key: string, amount: number | '') => update(key, { amount, auto: false }), [update]);
  const setReference = useCallback((key: string, reference: string) => update(key, { reference }), [update]);
  /** Vuelve al monto exacto (lo que faltaba antes de este pago). */
  const setExact = useCallback((key: string) => update(key, { amount: '', auto: true }), [update]);

  /** Billete de dólar: se suma a lo recibido (el primero reemplaza al monto sugerido). */
  const addBill = useCallback(
    (key: string, bill: number) =>
      setPayments((list) =>
        list.map((p) => (p.key === key ? { ...p, auto: false, amount: round2((p.auto ? 0 : Number(p.amount) || 0) + bill) } : p))
      ),
    [setPayments]
  );

  const removePayment = useCallback(
    (key: string) => {
      setPayments((list) => list.filter((p) => p.key !== key));
      setChangeMethodId(null);
    },
    [setPayments, setChangeMethodId]
  );

  /** Formatea un monto en la moneda de un método. */
  const formatIn = useCallback(
    (amount: number | null | undefined, method: Pick<PaymentMethodConfig, 'currency'>) => fx.moneyIn(amount, methodCurrency(method, business)),
    [fx, business]
  );

  return {
    methods,
    rate,
    plan,
    result,
    entries: plan.entries,
    drafts: plan.drafts,
    paid: plan.paid,
    changeOptions,
    changeMethod,
    changeAmount,
    hasChange,
    missingRefs,
    needsRate,
    noPayments,
    tapMethod,
    setAmount,
    setReference,
    setExact,
    addBill,
    removePayment,
    setChangeMethodId,
    formatIn
  };
}

export type PaymentsApi = ReturnType<typeof usePayments>;
