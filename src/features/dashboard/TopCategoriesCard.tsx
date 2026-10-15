import { ChartPie, Sparkles } from 'lucide-react';
import { BarList, CHART_COLORS } from '@/components/charts';
import { Card, Skeleton } from '@/components/ui';
import { formatPercent } from '@/lib/format';
import type { CategoryShare, DashPreset } from './useDashboardMetrics';
import { PRESET_COPY } from './useDashboardMetrics';

const OTHERS_COLOR = '#94a3b8';

export function TopCategoriesCard({
  categories,
  loading,
  preset,
  mine,
  money
}: {
  categories: CategoryShare[];
  loading: boolean;
  preset: DashPreset;
  mine: boolean;
  money: (n: number) => string;
}) {
  const period = PRESET_COPY[preset].period;
  const lead = categories[0];

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-headline-sm text-on-surface">Categorías más vendidas</h2>
          <p className="text-body-sm text-on-surface-variant">
            {mine ? 'En tus ventas' : 'Ventas'} {period}
          </p>
        </div>
        <span className="pt-1 text-label-sm text-on-surface-variant">Participación</span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
          <ChartPie className="size-7 text-slate-300" aria-hidden />
          <p className="text-body-sm text-on-surface-variant">Sin ventas {period}. Aquí verás qué categorías se venden más.</p>
        </div>
      ) : (
        <>
          <BarList
            items={categories.map((c, i) => ({
              label: c.name,
              value: c.total,
              color: c.other ? OTHERS_COLOR : CHART_COLORS[i % CHART_COLORS.length],
              display: (
                <span className="inline-flex items-baseline gap-2">
                  <span className="text-body-sm font-normal text-on-surface-variant">{money(c.total)}</span>
                  <span className="font-bold">{formatPercent(c.pct, 0)}</span>
                </span>
              )
            }))}
          />
          {lead && (
            <p className="flex gap-2 rounded-lg bg-surface-container-low p-3 text-body-sm text-on-surface-variant">
              <Sparkles className="mt-px size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <b className="text-on-surface">{lead.name}</b> lidera con el {formatPercent(lead.pct, 0)} de lo vendido {period}
                {lead.topProduct ? (
                  <>
                    , impulsada por <b className="text-on-surface">{lead.topProduct}</b>
                  </>
                ) : null}
                .
              </span>
            </p>
          )}
        </>
      )}
    </Card>
  );
}
