import { useEffect, useMemo, useState } from 'react';
import { ChartLine, TrendingUp } from 'lucide-react';
import { WEEKDAY_SHORT } from '@/lib/dates';
import { formatDate, formatNumber } from '@/lib/format';
import { Skeleton } from '@/components/ui';
import { MCard, MiniAreaChart, Pill, type MiniPoint } from '@/components/mobile';
import type { DashboardMetrics, DashPreset } from '../useDashboardMetrics';

const pad = (h: number) => String(h).padStart(2, '0');
const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Punto más alto con ventas (sin contar los tramos que aún no llegan). */
function peakIndex(points: MiniPoint[]): number | null {
  let peak: number | null = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!p.future && p.value > 0 && (peak === null || p.value > points[peak].value)) peak = i;
  }
  return peak;
}

interface Plot {
  points: MiniPoint[];
  /** Texto del punto al tocarlo. */
  details: { title: string; count: number }[];
  peak: number | null;
  showLabel: (i: number) => boolean;
  summary: string;
}

/**
 * "Ritmo de ventas": hoy, ventas por hora (hasta la hora actual); en semana o mes, ventas por día.
 * Al tocar la curva se ve el detalle del punto.
 */
export function SalesPulse({ preset, metrics, money }: { preset: DashPreset; metrics: DashboardMetrics; money: (n: number) => string }) {
  // Se recuerda la etiqueta del punto (no su posición): si la curva se corre (nueva hora, cambio de día) sigue marcando el mismo.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  useEffect(() => setActiveKey(null), [preset]);
  const nowHour = new Date().getHours();

  const plot = useMemo<Plot>(() => {
    if (preset === 'today') {
      const withSales = metrics.hourly.filter((h) => h.count > 0).map((h) => h.hour);
      const start = Math.min(8, withSales[0] ?? 8);
      const end = Math.min(23, Math.max(20, withSales[withSales.length - 1] ?? 0, nowHour));
      const hours = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      const points = hours.map((h) => ({ label: `${pad(h)}h`, value: metrics.hourly[h].total, future: h > nowHour }));
      const peak = peakIndex(points);
      const step = hours.length > 13 ? 3 : 2;
      const peakText = peak !== null ? ` • Pico ${pad(hours[peak])}:00 (${money(points[peak].value)}/h)` : '';
      return {
        points,
        details: hours.map((h) => ({ title: `${pad(h)}:00 – ${pad((h + 1) % 24)}:00`, count: metrics.hourly[h].count })),
        peak,
        showLabel: (i) => i === peak || i % step === 0 || i === hours.length - 1,
        summary: `${pad(start)}:00 a ${pad(end)}:00${peakText}`
      };
    }
    const series = metrics.series;
    const byWeekday = series.length <= 7;
    const points = series.map((p) => ({ label: p.isToday ? 'Hoy' : byWeekday ? WEEKDAY_SHORT[p.date.getDay()] : String(p.date.getDate()), value: p.value }));
    const peak = peakIndex(points);
    const step = byWeekday ? 1 : Math.max(2, Math.ceil(series.length / 6));
    const best = peak !== null ? series[peak] : null;
    return {
      points,
      details: series.map((p) => ({ title: formatDate(p.date, { weekday: 'long', day: 'numeric', month: 'short' }), count: p.count })),
      peak,
      showLabel: (i) => byWeekday || i === peak || i % step === 0 || i === series.length - 1,
      summary: `${byWeekday ? 'Últimos 7 días' : 'Este mes'}${best ? ` • Mejor día ${best.isToday ? 'hoy' : formatDate(best.date, { weekday: 'short', day: 'numeric' })} (${money(best.value)})` : ''}`
    };
  }, [preset, metrics.hourly, metrics.series, nowHour, money]);

  const empty = !metrics.loading && plot.points.every((p) => !p.value);
  const found = activeKey === null ? -1 : plot.points.findIndex((p) => p.label === activeKey);
  const active = found >= 0 ? found : null;
  const sel = active !== null ? plot.details[active] : null;

  return (
    <MCard role="region" className="flex flex-col gap-2" aria-label="Ritmo de ventas">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="size-5 shrink-0 text-primary" aria-hidden />
            <h2 className="truncate text-headline-sm font-bold text-on-surface">Ritmo de ventas</h2>
          </div>
          <span className="text-label-sm text-outline">
            {sel && active !== null ? (
              <>
                <span className="text-primary">{capitalize(sel.title)}</span> · {money(plot.points[active].value)} · {formatNumber(sel.count)}{' '}
                {sel.count === 1 ? 'ticket' : 'tickets'}
              </>
            ) : (
              plot.summary
            )}
          </span>
        </div>
        {preset === 'today' ? (
          <Pill tone="neutral" dot pulse className="mt-0.5">
            En vivo
          </Pill>
        ) : (
          <Pill tone="neutral" className="mt-0.5 tnum">
            {money(metrics.seriesTotal)}
          </Pill>
        )}
      </div>

      {metrics.loading ? (
        <Skeleton className="h-[132px] w-full" />
      ) : empty ? (
        <div className="flex h-[132px] flex-col items-center justify-center gap-1.5 rounded-lg bg-surface-container-low text-center">
          <ChartLine className="size-6 text-outline" aria-hidden />
          <p className="max-w-60 text-body-sm text-on-surface-variant">
            {preset === 'today' ? 'Aún no hay ventas hoy. Aquí verás a qué hora vendes más.' : 'Sin ventas en estos días todavía.'}
          </p>
        </div>
      ) : (
        <MiniAreaChart
          points={plot.points}
          showLabel={plot.showLabel}
          peak={plot.peak}
          active={active}
          onActive={(i) => setActiveKey(i === null ? null : plot.points[i].label)}
          label={`Ritmo de ventas: ${plot.summary}`}
        />
      )}
    </MCard>
  );
}
