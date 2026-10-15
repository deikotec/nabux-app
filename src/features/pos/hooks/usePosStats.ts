import { useMemo } from 'react';
import { query, where } from 'firebase/firestore';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useQueryData, useSalesRange } from '@/hooks/data';
import { dayKey, rangeFromPreset } from '@/lib/dates';
import { round2 } from '@/lib/utils';
import { sumPayments } from '@/services/cash';
import { refs } from '@/services/refs';
import type { CashSession, Sale } from '@/types';

/** Mini KPIs del POS: mis ventas de hoy y efectivo esperado en la caja abierta. */
export function usePosStats(session: CashSession | null) {
  const { businessId, actor } = useActiveBusiness();

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

  return useMemo(() => {
    const done = todaySales.data.filter((s) => s.status === 'completed');
    const cash = sumPayments(sessionSales.data).cash;
    return {
      todayCount: done.length,
      todayTotal: round2(done.reduce((acc, s) => acc + (Number(s.total) || 0), 0)),
      todayLoading: todaySales.loading,
      cashInDrawer: session ? round2((Number(session.openingFloat) || 0) + cash) : null,
      cashLoading: sessionSales.loading
    };
  }, [todaySales.data, todaySales.loading, sessionSales.data, sessionSales.loading, session]);
}
