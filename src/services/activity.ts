import { addDoc, doc, serverTimestamp, type WriteBatch, type Transaction } from 'firebase/firestore';
import type { ActivityType } from '@/types';
import { refs, type Actor } from './refs';

export interface ActivityInput {
  type: ActivityType;
  message: string;
  refId?: string | null;
  amount?: number | null;
}

function payload(actor: Actor, input: ActivityInput) {
  return {
    type: input.type,
    message: input.message,
    refId: input.refId ?? null,
    amount: input.amount ?? null,
    userId: actor.uid,
    userName: actor.name,
    createdAt: serverTimestamp()
  };
}

/** Registra un evento en la bitácora de auditoría. Nunca lanza: la bitácora no debe bloquear la operación. */
export function logActivity(bid: string, actor: Actor, input: ActivityInput) {
  addDoc(refs.activity(bid), payload(actor, input)).catch((e) => console.warn('No se pudo registrar actividad', e));
}

/** Variante para incluir el evento dentro de un batch o transacción. */
export function logActivityIn(tx: WriteBatch | Transaction, bid: string, actor: Actor, input: ActivityInput) {
  const ref = doc(refs.activity(bid));
  (tx as WriteBatch).set(ref, payload(actor, input));
}
