import { Link } from 'react-router';
import { ArrowRight, ChartLine, Download, Minus, RefreshCw, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react';
import { RATE_SOURCE_LABELS } from '@/config/app';
import { Badge, Button, Skeleton } from '@/components/ui';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FxRates, RateSource } from '@/types';
import { type RatePoint, type RateSummary } from '../analytics';
import { RATE_COLORS } from '../colors';
import { plainPct, plural, signedPct, type ReportFx } from '../format';
import { RateChart, type RateSeriesDef } from './RateChart';
import { InlineEmpty, SectionCard, SectionHeader } from './Section';

const SHORT_LABEL: Record<RateSource, string> = { bcv: 'BCV', parallel: 'Paralelo', custom: 'Propia' };

/** "El dólar BCV subió 12,3 % en el período". */
function changeSentence(source: RateSource, pct: number | null, period: string): string {
  const who = source === 'bcv' ? 'El dólar BCV' : source === 'parallel' ? 'El dólar paralelo' : 'Tu tasa propia';
  if (pct === null) return `${who} no tiene variación registrada ${period}`;
  if (Math.abs(pct) < 0.05) return `${who} se mantuvo estable ${period}`;
  return `${who} ${pct > 0 ? 'subió' : 'bajó'} ${plainPct(Math.abs(pct))} ${period}`;
}

function TrendIcon({ pct, className }: { pct: number | null; className?: string }) {
  if (pct === null || Math.abs(pct) < 0.05) return <Minus className={className} />;
  return pct > 0 ? <TrendingUp className={className} /> : <TrendingDown className={className} />;
}

export function RateEvolution({
  points,
  summary,
  loading,
  error,
  rates,
  rateSource,
  stale,
  fx,
  canEditRates,
  canOpenSettings,
  onRefresh,
  refreshing,
  onExport,
  rangeLabel,
  intraday
}: {
  points: RatePoint[];
  summary: RateSummary;
  loading: boolean;
  error: Error | null;
  /** Tasas vigentes (doc meta/fx). */
  rates: FxRates | null;
  rateSource: RateSource;
  stale: boolean;
  fx: ReportFx;
  canEditRates: boolean;
  canOpenSettings: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  onExport: () => void;
  rangeLabel: string;
  /** Rango de un solo día: un punto por actualización. */
  intraday: boolean;
}) {
  const series: RateSeriesDef[] = summary.available.map((key) => ({ key, label: SHORT_LABEL[key], color: RATE_COLORS[key] }));
  const period = intraday ? 'en el día' : 'en el período';
  // Frase principal: la fuente que usa el POS (o BCV si esa no tiene datos).
  const main: RateSource = summary.series[rateSource].last !== null ? rateSource : summary.available[0] ?? 'bcv';
  const mainStat = summary.series[main];
  const others = summary.available.filter((s) => s !== main);
  const hasGap = summary.gapNow !== null;
  const lastUpdate = rates?.updatedAt ? formatRelative(rates.updatedAt) : null;

  const refreshButton = canEditRates && (
    <Button variant="soft" size="sm" icon={RefreshCw} loading={refreshing} onClick={onRefresh}>
      Actualizar tasa
    </Button>
  );

  return (
    <SectionCard>
      <SectionHeader
        size="lg"
        title="Evolución de la tasa"
        info="Último valor registrado cada día (los días sin cambios, como fines de semana, mantienen la tasa anterior). Las ventas del período se cobraron con la tasa vigente en su momento."
        subtitle={`BCV, paralelo y tasa propia · ${rangeLabel}`}
        icon={ChartLine}
        tone="tertiary"
        actions={
          <>
            {refreshButton}
            <Button variant="tonal" size="sm" icon={Download} onClick={onExport} disabled={!points.length}>
              CSV
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Skeleton className="h-[240px] w-full lg:col-span-2" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      ) : error ? (
        <InlineEmpty icon={TriangleAlert}>No pudimos cargar el historial de tasas. {error.message}</InlineEmpty>
      ) : !summary.available.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-amber-50/70 px-4 py-8 text-center">
          <TriangleAlert className="size-6 text-amber-600" />
          <div className="flex max-w-md flex-col gap-1">
            <p className="text-label-lg text-on-surface">{rates?.bcv ? 'Sin historial de tasas en este período' : 'Aún no hay tasa de cambio cargada'}</p>
            <p className="text-body-sm text-on-surface-variant">
              {rates?.bcv
                ? 'Cada actualización de la tasa (automática o manual) queda registrada y aparecerá aquí.'
                : canEditRates
                  ? 'Consulta la tasa BCV y el paralelo para cobrar en bolívares y ver su evolución.'
                  : 'Pide a un administrador que cargue la tasa del día para cobrar en bolívares.'}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {canEditRates && (
              <Button size="sm" icon={RefreshCw} loading={refreshing} onClick={onRefresh}>
                Consultar BCV y paralelo
              </Button>
            )}
            {canOpenSettings && (
              <Link
                to="/configuracion"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-label-md text-primary transition-colors hover:bg-primary-fixed/30"
              >
                Cargar a mano en Configuración <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-3 lg:col-span-2">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-body-sm text-on-surface-variant">
              {series.map((s) => (
                <li key={s.key} className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
                  <span className="text-on-surface">{RATE_SOURCE_LABELS[s.key]}</span>
                  <span className="tnum">{fx.formatRate(summary.series[s.key].last)}</span>
                  {s.key === rateSource && (
                    <Badge tone="primary" size="xs">
                      POS
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
            <RateChart points={points} series={series} height={240} formatValue={(v) => fx.formatRate(v)} />
          </div>

          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex flex-col gap-1 rounded-xl bg-surface-container-low px-3.5 py-3">
              <span className="flex items-start gap-2">
                <span
                  className={cn(
                    'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg',
                    mainStat.changePct !== null && mainStat.changePct >= 0.05 ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-primary-fixed/50 text-on-primary-fixed-variant'
                  )}
                >
                  <TrendIcon pct={mainStat.changePct} className="size-4" />
                </span>
                <span className="text-label-lg text-on-surface">{changeSentence(main, mainStat.changePct, period)}</span>
              </span>
              <span className="pl-9 text-body-sm text-on-surface-variant tnum">
                {mainStat.first !== null && mainStat.last !== null && mainStat.first !== mainStat.last
                  ? `De ${fx.formatRate(mainStat.first)} a ${fx.formatRate(mainStat.last)}`
                  : `Tasa ${fx.formatRate(mainStat.last)}`}
                {main === rateSource ? ' · la que usa el POS' : ''}
              </span>
            </div>

            {others.map((src) => {
              const st = summary.series[src];
              return (
                <div key={src} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 px-3.5 py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: RATE_COLORS[src] }} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-label-md text-on-surface">{RATE_SOURCE_LABELS[src]}</span>
                      <span className="text-body-sm text-on-surface-variant tnum">{fx.formatRate(st.last)}</span>
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-label-md text-on-surface tnum">
                    <TrendIcon pct={st.changePct} className="size-3.5 text-on-surface-variant" />
                    {st.changePct === null ? '—' : signedPct(st.changePct)}
                  </span>
                </div>
              );
            })}

            {hasGap && (
              <div className="flex flex-col gap-0.5 rounded-xl border border-slate-200/80 px-3.5 py-2.5" title="Cuánto más caro está el dólar paralelo que el oficial del BCV.">
                <span className="text-label-sm tracking-wider text-on-surface-variant uppercase">Brecha BCV vs paralelo</span>
                <span className="text-headline-md text-on-surface tnum">{plainPct(summary.gapNow)}</span>
                <span className="text-body-sm text-on-surface-variant tnum">
                  {summary.gapAvg !== null && points.length > 1 ? `Promedio ${period}: ${plainPct(summary.gapAvg)}` : ''}
                  {summary.gapFirst !== null && points.length > 1 && Math.abs((summary.gapFirst ?? 0) - (summary.gapNow ?? 0)) >= 0.05
                    ? ` · al inicio ${plainPct(summary.gapFirst)}`
                    : ''}
                </span>
              </div>
            )}

            <p className={cn('text-body-sm', stale ? 'text-amber-700' : 'text-on-surface-variant')}>
              {summary.updates ? `${plural(summary.updates, 'actualización', 'actualizaciones')} ${period}` : `Sin actualizaciones ${period}`}
              {lastUpdate ? ` · última ${lastUpdate}${rates?.source === 'auto' ? ' (automática)' : rates?.updatedByName ? ` por ${rates.updatedByName}` : ''}` : ''}
              {stale ? ' · la tasa BCV no es de hoy' : ''}
            </p>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
