import { useEffect, useRef } from 'react';
import { anyDialogOpen, blockingDialogOpen, isEditableTarget } from '../posUtils';

export interface PosShortcutHandlers {
  /** F2 */
  onSearch: () => void;
  /** F3 */
  onFreeAmount: () => void;
  /** F8 */
  onHold: () => void;
  /** F9 */
  onDiscount: () => void;
  /** F10 */
  onCheckout: () => void;
  /** Esc (sin diálogos abiertos) */
  onEscape: () => void;
  /** Tecla imprimible fuera de un campo de texto: redirige al buscador (escáner). */
  onTypeAhead: () => void;
}

const FKEYS = ['F2', 'F3', 'F8', 'F9', 'F10'] as const;
type FKey = (typeof FKEYS)[number];

/**
 * Atajos globales del POS. Las teclas F se ignoran si hay un diálogo abierto
 * distinto del panel de ticket móvil. F2 fuera de /pos lo maneja el layout.
 */
export function usePosShortcuts(handlers: PosShortcutHandlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current;
      if ((FKEYS as readonly string[]).includes(e.key)) {
        // Evita la acción del navegador (F3 buscar, F10 menú) aunque no actuemos.
        e.preventDefault();
        if (e.repeat || blockingDialogOpen()) return;
        const map: Record<FKey, () => void> = {
          F2: h.onSearch,
          F3: h.onFreeAmount,
          F8: h.onHold,
          F9: h.onDiscount,
          F10: h.onCheckout
        };
        map[e.key as FKey]();
        return;
      }
      if (e.key === 'Escape') {
        if (!anyDialogOpen()) h.onEscape();
        return;
      }
      if (
        e.key.length === 1 &&
        e.key !== ' ' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isEditableTarget(e.target) &&
        !anyDialogOpen()
      ) {
        h.onTypeAhead();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
