import { useMemo } from 'react';
import { limit, orderBy, query } from 'firebase/firestore';
import { useBusiness } from '@/contexts/BusinessContext';
import { useQueryData } from '@/hooks/data';
import { refs } from '@/services/refs';
import type { FxHistoryEntry } from '@/types';

/** Últimos cambios de tasa del negocio (más recientes primero). Solo consulta en modo bimonetario. */
export function useFxHistory(enabled: boolean, count = 20) {
  const { businessId } = useBusiness();
  const q = useMemo(
    () => (enabled && businessId ? query(refs.fxHistory(businessId), orderBy('createdAt', 'desc'), limit(count)) : null),
    [enabled, businessId, count]
  );
  return useQueryData<FxHistoryEntry>(q);
}
