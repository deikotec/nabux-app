import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Info } from 'lucide-react';
import { Card, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

export type SectionTone = 'primary' | 'secondary' | 'tertiary' | 'error' | 'neutral';

const chipTone: Record<SectionTone, string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
  error: 'text-error',
  neutral: 'text-on-surface-variant'
};

/** Ícono en cuadro suave (esquina superior derecha de cada tarjeta, como en el mockup). */
export function IconChip({ icon: Icon, tone = 'primary', className }: { icon: LucideIcon; tone?: SectionTone; className?: string }) {
  return (
    <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-low', chipTone[tone], className)}>
      <Icon className="size-5" />
    </span>
  );
}

export function SectionHeader({
  title,
  subtitle,
  icon,
  tone = 'primary',
  badge,
  info,
  actions,
  size = 'sm',
  className
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  tone?: SectionTone;
  badge?: ReactNode;
  /** Texto de ayuda (tooltip nativo junto al título). */
  info?: string;
  actions?: ReactNode;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  // Móvil: título + ícono en la primera fila y acciones debajo. Desde sm: todo en una fila.
  return (
    <div className={cn('mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]', className)}>
      <div className="col-start-1 row-start-1 flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={cn('text-on-surface', size === 'lg' ? 'text-headline-sm sm:text-headline-md' : 'text-headline-sm')}>
            {title}
            {info && (
              <span title={info} aria-label={info} className="ml-1.5 inline-block align-[-2px] text-outline">
                <Info className="size-4" />
              </span>
            )}
          </h2>
          {badge}
        </div>
        {subtitle && <p className="text-body-sm text-on-surface-variant">{subtitle}</p>}
      </div>
      {icon && <IconChip icon={icon} tone={tone} className="col-start-2 row-start-1 sm:col-start-3" />}
      {actions && (
        <div className="col-span-2 row-start-2 flex flex-wrap items-center justify-end gap-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">{actions}</div>
      )}
    </div>
  );
}

/** Tarjeta de sección con el estilo base del sistema. */
export function SectionCard({ className, children }: { className?: string; children: ReactNode }) {
  return <Card className={cn('flex min-w-0 flex-col', className)}>{children}</Card>;
}

/** Mensaje compacto dentro de una tarjeta sin datos. */
export function InlineEmpty({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl bg-surface-container-low/60 px-4 py-8 text-center">
      <Icon className="size-6 text-outline" />
      <p className="max-w-xs text-body-sm text-on-surface-variant">{children}</p>
    </div>
  );
}

/** Esqueleto genérico de una lista (filas con dos líneas y monto). */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-7 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
