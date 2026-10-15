import { Flame } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';

/** Pantalla que se muestra si falta .env.local con la configuración de Firebase. */
export function SetupRequired() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface p-6">
      <div className="flex w-full max-w-xl flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <Logo />
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-amber-900">
          <Flame className="mt-0.5 size-5 shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="text-label-lg">Falta conectar Firebase</span>
            <span className="text-body-md">
              Crea el archivo <code className="rounded bg-white px-1">.env.local</code> en la raíz del proyecto (copia{' '}
              <code className="rounded bg-white px-1">.env.example</code>) y pega la configuración de tu app web de Firebase. Luego reinicia{' '}
              <code className="rounded bg-white px-1">npm run dev</code>.
            </span>
          </div>
        </div>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-body-md text-on-surface-variant">
          <li>Consola de Firebase → crea un proyecto.</li>
          <li>Authentication → habilita “Correo/contraseña” y “Google”.</li>
          <li>Firestore Database y Storage → créalos (modo producción).</li>
          <li>Configuración del proyecto → Tus apps → agrega una app Web y copia el objeto de configuración.</li>
        </ol>
      </div>
    </div>
  );
}
