import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Limita el alto de un panel "sticky" para que su borde inferior nunca quede fuera de la ventana,
 * aunque el panel todavía no esté pegado arriba (así el botón Cobrar siempre está a la vista).
 */
export function useFitToViewport<T extends HTMLElement>(enabled: boolean, bottomGap = 16, minHeight = 360) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = Math.max(el.getBoundingClientRect().top, 0);
      el.style.maxHeight = `${Math.max(minHeight, Math.floor(window.innerHeight - top - bottomGap))}px`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(document.body);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      ro?.disconnect();
      el.style.maxHeight = '';
    };
  }, [enabled, bottomGap, minHeight]);
  return ref;
}

export { useMediaQuery } from '@/hooks/useMediaQuery';

const AUTO_PRINT_KEY = 'nabux:pos:autoprint';

/**
 * Por defecto la impresión automática solo se activa en computadoras: en celulares y tabletas (pantalla táctil) lo normal
 * es no tener una impresora de tickets conectada. Si la tienen (ej. Bluetooth), la activan a mano.
 */
function defaultAutoPrint() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
}

/** Preferencia del equipo: imprimir el ticket automáticamente al cobrar. */
export function useAutoPrint(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTO_PRINT_KEY);
      return saved === null ? defaultAutoPrint() : saved !== '0';
    } catch {
      return defaultAutoPrint();
    }
  });
  const update = useCallback((v: boolean) => {
    setValue(v);
    try {
      localStorage.setItem(AUTO_PRINT_KEY, v ? '1' : '0');
    } catch {
      /* sin almacenamiento local */
    }
  }, []);
  return [value, update];
}
