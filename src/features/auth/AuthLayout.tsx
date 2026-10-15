import type { ReactNode } from 'react';
import { BarChart3, Boxes, CloudOff, ShieldCheck, ShoppingCart, Users } from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '@/config/app';
import { Logo } from '@/components/layout/Logo';

const FEATURES = [
  { icon: ShoppingCart, title: 'Punto de venta rápido', text: 'Cobra con escáner, efectivo, tarjeta o QR e imprime tickets.' },
  { icon: Boxes, title: 'Inventario en tiempo real', text: 'Stock, costos, márgenes y alertas de reposición automáticas.' },
  { icon: BarChart3, title: 'Reportes que se entienden', text: 'Ventas, utilidad, horas pico y cortes de caja al día.' },
  { icon: Users, title: 'Tu equipo, con permisos', text: 'Invita cajeros y encargados; cada quien ve lo que le toca.' },
  { icon: CloudOff, title: 'Funciona sin internet', text: 'Sigue vendiendo y todo se sincroniza al volver la conexión.' }
];

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-[#00704c] to-[#004d35] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-primary-fixed/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 size-[28rem] rounded-full bg-secondary-container/20 blur-3xl" />
        <Logo light />
        <div className="relative flex max-w-lg flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-display-lg">{APP_TAGLINE}.</h1>
            <p className="text-body-lg text-white/80">
              Crea tu cuenta, registra tu negocio y controla ventas, stock y personal desde cualquier dispositivo.
            </p>
          </div>
          <ul className="flex flex-col gap-4">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/20">
                  <f.icon className="size-[18px]" />
                </span>
                <span className="flex flex-col">
                  <span className="text-label-lg">{f.title}</span>
                  <span className="text-body-md text-white/75">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative flex items-center gap-2 text-body-sm text-white/70">
          <ShieldCheck className="size-4" /> Tus datos se guardan cifrados en Google Firebase.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center px-5 py-10 sm:px-10">
        <div className="flex w-full max-w-md flex-col gap-6">
          <Logo className="lg:hidden" />
          <div className="flex flex-col gap-1">
            <h2 className="text-headline-lg">{title}</h2>
            {subtitle && <p className="text-body-md text-on-surface-variant">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="text-center text-body-md text-on-surface-variant">{footer}</div>}
          <p className="text-center text-body-sm text-slate-400">
            © {new Date().getFullYear()} {APP_NAME}
          </p>
        </div>
      </div>
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function Divider({ label = 'o' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-body-sm text-slate-400">
      <span className="h-px flex-1 bg-slate-200" />
      {label}
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
