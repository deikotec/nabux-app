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
 * `sub` es la línea secundaria bajo el monto (equivalente en Bs en modo bimonetario).
 */
function Stat({
  label,
  icon: Icon,
  tone,
  value,
  sub,
  footer,
  loading,
  className
}: {
  label: string;
  icon: LucideIcon;
  tone: keyof typeof toneClass;
  value: string;
  sub?: ReactNode;
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
      {sub !== undefined && (loading ? <Skeleton className="h-4 w-24" /> : <span className="min-w-0 text-label-lg text-on-surface-variant tnum">{sub}</span>)}
      <span className="mt-auto pt-0.5 text-body-sm text-on-surface-variant">{loading ? ' ' : footer}</span>
    </div>
  );
}

export function SalesSummary({
  stats,
  days,
  loading,
  showProfit,
  money,
  formatLocal
}: {
  stats: SalesStats;
  /** Días del período (para el promedio diario). */
  days: number;
  loading: boolean;
  showProfit: boolean;
  money: (n: number) => string;
  /** Formateador en moneda local (solo en modo bimonetario): agrega el equivalente en Bs. */
  formatLocal?: (n: number) => string;
}) {
  const perDay = days > 0 ? stats.count / days : 0;
  const unitsPerTicket = stats.count ? stats.units / stats.count : 0;
  const withLocal = stats.count - stats.localMissing;

  // Equivalente en Bs: suma de lo registrado en cada venta (a su propia tasa).
  const localSub = (amount: number, known: number, missing: number): ReactNode => {
    if (!formatLocal) return undefined;
    if (known === 0 && missing > 0) return <span className="text-body-sm">Sin tasa registrada</span>;
    return (
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5" title="Suma de cada venta a la tasa con que se cobró">
        <span className="max-w-full min-w-0 truncate">{formatLocal(amount)}</span>
        {missing > 0 && (
          <span className="text-body-sm font-normal whitespace-nowrap text-amber-700" title={`${formatNumber(missing)} ${missing === 1 ? 'venta no tiene' : 'ventas no tienen'} tasa registrada y no se incluye${missing === 1 ? '' : 'n'}`}>
            +{formatNumber(missing)} sin tasa
          </span>
        )}
      </span>
    );
  };

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
        sub={localSub(stats.totalLocal, withLocal, stats.localMissing)}
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
        sub={formatLocal ? (withLocal > 0 ? formatLocal(stats.totalLocal / withLocal) : localSub(0, 0, stats.localMissing)) : undefined}
        footer={<span className="tnum">{formatNumber(unitsPerTicket, 'es-MX', 1)} art. por ticket</span>}
      />
      <Stat
        label="Anuladas"
        icon={Ban}
        tone="error"
        loading={loading}
        value={money(stats.voidedTotal)}
        sub={localSub(stats.voidedLocal, stats.voidedCount - stats.voidedLocalMissing, stats.voidedLocalMissing)}
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
