import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { APP_NAME } from '@/config/app';
import { useAuth } from '@/contexts/AuthContext';
import { Button, useToast } from '@/components/ui';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Registra el service worker y avisa cuando hay una versión nueva.
 * La actualización espera a que el usuario la acepte para no recargar a mitad de una venta.
 */
export function PwaPrompt() {
  const { user } = useAuth();
  const toast = useToast();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // El POS puede quedar abierto todo el día: se buscan versiones nuevas cada hora.
      setInterval(() => {
        if (navigator.onLine && !registration.installing) registration.update().catch(() => undefined);
      }, UPDATE_CHECK_MS);
    },
    onRegisterError(error) {
      console.warn('No se pudo registrar el service worker', error);
    }
  });

  // Primera instalación: solo se avisa a quien usa la app (no a visitantes de la landing).
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (!offlineReady || !user || notifiedRef.current) return;
    notifiedRef.current = true;
    toast.success(`${APP_NAME} quedó guardada en este dispositivo: ya abre aunque no tengas internet.`);
    setOfflineReady(false);
  }, [offlineReady, user, toast, setOfflineReady]);

  if (!needRefresh) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[85] flex justify-center px-4">
      <div
        role="alert"
        className="pointer-events-auto flex w-full max-w-md animate-pop-in items-center gap-3 rounded-xl bg-inverse-surface py-2.5 pr-2 pl-4 text-white shadow-overlay"
      >
        <RefreshCw className="size-5 shrink-0 text-primary-fixed-dim" />
        <div className="min-w-0 flex-1">
          <p className="text-label-lg">Hay una versión nueva de {APP_NAME}</p>
          <p className="text-body-sm text-inverse-on-surface/80">Actualiza cuando termines la venta en curso.</p>
        </div>
        <Button size="sm" onClick={() => updateServiceWorker(true)}>
          Actualizar
        </Button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Más tarde"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
