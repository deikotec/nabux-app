import { CalendarCheck, ChartLine, Clock, Gauge, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import { AreaChart } from '@/components/charts';
import { Card, Skeleton } from '@/components/ui';
import { formatDate, formatNumber } from '@/lib/format';
import { CLOSING_HOUR, type DashboardMetrics, type DashPreset } from './useDashboardMetrics';

const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;

function Insight({ icon: Icon, label, value, hint }: { icon: typeof Clock; label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-card">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-body-sm text-on-surface-variant">{label}</span>
        <span className="text-headline-sm text-on-surface tnum">{value}</span>
        {hint && <span className="text-body-sm text-on-surface-variant">{hint}</span>}
      </div>
    </div>
  );
}

export function RevenueCard({
  preset,
  metrics,
  money,
  moneyCompact
}: {
  preset: DashPreset;
  metrics: DashboardMetrics;
  money: (n: number) => string;
  moneyCompact: (n: number) => string;
}) {
  const { loading, series, projection, peakHour, bestDay } = metrics;

  const first: ReactNode =
    preset === 'today' ? (
      projection ? (
        <Insight
          icon={projection.closed ? CalendarCheck : Gauge}
          label={projection.closed ? 'Cierre de jornada' : `Proyección al cierre (${pad(CLOSING_HOUR)})`}
          value={<span className="text-primary">{money(projection.projected)}</span>}
          hint={`Ritmo: ~${formatNumber(projection.ticketsPerHour, 'es-MX', 1)} ventas/h · ${money(projection.perHour)}/h`}
        />
      ) : (
        <Insight icon={Gauge} label="Proyección al cierre" value="—" hint="Se calcula con la primera venta del día" />
      )
    ) : (
      <Insight
        icon={Gauge}
        label="Promedio por día"
        value={<span className="text-primary">{money(metrics.avgPerDay)}</span>}
        hint={`${formatNumber(metrics.count)} tickets en el período`}
      />
    );

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-headline-md text-on-surface">Curva de ingresos</h2>
          <p className="text-body-sm text-on-surface-variant">{metrics.seriesTitle}</p>
        </div>
        {!loading && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-fixed px-2.5 py-1 text-label-sm text-on-secondary-fixed-variant tnum">
            <span className="size-1.5 rounded-full bg-secondary" aria-hidden />
            {money(metrics.seriesTotal)} · {formatNumber(metrics.seriesCount)} tickets
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-[240px] w-full" />
      ) : metrics.seriesTotal === 0 ? (
        <div className="flex h-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-center">
          <ChartLine className="size-8 text-slate-300" aria-hidden />
          <p className="text-label-lg text-on-surface">Aún no hay ingresos en estos días</p>
          <p className="max-w-xs text-body-sm text-on-surface-variant">Cuando registres ventas verás aquí la tendencia diaria.</p>
        </div>
      ) : (
        <AreaChart
          height={240}
          formatValue={money}
          formatAxis={moneyCompact}
          data={series.map((p) => ({
            label: p.label,
            value: p.value,
            highlight: p.isToday,
            detail: `${formatNumber(p.count)} ${p.count === 1 ? 'ticket' : 'tickets'}`
          }))}
        />
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl bg-surface-container-low p-4 sm:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)
        ) : (
          <>
            {first}
            <Insight
              icon={Clock}
              label="Hora pico"
              value={peakHour ? `${pad(peakHour.hour)} – ${pad((peakHour.hour + 1) % 24)}` : '—'}
              hint={peakHour ? `${formatNumber(peakHour.count)} ${peakHour.count === 1 ? 'venta' : 'ventas'} · ${money(peakHour.total)}` : 'Sin ventas en el período'}
            />
            <Insight
              icon={Trophy}
              label="Mejor día"
              value={bestDay ? money(bestDay.value) : '—'}
              hint={bestDay ? (bestDay.isToday ? 'Hoy' : formatDate(bestDay.date, { weekday: 'long', day: 'numeric', month: 'short' })) : 'Sin ventas registradas'}
            />
          </>
        )}
      </div>
    </Card>
  );
}
