import { useCallback, useEffect, useMemo, useState } from 'react';
import { limit, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { useQueryData } from '@/hooks/data';
import { refs } from '@/services/refs';
import type { DateRange } from '@/lib/dates';
import type { FxHistoryEntry, StockMovement } from '@/types';

/** Hora actual que se refresca cada `intervalMs` (para el "corte en tiempo real"). */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function readGoal(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Meta de venta diaria guardada en este navegador por negocio (`nabux:goal:{bid}`). */
export function useDailyGoal(businessId: string) {
  const key = `nabux:goal:${businessId}`;
  const [stored, setStored] = useState(() => ({ key, value: readGoal(key) }));
  // Si cambia el negocio activo, relee la meta correspondiente.
  if (stored.key !== key) setStored({ key, value: readGoal(key) });

  const setGoal = useCallback(
    (value: number | null) => {
      const clean = value && value > 0 ? Math.round(value * 100) / 100 : null;
      try {
        if (clean) localStorage.setItem(key, String(clean));
        else localStorage.removeItem(key);
      } catch {
        /* sin almacenamiento local: la meta vive solo en esta sesión */
      }
      setStored({ key, value: clean });
    },
    [key]
  );

  return [stored.key === key ? stored.value : readGoal(key), setGoal] as const;
}

/**
 * Salidas de inventario (mermas, tipo "out") del rango. Usa el índice compuesto type + createdAt.
 */
export function useRangeMovements(businessId: string, range: DateRange | null) {
  const fromMs = range?.from.getTime();
  const toMs = range?.to.getTime();
  const q = useMemo(() => {
    if (!businessId || fromMs === undefined || toMs === undefined) return null;
    return query(
      refs.movements(businessId),
      where('type', '==', 'out'),
      where('createdAt', '>=', Timestamp.fromMillis(fromMs)),
      where('createdAt', '<=', Timestamp.fromMillis(toMs)),
      orderBy('createdAt', 'desc')
    );
  }, [businessId, fromMs, toMs]);
  const state = useQueryData<StockMovement>(q);
  const data = useMemo(() => state.data.filter((m) => m.type === 'out'), [state.data]);
  return { ...state, data };
}

/**
 * Historial de tasas del rango (por `createdAt`, en orden cronológico) y el último registro previo al
 * rango (`baseline`, la tasa con que arrancó el período). Solo consulta si `enabled` (modo bimonetario).
 */
export function useFxHistory(businessId: string, range: DateRange | null, enabled: boolean) {
  const fromMs = range?.from.getTime();
  const toMs = range?.to.getTime();
  const inRange = useMemo(() => {
    if (!enabled || !businessId || fromMs === undefined || toMs === undefined) return null;
    return query(
      refs.fxHistory(businessId),
      where('createdAt', '>=', Timestamp.fromMillis(fromMs)),
      where('createdAt', '<=', Timestamp.fromMillis(toMs)),
      orderBy('createdAt', 'asc')
    );
  }, [enabled, businessId, fromMs, toMs]);
  const before = useMemo(() => {
    if (!enabled || !businessId || fromMs === undefined) return null;
    return query(refs.fxHistory(businessId), where('createdAt', '<', Timestamp.fromMillis(fromMs)), orderBy('createdAt', 'desc'), limit(1));
  }, [enabled, businessId, fromMs]);
  const entries = useQueryData<FxHistoryEntry>(inRange);
  const prev = useQueryData<FxHistoryEntry>(before);
  return {
    entries: entries.data,
    baseline: prev.data[0] ?? null,
    loading: entries.loading || prev.loading,
    error: entries.error ?? prev.error
  };
}
