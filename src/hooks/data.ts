import { useEffect, useMemo, useState } from 'react';
import {
  limit as qLimit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  type DocumentData,
  type Query
} from 'firebase/firestore';
import { useBusiness } from '@/contexts/BusinessContext';
import { refs } from '@/services/refs';
import type { DateRange } from '@/lib/dates';
import type { ActivityLog, CashSession, Invite, Member, Sale, StockMovement } from '@/types';

export interface QueryState<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

/**
 * Suscripción en tiempo real a una consulta. IMPORTANTE: memoiza la consulta con useMemo
 * (o pasa null para no consultar) para no re-suscribirte en cada render.
 */
export function useQueryData<T>(q: Query<DocumentData> | null): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({ data: [], loading: !!q, error: null });
  useEffect(() => {
    if (!q) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    return onSnapshot(
      q,
      (snap) =>
        setState({
          data: snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as T),
          loading: false,
          error: null
        }),
      (error) => {
        console.error(error);
        setState({ data: [], loading: false, error });
      }
    );
  }, [q]);
  return state;
}

/**
 * Ventas en un rango de fechas (más recientes primero).
 * Quien no tiene permiso "reports" solo ve sus propias ventas (lo exigen las reglas).
 */
export function useSalesRange(range: DateRange | null, opts: { mineOnly?: boolean } = {}) {
  const { businessId, can, actor } = useBusiness();
  const mine = opts.mineOnly || !can('reports');
  const fromMs = range?.from.getTime();
  const toMs = range?.to.getTime();
  const q = useMemo(() => {
    if (!businessId || fromMs === undefined || toMs === undefined || !actor.uid) return null;
    const constraints = [
      ...(mine ? [where('cashierId', '==', actor.uid)] : []),
      where('createdAt', '>=', Timestamp.fromMillis(fromMs)),
      where('createdAt', '<=', Timestamp.fromMillis(toMs)),
      orderBy('createdAt', 'desc')
    ];
    return query(refs.sales(businessId), ...constraints);
  }, [businessId, fromMs, toMs, mine, actor.uid]);
  return useQueryData<Sale>(q);
}

/** Últimas N ventas (para el panel). */
export function useRecentSales(count = 8, opts: { mineOnly?: boolean } = {}) {
  const { businessId, can, actor } = useBusiness();
  const mine = opts.mineOnly || !can('reports');
  const q = useMemo(() => {
    if (!businessId || !actor.uid) return null;
    return query(
      refs.sales(businessId),
      ...(mine ? [where('cashierId', '==', actor.uid)] : []),
      orderBy('createdAt', 'desc'),
      qLimit(count)
    );
  }, [businessId, mine, actor.uid, count]);
  return useQueryData<Sale>(q);
}

/** Kardex: movimientos de stock (de un producto o de todo el negocio). */
export function useMovements(productId?: string | null, count = 50) {
  const { businessId } = useBusiness();
  const q = useMemo(() => {
    if (!businessId) return null;
    if (productId) {
      return query(refs.movements(businessId), where('productId', '==', productId), orderBy('createdAt', 'desc'), qLimit(count));
    }
    return query(refs.movements(businessId), orderBy('createdAt', 'desc'), qLimit(count));
  }, [businessId, productId, count]);
  return useQueryData<StockMovement>(q);
}

/** Bitácora de auditoría (requiere permiso staff o reports). */
export function useActivity(count = 30) {
  const { businessId, can } = useBusiness();
  const allowed = can('staff') || can('reports');
  const q = useMemo(() => {
    if (!businessId || !allowed) return null;
    return query(refs.activity(businessId), orderBy('createdAt', 'desc'), qLimit(count));
  }, [businessId, allowed, count]);
  return useQueryData<ActivityLog>(q);
}

/** Equipo del negocio. */
export function useMembers() {
  const { businessId } = useBusiness();
  const q = useMemo(() => (businessId ? query(refs.members(businessId)) : null), [businessId]);
  const state = useQueryData<Member>(q);
  // El id del documento es el uid
  const data = useMemo(
    () =>
      state.data
        .map((m) => ({ ...m, uid: m.uid || (m as unknown as { id: string }).id }))
        .sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.displayName.localeCompare(b.displayName, 'es'))),
    [state.data]
  );
  return { ...state, data };
}

/** Invitaciones pendientes del negocio (requiere permiso staff). */
export function useBusinessInvites() {
  const { businessId, can } = useBusiness();
  const allowed = can('staff');
  const q = useMemo(
    () => (businessId && allowed ? query(refs.invites(), where('businessId', '==', businessId)) : null),
    [businessId, allowed]
  );
  return useQueryData<Invite>(q);
}

/** Cortes de caja cerrados (más recientes primero). Sin permiso "reports" solo los propios. */
export function useClosedCashSessions(count = 30) {
  const { businessId, can, actor } = useBusiness();
  const all = can('reports');
  const q = useMemo(() => {
    if (!businessId || !actor.uid) return null;
    if (all) return query(refs.cashSessions(businessId), where('status', '==', 'closed'), orderBy('closedAt', 'desc'), qLimit(count));
    return query(refs.cashSessions(businessId), where('openedBy', '==', actor.uid), orderBy('openedAt', 'desc'), qLimit(count));
  }, [businessId, all, actor.uid, count]);
  const state = useQueryData<CashSession>(q);
  const data = useMemo(() => state.data.filter((s) => s.status === 'closed'), [state.data]);
  return { ...state, data };
}

/** Cajas abiertas en este momento (de todo el equipo; requiere reports). */
export function useOpenCashSessions() {
  const { businessId, can } = useBusiness();
  const allowed = can('reports');
  const q = useMemo(
    () => (businessId && allowed ? query(refs.cashSessions(businessId), where('status', '==', 'open')) : null),
    [businessId, allowed]
  );
  return useQueryData<CashSession>(q);
}

/** Estado de conexión del navegador. */
export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
