import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Clock, Flame, LayoutGrid, Moon } from 'lucide-react';
import { Heatmap } from '@/components/charts';
import { Skeleton } from '@/components/ui';
import type { HeatmapData } from '../analytics';
import { plural } from '../format';
import { InlineEmpty, SectionCard, SectionHeader } from './Section';

/** Mismos tonos que usa <Heatmap/> de menor a mayor intensidad. */
const LEGEND = ['bg-surface-container-low', 'bg-emerald-50', 'bg-emerald-100', 'bg-emerald-300', 'bg-emerald-500', 'bg-primary'];

function Insight({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg bg-surface-container-low/70 px-2.5 py-2">
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-md bg-white ${tone}`}>
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-[11px] leading-tight font-semibold tracking-wide text-on-surface-variant uppercase">{label}</span>
        <span className="truncate text-label-md text-on-surface">
          {value} <span className="font-normal text-on-surface-variant tnum">· {sub}</span>
        </span>
      </div>
    </div>
  );
}

export function TrafficHeatmap({ data, loading, className }: { data: HeatmapData; loading: boolean; className?: string }) {
  return (
    <SectionCard className={className}>
      <SectionHeader title="Flujo semanal & horarios" subtitle="Tickets por día y franja de 2 horas para optimizar turnos" icon={LayoutGrid} tone="tertiary" />
      {loading ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : data.total === 0 ? (
        <InlineEmpty icon={Clock}>Cuando haya ventas verás aquí los días y horarios con más clientes.</InlineEmpty>
      ) : (
        <div className="flex flex-1 flex-col gap-4 md:flex-row 2xl:flex-col">
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
            <Heatmap rows={data.rows} cols={data.cols} values={data.values} formatValue={(v) => String(v)} />
            <div className="flex items-center justify-between gap-3 text-label-sm text-on-surface-variant">
              <span>Menor tráfico</span>
              <span className="flex items-center gap-1" aria-hidden>
                {LEGEND.map((c) => (
                  <span key={c} className={`size-3 rounded ${c}`} />
                ))}
              </span>
              <span className="text-right">
                Hora pico <span className="tnum">({data.max})</span>
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 content-start gap-1.5 min-[480px]:grid-cols-2 md:w-64 md:grid-cols-1 2xl:w-auto 2xl:grid-cols-2">
            {data.peak && <Insight icon={Flame} tone="text-primary" label="Hora pico" value={`${data.peak.day} ${data.peak.slot}`} sub={plural(data.peak.count, 'ticket')} />}
            {data.busiestDay && <Insight icon={CalendarDays} tone="text-secondary" label="Día más fuerte" value={data.busiestDay.label} sub={plural(data.busiestDay.count, 'ticket')} />}
            {data.busiestSlot && <Insight icon={Clock} tone="text-tertiary" label="Franja más fuerte" value={data.busiestSlot.label} sub={plural(data.busiestSlot.count, 'ticket')} />}
            {data.quietestSlot && <Insight icon={Moon} tone="text-on-surface-variant" label="Franja más tranquila" value={data.quietestSlot.label} sub={plural(data.quietestSlot.count, 'ticket')} />}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
