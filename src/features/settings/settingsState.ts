import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Pestañas de la pantalla (también se usan como valor de ?tab= en la URL). */
export type SettingsTabId = 'negocio' | 'impuestos' | 'reglas' | 'categorias' | 'proveedores' | 'lector';

/** Lo que una pestaña con formulario reporta a la página (para la barra fija y el cambio de pestaña). */
export interface PendingChanges {
  /** Nombre corto de lo que se edita ("los datos del negocio"). */
  area: string;
  dirty: boolean;
  saving: boolean;
  /** false si el formulario tiene errores de validación. */
  canSave: boolean;
  /** Cuándo empezaron los cambios sin guardar (ms). */
  changedAt: number | null;
  save: () => void;
  discard: () => void;
}

type Reporter = (p: PendingChanges | null) => void;

export const PendingContext = createContext<Reporter>(() => undefined);

/**
 * Registra el estado de un formulario en la página de Configuración.
 * La página pinta la barra "Hay cambios sin guardar…" y pide confirmación al cambiar de pestaña.
 */
export function usePendingChanges({
  area,
  dirty,
  saving,
  canSave = true,
  onSave,
  onDiscard
}: {
  area: string;
  dirty: boolean;
  saving: boolean;
  canSave?: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const report = useContext(PendingContext);
  const handlers = useRef({ onSave, onDiscard });
  useLayoutEffect(() => {
    handlers.current = { onSave, onDiscard };
  });

  const [changedAt, setChangedAt] = useState<number | null>(null);
  useEffect(() => {
    setChangedAt((prev) => (dirty ? (prev ?? Date.now()) : null));
  }, [dirty]);

  useEffect(() => {
    report({
      area,
      dirty,
      saving,
      canSave,
      changedAt,
      save: () => handlers.current.onSave(),
      discard: () => handlers.current.onDiscard()
    });
  }, [report, area, dirty, saving, canSave, changedAt]);

  useEffect(() => () => report(null), [report]);
}

/**
 * Estado local de un formulario inicializado desde datos de Firestore.
 * - `dirty` compara contra la última versión guardada.
 * - Si los datos cambian desde fuera (otro dispositivo o tras guardar) y no hay cambios locales,
 *   el formulario se actualiza solo; si hay cambios locales, se conservan.
 */
export function useSyncedForm<T extends object>(source: T) {
  const key = JSON.stringify(source);
  const [state, setState] = useState(() => ({ values: source, baseline: source, key }));

  let current = state;
  if (state.key !== key) {
    const wasDirty = JSON.stringify(state.values) !== JSON.stringify(state.baseline);
    current = { values: wasDirty ? state.values : source, baseline: source, key };
    setState(current);
  }

  const dirty = JSON.stringify(current.values) !== JSON.stringify(current.baseline);

  const set = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setState((s) => ({ ...s, values: { ...s.values, [field]: value } }));
  }, []);

  const patch = useCallback((p: Partial<T>) => {
    setState((s) => ({ ...s, values: { ...s.values, ...p } }));
  }, []);

  const reset = useCallback(() => {
    setState((s) => ({ ...s, values: s.baseline }));
  }, []);

  return { values: current.values, baseline: current.baseline, dirty, set, patch, reset };
}

/**
 * Espera una escritura de Firestore solo si hay conexión. Sin conexión, Firestore la deja en cola
 * (la promesa no se resuelve hasta reconectar), así que no bloqueamos la interfaz.
 * Devuelve true si quedó confirmada en el servidor.
 */
export async function persist(write: Promise<unknown>, online: boolean): Promise<boolean> {
  if (online) {
    await write;
    return true;
  }
  write.catch((e) => console.warn('Escritura pendiente falló', e));
  return false;
}

/** Re-render periódico para textos relativos ("hace 2 minutos"). */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
