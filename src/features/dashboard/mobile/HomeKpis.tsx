import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp, Banknote, Boxes, ReceiptText, Siren, TrendingUp } from 'lucide-react';
import { useFx } from '@/contexts/FxContext';
import { formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui';
import { fitAmount, Pill } from '@/components/mobile';
import type { DashboardMetrics, DashPreset } from '../useDashboardMetrics';

const PERIOD: Record<DashPreset, string> = { today: 'hoy', week: 'semana', month: 'mes' };

function Tile({
  label,
  icon: Icon,
  iconClassName,
  value,
  sub,
  footer,
  loading,
  to,
  ariaLabel
}: {
  label: string;
  icon: LucideIcon;
  iconClassName: string;
  value: ReactNode;
  sub?: ReactNode;
  footer: ReactNode;
  loading: boolean;
  /** Toda la tarjeta lleva a esta ruta. */
  to?: string;
  ariaLabel?: string;
}) {
  const body = (
    <>
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="truncate text-label-sm tracking-wider text-on-surface-variant uppercase">{label}</span>
        <Icon className={cn('size-[18px] shrink-0', iconClassName)} aria-hidden />
      </div>
      {loading ? <Skeleton className="my-0.5 h-7 w-24" /> : value}
      {!loading && sub}
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1">{loading ? <Skeleton className="h-4 w-20" /> : footer}</div>
    </>
  );
  const cls = 'flex min-w-0 flex-col rounded-xl bg-surface-container-lowest p-3 shadow-card';
  return to ? (
    <Link to={to} aria-label={ariaLabel} className={cn(cls, 'transition-all hover:shadow-lift active:scale-[0.99]')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Unit({ children }: { children: ReactNode }) {
  return <span className="text-label-sm font-bold tracking-[0.04em] text-on-surface-variant">{children}</span>;
}

export function HomeKpis({
  preset,
  metrics,
  catalog,
  mine,
  money
}: {
  preset: DashPreset;
  metrics: DashboardMetrics;
  catalog: { loading: boolean; activeCount: number; categoryCount: number; lowCount: number; outCount: number };
  /** Sin permiso de reportes: solo sus ventas y sin márgenes. */
  mine: boolean;
  money: (n: number) => string;
}) {
  const fx = useFx();
  const total = money(metrics.total);
  // Bs de las ventas: exacto si todas tienen su tasa; si no, aproximado a la tasa actual.
  const local = !fx.enabled
    ? null
    : metrics.localMissing === 0
      ? fx.formatLocal(metrics.totalLocal)
      : fx.rate
        ? `≈ ${fx.moneyLocal(metrics.total)}`
        : null;
  const up = (metrics.delta ?? 0) >= 0;
  const low = catalog.lowCount;
  const margin = metrics.marginPct;

  return (
    <section aria-label="Indicadores principales" className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Tile
        label={`${mine ? 'Mis ventas' : 'Ventas'} ${PERIOD[preset]}`}
        icon={Banknote}
        iconClassName="text-primary"
        loading={metrics.loading}
        value={<span className={cn('truncate text-on-surface tnum', fitAmount(total))}>{total}</span>}
        sub={local && <span className="truncate text-label-sm font-semibold text-on-surface-variant tnum">{local}</span>}
        footer={
          metrics.delta === null ? (
            <span className="text-label-sm text-outline">{preset === 'today' ? 'Sin ventas ayer a esta hora' : 'Sin período previo'}</span>
          ) : (
            <>
              <Pill tone={up ? 'primary' : 'error'} icon={up ? ArrowUp : ArrowDown}>
                <span className="tnum">{formatPercent(Math.abs(metrics.delta), 1)}</span>
              </Pill>
              <span className="text-label-sm text-outline">{preset === 'today' ? 'vs ayer' : 'vs anterior'}</span>
            </>
          )
        }
      />

      <Tile
        label="Tickets"
        icon={ReceiptText}
        iconClassName="text-secondary"
        loading={metrics.loading}
        value={
          <span className="flex min-w-0 items-baseline gap-1 text-headline-lg-mobile text-on-surface tnum">
            {formatNumber(metrics.count)}
            <Unit>{metrics.count === 1 ? 'ticket' : 'tickets'}</Unit>
          </span>
        }
        footer={
          <Pill tone="neutral" className="min-w-0 overflow-hidden">
            <span className="truncate tnum">Prom. {money(metrics.avg)}</span>
          </Pill>
        }
      />

      <Tile
        label="Stock crítico"
        icon={Siren}
        iconClassName="text-error"
        loading={catalog.loading}
        to={low > 0 ? '/inventario?estado=reponer' : undefined}
        ariaLabel={low > 0 ? `${low} productos por reponer: ver en inventario` : undefined}
        value={
          <span className="flex min-w-0 items-baseline gap-1 text-headline-lg-mobile tnum">
            <span className={low > 0 ? 'text-error' : 'text-on-surface'}>{formatNumber(low)}</span>
            <Unit>{low === 1 ? 'artículo' : 'artículos'}</Unit>
          </span>
        }
        footer={
          low > 0 ? (
            <Pill tone="error" dot>
              {catalog.outCount > 0 ? `${formatNumber(catalog.outCount)} ${catalog.outCount === 1 ? 'agotado' : 'agotados'}` : 'Por reponer'}
            </Pill>
          ) : (
            <Pill tone="primary" dot>
              Todo en orden
            </Pill>
          )
        }
      />

      {mine ? (
        <Tile
          label="Catálogo"
          icon={Boxes}
          iconClassName="text-tertiary"
          loading={catalog.loading}
          value={
            <span className="flex min-w-0 items-baseline gap-1 text-headline-lg-mobile text-on-surface tnum">
              {formatNumber(catalog.activeCount)}
              <Unit>SKUs</Unit>
            </span>
          }
          footer={
            <Pill tone="muted">
              {formatNumber(catalog.categoryCount)} {catalog.categoryCount === 1 ? 'categoría' : 'categorías'}
            </Pill>
          }
        />
      ) : (
        <Tile
          label="Margen bruto"
          icon={TrendingUp}
          iconClassName="text-tertiary"
          loading={metrics.loading}
          value={<span className="text-headline-lg-mobile text-on-surface tnum">{margin === null ? '—' : formatPercent(margin, 1)}</span>}
          footer={
            <Pill tone="muted" className="min-w-0 overflow-hidden">
              <span className="truncate tnum">{metrics.count ? `Ganancia ${metrics.profit < 0 ? '−' : ''}${money(Math.abs(metrics.profit))}` : 'Sin ventas'}</span>
            </Pill>
          }
        />
      )}
    </section>
  );
}
