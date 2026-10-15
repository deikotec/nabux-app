import { useMemo } from 'react';
import { query, where } from 'firebase/firestore';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useFx } from '@/contexts/FxContext';
import { useQueryData, useSalesRange } from '@/hooks/data';
import { dayKey, rangeFromPreset } from '@/lib/dates';
import { round2 } from '@/lib/utils';
import { sumPayments } from '@/services/cash';
import { refs } from '@/services/refs';
import type { CashSession, Sale } from '@/types';

/** Mini KPIs del POS: mis ventas de hoy y efectivo esperado en la caja abierta (en $ y en Bs si aplica). */
export function usePosStats(session: CashSession | null) {
  const { businessId, actor } = useActiveBusiness();
  const fx = useFx();

  // Se recalcula si la página queda abierta al cambiar de día.
  const today = dayKey(new Date());
  const range = useMemo(() => rangeFromPreset('today'), [today]);
  const todaySales = useSalesRange(range, { mineOnly: true });

  const sessionId = session?.id ?? null;
  const sessionQuery = useMemo(
    () =>
      sessionId && actor.uid
        ? query(refs.sales(businessId), where('sessionId', '==', sessionId), where('cashierId', '==', actor.uid))
        : null,
    [businessId, sessionId, actor.uid]
  );
  const sessionSales = useQueryData<Sale>(sessionQuery);

  // La caja es bimonetaria si se abrió así (o si el negocio lo es ahora).
  const localCurrency = session?.localCurrency ?? (fx.enabled ? fx.localCurrency : null);
  const baseCurrency = fx.baseCurrency;
  // Configuración de métodos: para saber si el vuelto salió del efectivo o, p. ej., por pago móvil.
  const methods = fx.allMethods;

  return useMemo(() => {
    const done = todaySales.data.filter((s) => s.status === 'completed');
    const totals = sumPayments(sessionSales.data, { baseCurrency, localCurrency, methods });
    return {
      todayCount: done.length,
      todayTotal: round2(done.reduce((acc, s) => acc + (Number(s.total) || 0), 0)),
      todayLoading: todaySales.loading,
      cashInDrawer: session ? round2((Number(session.openingFloat) || 0) + (totals.cashBase ?? 0)) : null,
      cashInDrawerLocal: session && localCurrency ? round2((Number(session.openingFloatLocal) || 0) + (totals.cashLocal ?? 0)) : null,
      localCurrency,
      cashLoading: sessionSales.loading
    };
  }, [todaySales.data, todaySales.loading, sessionSales.data, sessionSales.loading, session, baseCurrency, localCurrency, methods]);
}
