import { collection, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** Rutas de Firestore. Todo lo de un negocio vive bajo businesses/{bid}/… */
export const refs = {
  user: (uid: string) => doc(db, 'users', uid),
  business: (bid: string) => doc(db, 'businesses', bid),
  businesses: () => collection(db, 'businesses'),
  counters: (bid: string) => doc(db, 'businesses', bid, 'meta', 'counters'),
  members: (bid: string) => collection(db, 'businesses', bid, 'members'),
  member: (bid: string, uid: string) => doc(db, 'businesses', bid, 'members', uid),
  products: (bid: string) => collection(db, 'businesses', bid, 'products'),
  product: (bid: string, pid: string) => doc(db, 'businesses', bid, 'products', pid),
  suppliers: (bid: string) => collection(db, 'businesses', bid, 'suppliers'),
  supplier: (bid: string, sid: string) => doc(db, 'businesses', bid, 'suppliers', sid),
  sales: (bid: string) => collection(db, 'businesses', bid, 'sales'),
  sale: (bid: string, sid: string) => doc(db, 'businesses', bid, 'sales', sid),
  movements: (bid: string) => collection(db, 'businesses', bid, 'movements'),
  cashSessions: (bid: string) => collection(db, 'businesses', bid, 'cashSessions'),
  cashSession: (bid: string, id: string) => doc(db, 'businesses', bid, 'cashSessions', id),
  activity: (bid: string) => collection(db, 'businesses', bid, 'activity'),
  invites: () => collection(db, 'invites'),
  invite: (bid: string, email: string) => doc(db, 'invites', inviteId(bid, email))
};

export function inviteId(bid: string, email: string) {
  return `${bid}_${email.trim().toLowerCase()}`;
}

/** Quién ejecuta la acción (se guarda en ventas, movimientos y bitácora). */
export interface Actor {
  uid: string;
  name: string;
}
