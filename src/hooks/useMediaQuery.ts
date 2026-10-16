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
