import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Ban, Calculator, ReceiptText, TrendingUp, Wallet } from 'lucide-react';
import { formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui';
import type { SalesStats } from './saleUtils';

const toneClass = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
  error: 'text-error'
} as const;

/**
 * Tarjeta de resumen con el mismo lenguaje que los KPI del panel, pero con el ícono junto a la
 * etiqueta para que el monto use todo el ancho (caben dos por fila a 360 px).
 */
function Stat({
  label,
  icon: Icon,
  tone,
  value,
  footer,
  loading,
  className
}: {
  label: string;
  icon: LucideIcon;
  tone: keyof typeof toneClass;
  value: string;
  footer: ReactNode;
  loading: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card', className)}>
      <span className="flex min-w-0 items-center gap-2 text-label-md text-on-surface-variant">
        <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-container-low', toneClass[tone])}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="truncate">{label}</span>
      </span>
      {loading ? (
        <Skeleton className="my-1 h-8 w-28" />
      ) : (
        <span className="mt-1 truncate text-headline-md text-on-surface tnum sm:text-headline-lg xl:text-headline-md 2xl:text-headline-lg" title={value}>
          {value}
        </span>
      )}
      <span className="text-body-sm text-on-surface-variant">{loading ? ' ' : footer}</span>
    </div>
  );
}

export function SalesSummary({
  stats,
  days,
  loading,
  showProfit,
  money
}: {
  stats: SalesStats;
  /** Días del período (para el promedio diario). */
  days: number;
  loading: boolean;
  showProfit: boolean;
  money: (n: number) => string;
}) {
  const perDay = days > 0 ? stats.count / days : 0;
  const unitsPerTicket = stats.count ? stats.units / stats.count : 0;
  return (
    <section
      aria-label="Resumen del período"
      className={cn('grid grid-cols-2 gap-3 sm:gap-4', showProfit ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4')}
    >
      <Stat
        label="Total vendido"
        icon={Wallet}
        tone="primary"
        loading={loading}
        value={money(stats.total)}
        footer={<span className="tnum">{formatNumber(stats.units)} artículos vendidos</span>}
        className={showProfit ? 'col-span-2 xl:col-span-1' : undefined}
      />
      <Stat
        label="Tickets"
        icon={ReceiptText}
        tone="secondary"
        loading={loading}
        value={formatNumber(stats.count)}
        footer={<span className="tnum">{days > 1 ? `~${formatNumber(perDay, 'es-MX', 1)} por día` : 'Completados'}</span>}
      />
      <Stat
        label="Ticket promedio"
        icon={Calculator}
        tone="tertiary"
        loading={loading}
        value={money(stats.avg)}
        footer={<span className="tnum">{formatNumber(unitsPerTicket, 'es-MX', 1)} art. por ticket</span>}
      />
      <Stat
        label="Anuladas"
        icon={Ban}
        tone="error"
        loading={loading}
        value={money(stats.voidedTotal)}
        footer={
          <span className={cn('tnum', stats.voidedCount > 0 && 'font-semibold text-error')}>
            {stats.voidedCount === 1 ? '1 ticket anulado' : `${formatNumber(stats.voidedCount)} tickets anulados`}
          </span>
        }
      />
      {showProfit && (
        <Stat
          label="Utilidad bruta"
          icon={TrendingUp}
          tone="primary"
          loading={loading}
          value={money(stats.profit)}
          footer={<span className="tnum">Margen {formatPercent(stats.marginPct)}</span>}
        />
      )}
    </section>
  );
}
