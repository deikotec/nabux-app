import { useMemo, useState } from 'react';
import { Bot, ChartLine, User } from 'lucide-react';
import { formatDateTime, formatNumber } from '@/lib/format';
import { formatRate } from '@/lib/fx';
import { cn } from '@/lib/utils';
import type { FxHistoryEntry } from '@/types';
import { AreaChart } from '@/components/charts';
import { Badge, EmptyState, Pagination, Skeleton, Table, TD, TH, THead, TR } from '@/components/ui';
import { bcvSeries, formatIsoDay, rateNumber, seriesChange, type RatePoint } from './fxHelpers';
import { Callout, SettingsCard } from './SettingsUI';

const PAGE_SIZE = 10;

/** Historial de tasas (últimos 60 registros) con gráfica de la BCV. */
export function FxHistoryCard({ entries, loading, error }: { entries: FxHistoryEntry[]; loading: boolean; error: Error | null }) {
  const [page, setPage] = useState(1);
  const series = useMemo(() => bcvSeries(entries, 30), [entries]);
  const change = seriesChange(series);
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = entries.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const offset = (current - 1) * PAGE_SIZE;

  // Variación de la BCV respecto al registro anterior (más antiguo).
  const deltaAt = (i: number) => {
    const cur = entries[i]?.bcv;
    const prev = entries.slice(i + 1).find((e) => e.bcv)?.bcv;
    if (!cur || !prev || cur === prev) return null;
    return ((cur - prev) / prev) * 100;
  };

  return (
    <SettingsCard
      icon={ChartLine}
      title="Historial de tasas"
      subtitle="Cada actualización, automática o manual, queda registrada (últimos 60 registros)."
      badge={
        change !== null ? (
          <Badge tone={change > 0 ? 'warning' : 'success'}>
            BCV {change > 0 ? '+' : ''}
            {formatNumber(change, 'es-VE', 2)} % en {series.length} días
          </Badge>
        ) : undefined
      }
    >
      {error ? (
        <Callout tone="warning" title="No se pudo cargar el historial">
          {error.message}
        </Callout>
      ) : loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ChartLine}
          title="Aún no hay historial"
          description="Cuando se actualice una tasa, a mano o desde internet, aparecerá aquí con su fecha y quién la registró."
        />
      ) : (
        <>
          <BcvChart series={series} />

          {/* Escritorio: tabla */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200/80 md:block">
            <Table>
              <THead>
                <TH>Fecha</TH>
                <TH align="right">BCV</TH>
                <TH align="right">Paralelo</TH>
                <TH align="right">Propia</TH>
                <TH>Origen</TH>
                <TH>Usuario</TH>
              </THead>
              <tbody>
                {rows.map((e, i) => {
                  const delta = deltaAt(offset + i);
                  return (
                    <TR key={e.id}>
                      <TD className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-on-surface">{formatDateTime(e.createdAt)}</span>
                          {e.bcvDate && <span className="text-body-sm text-on-surface-variant">BCV vigente {formatIsoDay(e.bcvDate, false)}</span>}
                        </div>
                      </TD>
                      <TD align="right">
                        <div className="flex flex-col items-end">
                          <span className="font-semibold text-on-surface">{rateNumber(e.bcv)}</span>
                          {delta !== null && <DeltaText value={delta} />}
                        </div>
                      </TD>
                      <TD align="right">{rateNumber(e.parallel)}</TD>
                      <TD align="right">{rateNumber(e.custom)}</TD>
                      <TD>
                        <SourceBadge source={e.source} />
                      </TD>
                      <TD className="max-w-[180px] truncate text-on-surface-variant">{e.userName || '—'}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>

          {/* Móvil: tarjetas */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((e, i) => {
              const delta = deltaAt(offset + i);
              return (
                <li key={e.id} className="flex flex-col gap-2 rounded-xl border border-slate-200/80 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-label-md text-on-surface">{formatDateTime(e.createdAt)}</span>
                    <SourceBadge source={e.source} />
                  </div>
                  <dl className="grid grid-cols-3 gap-2">
                    <MiniRate label="BCV" value={e.bcv} delta={delta} strong />
                    <MiniRate label="Paralelo" value={e.parallel} />
                    <MiniRate label="Propia" value={e.custom} />
                  </dl>
                  <span className="truncate text-body-sm text-on-surface-variant">
                    {e.userName || '—'}
                    {e.bcvDate ? ` · BCV vigente ${formatIsoDay(e.bcvDate, false)}` : ''}
                  </span>
                </li>
              );
            })}
          </ul>

          <Pagination page={current} pageSize={PAGE_SIZE} total={entries.length} onChange={setPage} label="registros" />
        </>
      )}
    </SettingsCard>
  );
}

/** Gráfica de la BCV por día. El eje parte cerca del mínimo para que se vea la variación. */
function BcvChart({ series }: { series: RatePoint[] }) {
  const chart = useMemo(() => {
    if (series.length < 2) return null;
    const values = series.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || max * 0.02 || 1;
    const floor = Math.max(0, min - span * 0.5);
    const decimals = span >= 10 ? 0 : span >= 1 ? 1 : 2;
    return {
      floor,
      decimals,
      data: series.map((p, i) => ({
        label: formatIsoDay(p.key, false),
        value: p.value - floor,
        highlight: i === series.length - 1
      }))
    };
  }, [series]);

  if (!chart) {
    return (
      <p className="rounded-xl bg-surface-container-low p-3 text-body-sm text-on-surface-variant">
        La gráfica aparece cuando haya tasas BCV de al menos dos días distintos.
      </p>
    );
  }

  return (
    <div className="rounded-xl bg-surface-container-low/60 p-3 pt-4">
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <span className="text-label-md text-on-surface">Tasa BCV por día</span>
        <span className="text-body-sm text-on-surface-variant tnum">{formatRate(series[series.length - 1].value)}</span>
      </div>
      <AreaChart
        data={chart.data}
        height={180}
        formatValue={(v) => formatRate(v + chart.floor)}
        formatAxis={(v) => formatNumber(v + chart.floor, 'es-VE', chart.decimals)}
      />
    </div>
  );
}

function DeltaText({ value }: { value: number }) {
  return (
    <span className={cn('text-[11px] font-semibold tnum', value > 0 ? 'text-amber-700' : 'text-emerald-700')}>
      {value > 0 ? '▲' : '▼'} {formatNumber(Math.abs(value), 'es-VE', 2)} %
    </span>
  );
}

function MiniRate({ label, value, delta, strong }: { label: string; value: number | null | undefined; delta?: number | null; strong?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">{label}</dt>
      <dd className={cn('truncate text-body-md tnum', strong ? 'font-semibold text-on-surface' : 'text-on-surface-variant')}>{rateNumber(value)}</dd>
      {delta !== undefined && delta !== null && <DeltaText value={delta} />}
    </div>
  );
}

function SourceBadge({ source }: { source?: 'auto' | 'manual' }) {
  return source === 'auto' ? (
    <Badge tone="info" size="xs" icon={Bot}>
      Automática
    </Badge>
  ) : (
    <Badge tone="neutral" size="xs" icon={User}>
      Manual
    </Badge>
  );
}
