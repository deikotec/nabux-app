import { Link } from 'react-router';
import { ArrowRight, Boxes, Coins, ReceiptText, TriangleAlert } from 'lucide-react';
import { Sparkline } from '@/components/charts';
import { DeltaChip, KpiCard } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DashboardMetrics, DashPreset } from './useDashboardMetrics';
import { PRESET_COPY } from './useDashboardMetrics';

function Unit({ children, inherit }: { children: string; inherit?: boolean }) {
  return <span className={cn('ml-1 text-body-md font-normal', !inherit && 'text-on-surface-variant')}>{children}</span>;
}

export function KpiGrid({
  preset,
  metrics,
  mine,
  catalog,
  money
}: {
  preset: DashPreset;
  metrics: DashboardMetrics;
  /** Usuario sin permiso de reportes: solo sus ventas y sin valorización. */
  mine: boolean;
  catalog: { loading: boolean; activeCount: number; categoryCount: number; valuation: number; lowCount: number; outCount: number };
  money: (n: number) => string;
}) {
  const copy = PRESET_COPY[preset];
  const critical = catalog.lowCount > 0;

  return (
    <section aria-label="Indicadores principales" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label={mine ? `Mis ventas ${copy.period}` : `Ventas ${copy.period}`}
        value={money(metrics.total)}
        icon={Coins}
        tone="primary"
        loading={metrics.loading}
        footer={
          <div className="flex items-end justify-between gap-3">
            {metrics.loading ? (
              <span className="h-5 w-28 animate-pulse rounded bg-slate-100" />
            ) : metrics.delta === null ? (
              <span className="min-w-0">{preset === 'today' ? 'Sin ventas ayer a esta hora' : 'Sin ventas en el período anterior'}</span>
            ) : (
              <span className="flex min-w-0 flex-col items-start gap-0.5">
                <span className="whitespace-nowrap">
                  <DeltaChip value={metrics.delta} />
                </span>
                <span>{copy.vs}</span>
              </span>
            )}
            <Sparkline data={metrics.spark} className="shrink-0" />
          </div>
        }
      />

      <KpiCard
        label={mine ? `Mis transacciones ${copy.period}` : `Transacciones ${copy.period}`}
        value={
          <>
            {formatNumber(metrics.count)}
            <Unit>{metrics.count === 1 ? 'ticket' : 'tickets'}</Unit>
          </>
        }
        icon={ReceiptText}
        tone="secondary"
        loading={metrics.loading}
        footer={
          <div className="flex items-center justify-between gap-3">
            <span>Ticket promedio</span>
            <span className="rounded bg-surface-container-low px-1.5 py-0.5 text-label-lg text-on-surface tnum">{money(metrics.avg)}</span>
          </div>
        }
      />

      <KpiCard
        label="Catálogo activo"
        value={
          <>
            {formatNumber(catalog.activeCount)}
            <Unit>SKUs</Unit>
          </>
        }
        icon={Boxes}
        tone="tertiary"
        loading={catalog.loading}
        footer={
          mine ? (
            <span>
              En <b className="text-on-surface tnum">{formatNumber(catalog.categoryCount)}</b> {catalog.categoryCount === 1 ? 'categoría' : 'categorías'}
            </span>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span>Valorización a costo</span>
              <span className="text-data-mono font-bold text-on-surface tnum">{money(catalog.valuation)}</span>
            </div>
          )
        }
      />

      <KpiCard
        label="Stock crítico"
        value={
          <>
            {formatNumber(catalog.lowCount)}
            <Unit inherit={critical}>{catalog.lowCount === 1 ? 'producto' : 'productos'}</Unit>
          </>
        }
        icon={TriangleAlert}
        tone="error"
        highlight={critical}
        loading={catalog.loading}
        footer={
          <div className="flex items-center justify-between gap-3">
            <span>
              {critical
                ? catalog.outCount > 0
                  ? `${formatNumber(catalog.outCount)} ${catalog.outCount === 1 ? 'agotado' : 'agotados'} · bajo el mínimo`
                  : 'Por debajo del mínimo'
                : 'Todo el inventario sobre el mínimo'}
            </span>
            {critical && (
              <Link
                to="/inventario?estado=bajo"
                className="inline-flex shrink-0 items-center gap-0.5 rounded text-label-sm font-bold text-error hover:underline focus-visible:ring-2 focus-visible:ring-error/40 focus-visible:outline-none"
              >
                Ver lista <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            )}
          </div>
        }
      />
    </section>
  );
}
