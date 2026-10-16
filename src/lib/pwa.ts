/** ¿La app se abrió instalada (desde el ícono en la pantalla de inicio o el escritorio)? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const media = (q: string) => window.matchMedia?.(q).matches ?? false;
  return (
    media('(display-mode: standalone)') ||
    media('(display-mode: fullscreen)') ||
    media('(display-mode: window-controls-overlay)') ||
    // Safari en iOS
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
