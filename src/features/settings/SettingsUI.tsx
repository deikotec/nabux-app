import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Info, RotateCcw, Save, TriangleAlert } from 'lucide-react';
import { Button, Card, Skeleton, Toggle } from '@/components/ui';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useNow, type PendingChanges } from './settingsState';

const iconToneClasses = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
  error: 'text-error'
};

/** Tarjeta de sección con ícono, título, subtítulo e insignia (estilo del mockup). */
export function SettingsCard({
  icon: Icon,
  iconTone = 'primary',
  title,
  subtitle,
  badge,
  children,
  className
}: {
  icon: LucideIcon;
  iconTone?: keyof typeof iconToneClasses;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('flex flex-col gap-4 p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-low', iconToneClasses[iconTone])}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-headline-sm text-on-surface">{title}</h2>
            {subtitle && <p className="text-body-sm text-on-surface-variant">{subtitle}</p>}
          </div>
        </div>
        {badge && <div className="hidden shrink-0 sm:block">{badge}</div>}
      </div>
      {children}
    </Card>
  );
}

/** Bloque gris con etiqueta, control y ayuda (ej. "Stock mínimo por defecto"). */
export function InsetPanel({
  label,
  aside,
  hint,
  children,
  className,
  htmlFor
}: {
  label: ReactNode;
  aside?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-xl bg-surface-container-low p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-label-md text-on-surface">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {hint && <div className="text-body-sm text-on-surface-variant">{hint}</div>}
    </div>
  );
}

/** Fila de regla con interruptor; admite contenido extra (ej. botón "Probar sonido"). */
export function RuleToggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  extra
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low/70 p-4 transition-colors hover:bg-surface-container-low">
      {/* El <label> da nombre accesible al interruptor y permite activarlo tocando el texto. */}
      <label className={cn('flex items-center justify-between gap-4', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-label-lg text-on-surface">{label}</span>
          {description && <span className="text-body-sm text-on-surface-variant">{description}</span>}
        </span>
        <Toggle checked={checked} onChange={onChange} disabled={disabled} />
      </label>
      {extra && <div>{extra}</div>}
    </div>
  );
}

const statToneClasses = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  tertiary: 'bg-tertiary/10 text-tertiary',
  error: 'bg-error/10 text-error'
};

/** Tarjeta resumen inferior (Reglas activas, Artículos bajo monitoreo…). */
export function StatTile({
  label,
  value,
  footer,
  icon: Icon,
  tone = 'primary',
  loading
}: {
  label: ReactNode;
  value: ReactNode;
  footer?: ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof statToneClasses;
  loading?: boolean;
}) {
  return (
    <Card className="flex items-center justify-between gap-4 p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-label-md tracking-wider text-on-surface-variant uppercase">{label}</span>
        {loading ? <Skeleton className="h-9 w-28" /> : <span className="truncate text-headline-lg text-on-surface tnum">{value}</span>}
        {footer && <div className="text-body-sm text-on-surface-variant">{footer}</div>}
      </div>
      <div className={cn('flex size-12 shrink-0 items-center justify-center rounded-full sm:size-14', statToneClasses[tone])}>
        <Icon className="size-6 sm:size-7" />
      </div>
    </Card>
  );
}

/** Aviso en línea (información o advertencia). */
export function Callout({ tone = 'info', icon, title, children, className }: { tone?: 'info' | 'warning'; icon?: LucideIcon; title?: ReactNode; children?: ReactNode; className?: string }) {
  const Icon = icon ?? (tone === 'warning' ? TriangleAlert : Info);
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3.5',
        tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-secondary-fixed bg-secondary-fixed/40 text-on-secondary-fixed-variant',
        className
      )}
    >
      <Icon className="mt-0.5 size-[18px] shrink-0" />
      <div className="flex min-w-0 flex-col gap-0.5 text-body-sm">
        {title && <span className="text-label-md">{title}</span>}
        {children}
      </div>
    </div>
  );
}

/** Barra fija inferior con "Hay cambios sin guardar…". */
export function SaveBar({ pending }: { pending: PendingChanges }) {
  useNow();
  return (
    <div
      role="region"
      aria-label="Cambios sin guardar"
      className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 mt-6 flex animate-pop-in flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-overlay sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-label-md text-on-surface">Hay cambios sin guardar en {pending.area}</span>
          <span className="text-body-sm text-on-surface-variant">
            {pending.changedAt ? `Modificado ${formatRelative(pending.changedAt)}. ` : ''}
            {pending.canSave ? 'Al guardar se aplican de inmediato en todas las cajas del negocio.' : 'Revisa los campos marcados antes de guardar.'}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
        <Button variant="ghost" icon={RotateCcw} onClick={pending.discard} disabled={pending.saving} className="flex-1 sm:flex-none">
          Descartar
        </Button>
        <Button icon={Save} onClick={pending.save} loading={pending.saving} disabled={!pending.canSave} className="flex-1 sm:flex-none">
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
