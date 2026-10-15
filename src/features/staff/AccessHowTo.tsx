import type { LucideIcon } from 'lucide-react';
import { Info, LogIn, MailPlus, Send, UserCheck } from 'lucide-react';
import { APP_NAME } from '@/config/app';
import { cn } from '@/lib/utils';

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: MailPlus, title: 'Invitas por correo', text: 'Eliges rol, turno y permisos. La invitación queda pendiente en esta lista.' },
  { icon: Send, title: 'Le compartes el acceso', text: `Copia el mensaje o envíalo por WhatsApp: ${APP_NAME} no envía correos automáticos.` },
  { icon: LogIn, title: 'La persona entra', text: 'Con Google o creando su cuenta con ESE mismo correo (y verificándolo).' },
  { icon: UserCheck, title: 'Acepta y listo', text: 'En la pantalla de bienvenida pulsa “Unirme” y aparece en tu equipo.' }
];

/** Explicación simple de cómo alguien obtiene acceso al negocio. */
export function AccessHowTo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <section
      aria-label="Cómo funciona el acceso"
      className={cn(compact ? 'rounded-xl bg-surface-container-low p-4' : 'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card', className)}
    >
      <div className="mb-3 flex items-center gap-2">
        <Info className="size-4 text-primary" aria-hidden />
        <h3 className="text-label-lg text-on-surface">¿Cómo obtiene acceso tu equipo?</h3>
      </div>
      <ol className={cn('grid gap-3', compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4')}>
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3">
            <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-fixed/35 text-on-primary-fixed-variant">
              <s.icon className="size-[18px]" aria-hidden />
              <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white tnum">
                {i + 1}
              </span>
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-label-md text-on-surface">{s.title}</span>
              <span className="text-body-sm text-on-surface-variant">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
