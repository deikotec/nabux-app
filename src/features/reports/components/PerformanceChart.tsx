import { useState, type FormEvent } from 'react';
import { ChartNoAxesCombined, Flag, Info, Target, TrendingUp } from 'lucide-react';
import { ComboChart, type ComboPoint } from '@/components/charts';
import { Button, NumberInput, Popover, Segmented, Skeleton, useToast, type TabOption } from '@/components/ui';
import { cn } from '@/lib/utils';
import { bucketAvgRate, safePct, type Granularity, type TimeBucket } from '../analytics';
import { plural, type ReportFx } from '../format';
import { SectionCard, SectionHeader } from './Section';

type CurrencyView = 'base' | 'local';

const UNIT: Record<Granularity, { singular: string; plural: string; best: string; subtitle: string }> = {
  hour: { singular: 'hora', plural: 'horas', best: 'Mejor hora', subtitle: 'Ventas vs ganancia neta por hora del día' },
  day: { singular: 'día', plural: 'días', best: 'Mejor día', subtitle: 'Evolución diaria de ventas vs ganancia neta' },
  week: { singular: 'semana', plural: 'semanas', best: 'Mejor semana', subtitle: 'Evolución semanal de ventas vs ganancia neta' }
};

function GoalForm({ goal, currencySymbol, onSave }: { goal: number | null; currencySymbol: string; onSave: (v: number | null) => void }) {
  const [value, setValue] = useState<number | ''>(goal ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(value === '' ? null : value);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-1.5">
      <div className="flex flex-col gap-1">
        <span className="text-label-lg text-on-surface">Meta de ventas por día</span>
        <span className="text-body-sm text-on-surface-variant">Se guarda en este navegador y se usa para la línea de meta y el avance del período.</span>
      </div>
      <NumberInput autoFocus value={value} onValueChange={setValue} prefix={currencySymbol} placeholder="0.00" aria-label="Meta diaria" />
      <div className="flex items-center justify-end gap-2">
        {goal !== null && (
          <Button variant="ghost" size="sm" onClick={() => onSave(null)}>
            Quitar meta
          </Button>
        )}
        <Button type="submit" size="sm" disabled={value === '' || value <= 0}>
          Guardar
        </Button>
      </div>
    </form>
  );
}

function Stat({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'good' | 'bad' }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-surface-container-low/70 px-3 py-2.5">
      <span className="text-label-sm tracking-wider text-on-surface-variant uppercase">{label}</span>
      <span className={cn('truncate text-label-lg tnum', tone === 'good' ? 'text-primary' : tone === 'bad' ? 'text-error' : 'text-on-surface')}>{value}</span>
      {sub && <span className="truncate text-body-sm text-on-surface-variant">{sub}</span>}
    </div>
  );
}

export function PerformanceChart({
  buckets,
  granularity,
  goal,
  onGoalChange,
  loading,
  money,
  moneyCompact,
  currencySymbol,
  rangeLabel,
  fx
}: {
  buckets: TimeBucket[];
  granularity: Granularity;
  goal: number | null;
  onGoalChange: (v: number | null) => void;
  loading: boolean;
  money: (n: number) => string;
  moneyCompact: (n: number) => string;
  currencySymbol: string;
  rangeLabel: string;
  fx: ReportFx;
}) {
  const toast = useToast();
  const unit = UNIT[granularity];
  const [view, setView] = useState<CurrencyView>('base');
  const inLocal = fx.dual && view === 'local';
  const revenueOf = (b: TimeBucket) => (inLocal ? b.revenueLocal : b.revenue);
  const fmt = inLocal ? (n: number) => fx.formatLocal(n) : money;
  const fmtAxis = inLocal ? fx.compactLocal : moneyCompact;
  const viewOptions: TabOption<CurrencyView>[] = [
    { value: 'base', label: `En ${fx.baseSymbol}` },
    { value: 'local', label: `En ${fx.localSymbol}` }
  ];

  // Meta comparable con cada barra: diaria por día, × días de la semana por semana; por hora no aplica.
  // La meta se define en moneda base: en la vista en Bs no se dibuja.
  const targetFor = (b: TimeBucket) => (goal ? (granularity === 'day' ? goal : granularity === 'week' ? goal * b.days : null) : null);
  const target = goal && !inLocal ? (granularity === 'day' ? goal : granularity === 'week' ? goal * 7 : null) : null;

  const data: ComboPoint[] = buckets.map((b) => {
    const rate = bucketAvgRate(b);
    return {
      label: b.label,
      line: revenueOf(b),
      bar: inLocal ? b.profitLocal : b.profit,
      highlight: b.isCurrent,
      detail: (
        <span className="tnum">
          {b.longLabel} · {b.count} tickets · margen {safePct(b.profit, b.subtotal).toFixed(0)}%
          {inLocal && rate ? ` · tasa prom. ${fx.formatRate(rate)}` : ''}
          {inLocal && b.localMissing ? ` · ${plural(b.localMissing, 'venta')} sin tasa` : ''}
        </span>
      )
    };
  });

  const total = buckets.reduce((a, b) => a + revenueOf(b), 0);
  const best = buckets.reduce<TimeBucket | null>((a, b) => (revenueOf(b) > (a ? revenueOf(a) : 0) ? b : a), null);
  const activeBuckets = granularity === 'hour' ? buckets.filter((b) => b.count > 0).length : buckets.length;
  const avg = activeBuckets ? total / activeBuckets : 0;
  const missing = inLocal ? buckets.reduce((a, b) => a + b.localMissing, 0) : 0;
  const withTarget = buckets.filter((b) => targetFor(b) !== null);
  const hits = withTarget.filter((b) => b.revenue >= (targetFor(b) ?? Infinity)).length;

  let goalStat: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' };
  if (!goal) goalStat = { label: 'Meta', value: 'Sin meta diaria', sub: 'Defínela para medir el avance' };
  else if (granularity === 'hour') {
    // La meta está en moneda base: se compara siempre contra las ventas en $.
    const totalBase = buckets.reduce((a, b) => a + b.revenue, 0);
    const pct = safePct(totalBase, goal);
    goalStat = { label: 'Meta del día', value: `${pct.toFixed(0)}% alcanzado`, sub: `${money(totalBase)} de ${money(goal)}`, tone: pct >= 100 ? 'good' : undefined };
  } else {
    goalStat = {
      label: `${unit.plural} sobre la meta`,
      value: `${hits} de ${withTarget.length}`,
      sub: `Meta ${money(goal)}/día`,
      tone: hits >= withTarget.length / 2 ? 'good' : 'bad'
    };
  }

  return (
    <SectionCard>
      <SectionHeader
        size="lg"
        title={granularity === 'hour' ? 'Curva de rendimiento por hora' : 'Curva de rendimiento diario'}
        info={
          inLocal
            ? 'Línea: ventas en bolívares (suma del total en Bs de cada venta, a la tasa con que se cobró; no a la tasa de hoy). Barras: ganancia neta de cada venta a esa misma tasa.'
            : 'Línea: ventas cobradas (con impuestos). Barras: ganancia neta estimada (venta neta − costo).'
        }
        subtitle={`${unit.subtitle} · ${rangeLabel}`}
        actions={
          <>
            {fx.dual && <Segmented options={viewOptions} value={view} onChange={setView} size="sm" />}
            <Popover
              panelClassName="w-80 max-w-[calc(100vw-3rem)]"
              trigger={({ toggle, open }) => (
                <Button variant={goal ? 'tonal' : 'soft'} size="sm" icon={Target} onClick={toggle} aria-expanded={open}>
                  {goal ? <span className="tnum">Meta {moneyCompact(goal)}/día</span> : 'Definir meta diaria'}
                </Button>
              )}
            >
              {(close) => (
                <GoalForm
                  goal={goal}
                  currencySymbol={currencySymbol}
                  onSave={(v) => {
                    onGoalChange(v);
                    close();
                    toast.success(v ? 'Meta diaria actualizada' : 'Meta diaria eliminada');
                  }}
                />
              )}
            </Popover>
          </>
        }
        icon={ChartNoAxesCombined}
      />

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-[280px] w-full" />
        </div>
      ) : (
        <ComboChart
          data={data}
          height={280}
          target={target}
          lineLabel={inLocal ? `Ventas en ${fx.localSymbol}` : 'Ventas'}
          barLabel={inLocal ? `Ganancia neta en ${fx.localSymbol}` : 'Ganancia neta'}
          formatValue={fmt}
          formatAxis={fmtAxis}
        />
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[62px]" />)
        ) : (
          <>
            <Stat
              label={unit.best}
              value={best ? fmt(revenueOf(best)) : '—'}
              sub={best ? `${best.longLabel} · ${best.count} tickets` : `Sin ventas registradas`}
              tone={best ? 'good' : 'default'}
            />
            <Stat
              label={granularity === 'hour' ? 'Promedio por hora activa' : `Promedio por ${unit.singular}`}
              value={fmt(avg)}
              sub={`${activeBuckets} ${activeBuckets === 1 ? unit.singular : unit.plural}`}
            />
            <Stat label={goalStat.label} value={goalStat.value} sub={goalStat.sub} tone={goalStat.tone} />
          </>
        )}
      </div>
      {inLocal && (
        <p className="mt-2 flex items-start gap-1.5 text-body-sm text-on-surface-variant">
          <Info className="mt-px size-3.5 shrink-0" />
          <span>
            Cada venta se convierte con la tasa con que se cobró (no con la de hoy).
            {goal ? ' La meta diaria se mide en dólares, por eso no se dibuja en esta vista.' : ''}
            {missing ? ` ${plural(missing, 'venta')} sin tasa registrada no ${missing === 1 ? 'aparece' : 'aparecen'} aquí.` : ''}
          </span>
        </p>
      )}
      {granularity === 'hour' && goal ? (
        <p className="mt-2 flex items-center gap-1.5 text-body-sm text-on-surface-variant">
          <Flag className="size-3.5" /> En la vista por hora la meta se compara contra el acumulado del día.
        </p>
      ) : granularity === 'week' ? (
        <p className="mt-2 flex items-center gap-1.5 text-body-sm text-on-surface-variant">
          <TrendingUp className="size-3.5" /> Rango largo: las ventas se agrupan por semana (lunes a domingo).
        </p>
      ) : null}
    </SectionCard>
  );
}
