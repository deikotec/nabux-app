import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FxRates } from '@/types';
import { logActivityIn } from './activity';
import { refs, type Actor } from './refs';

export type RatesPatch = Partial<Pick<FxRates, 'bcv' | 'parallel' | 'custom' | 'bcvDate' | 'parallelUpdatedAt'>>;

/**
 * Guarda las tasas vigentes del negocio (businesses/{bid}/meta/fx) y deja un registro en el historial.
 * `current` son las tasas actuales para completar el registro histórico.
 */
export async function saveRates(bid: string, actor: Actor, current: FxRates | null, patch: RatesPatch, source: 'auto' | 'manual') {
  const clean = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v * 10000) / 10000 : null);
  const next = {
    bcv: patch.bcv !== undefined ? clean(patch.bcv) : (current?.bcv ?? null),
    parallel: patch.parallel !== undefined ? clean(patch.parallel) : (current?.parallel ?? null),
    custom: patch.custom !== undefined ? clean(patch.custom) : (current?.custom ?? null),
    bcvDate: patch.bcvDate !== undefined ? patch.bcvDate : (current?.bcvDate ?? null),
    parallelUpdatedAt: patch.parallelUpdatedAt !== undefined ? patch.parallelUpdatedAt : (current?.parallelUpdatedAt ?? null)
  };
  const batch = writeBatch(db);
  batch.set(refs.fx(bid), { ...next, source, updatedAt: serverTimestamp(), updatedBy: actor.uid, updatedByName: actor.name }, { merge: true });
  batch.set(doc(refs.fxHistory(bid)), { ...next, source, userId: actor.uid, userName: actor.name, createdAt: serverTimestamp() });
  if (source === 'manual') {
    const parts = [
      next.bcv ? `BCV ${next.bcv}` : null,
      next.parallel ? `paralelo ${next.parallel}` : null,
      next.custom ? `propia ${next.custom}` : null
    ].filter(Boolean);
    logActivityIn(batch, bid, actor, { type: 'settings_update', message: `Actualizó la tasa de cambio (${parts.join(' · ')})` });
  }
  await batch.commit();
}
