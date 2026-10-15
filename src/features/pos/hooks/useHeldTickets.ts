import { useCallback, useEffect, useRef, useState } from 'react';
import type { HeldTicket } from '../types';

const storageKey = (bid: string) => `nabux:held:${bid}`;

function isHeldTicket(v: unknown): v is HeldTicket {
  const t = v as HeldTicket;
  return !!t && typeof t.id === 'string' && Array.isArray(t.lines) && typeof t.createdAt === 'number';
}

function readHeld(bid: string): HeldTicket[] {
  try {
    const raw = localStorage.getItem(storageKey(bid));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isHeldTicket) : [];
  } catch {
    return [];
  }
}

/**
 * Tickets en espera guardados en este equipo (localStorage, por negocio).
 * Se sincroniza entre pestañas con el evento "storage".
 */
export function useHeldTickets(bid: string) {
  const [held, setHeld] = useState<HeldTicket[]>(() => readHeld(bid));
  const heldRef = useRef(held);

  useEffect(() => {
    const initial = readHeld(bid);
    heldRef.current = initial;
    setHeld(initial);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey(bid)) return;
      const next = readHeld(bid);
      heldRef.current = next;
      setHeld(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [bid]);

  const persist = useCallback(
    (next: HeldTicket[]) => {
      heldRef.current = next;
      setHeld(next);
      try {
        localStorage.setItem(storageKey(bid), JSON.stringify(next));
      } catch {
        /* almacenamiento lleno o bloqueado: queda solo en memoria */
      }
    },
    [bid]
  );

  const add = useCallback((ticket: HeldTicket) => persist([ticket, ...heldRef.current]), [persist]);

  const remove = useCallback((id: string) => persist(heldRef.current.filter((t) => t.id !== id)), [persist]);

  /** Saca un ticket de la lista y lo devuelve. */
  const take = useCallback(
    (id: string): HeldTicket | null => {
      const found = heldRef.current.find((t) => t.id === id) ?? null;
      if (found) persist(heldRef.current.filter((t) => t.id !== id));
      return found;
    },
    [persist]
  );

  return { held, add, remove, take };
}
