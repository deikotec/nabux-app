import { useEffect, useState } from 'react';

/** Coincidencia de una media query, reactiva a cambios de tamaño. */
export function useMediaQuery(mediaQuery: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(mediaQuery).matches);
  useEffect(() => {
    const mql = window.matchMedia(mediaQuery);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [mediaQuery]);
  return matches;
}

/**
 * Escritorio (barra lateral, tablas) a partir de `lg` (1024 px). Por debajo, la versión móvil:
 * barra superior e inferior tipo app y pantallas propias (ver ref/movil).
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
