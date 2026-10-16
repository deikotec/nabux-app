import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  Banknote,
  ChartColumn,
  ChartLine,
  ChevronDown,
  FileDown,
  Landmark,
  Medal,
  PackageX,
  ReceiptText,
  Share,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert
} from 'lucide-react';
import { WEEKDAY_SHORT } from '@/lib/dates';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Input, Modal, Popover, Skeleton } from '@/components/ui';
import { MCard, MiniBarChart, Narrow, Pill, PillTabs, RoundButton, SectionNote, type MiniBar } from '@/components/mobile';
import { lossLevel, pctChange, topProducts, type Granularity, type PaymentStat, type ProductStat, type SalesSummary, type ShrinkSummary, type TimeBucket } from './analytics';
import { hhmm, plural, type ReportFx } from './format';
import { GoalForm } from './components/PerformanceChart';
import type { CustomRangeInput, ExportKind, HeaderRate, ReportPreset } from './components/ReportsHeader';

const PRESETS: { value: ReportPreset; label: ReactNode }[] = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: 'month', label: <Narrow full="Este mes" short="Mes" /> },
  { value: '30d', label: '30 días' },
  { value: 'custom', label: 'Rango' }
];

const EXPORTS: { kind: ExportKind; label: string; hint: string; dualOnly?: boolean }[] = [
  { kind: 'sales', label: 'Ventas detalladas', hint: 'Cada ticket con productos y pagos' },
  { kind: 'daily', label: 'Resumen por día', hint: 'Totales diarios del período' },
  { kind: 'products', label: 'Rendimiento por producto', hint: 'Unidades, ingresos y margen' },
  { kind: 'payments', label: 'Formas de pago', hint: 'Lo cobrado con cada método' },
  { kind: 'cash', label: 'Cortes de caja', hint: 'Últimos cortes y diferencias' },
  { kind: 'rates', label: 'Historial de tasas', hint: 'BCV y paralelo del período', dualOnly: true }
];

const WEEKDAY_INITIAL = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export interface ReportsMobileProps {
  preset: ReportPreset;
  onPreset: (p: ReportPreset) => void;
  custom: CustomRangeInput;
  onCustom: (c: CustomRangeInput) => void;
  maxDate: string;
  now: Date;
  rangeLabel: string;
  rate: HeaderRate | null;
  summary: SalesSummary;
  prev: SalesSummary | null;
  prevLoading: boolean;
  compareText: string;
  loading: boolean;
  shrink: ShrinkSummary;
  shrinkLoading: boolean;
  periodGoal: number | null;
  goal: number | null;
  onGoal: (v: number | null) => void;
  currencySymbol: string;
  minMarginPct: number;
  series: TimeBucket[];
  granularity: Granularity;
  payments: PaymentStat[];
  colorOf: (methodId: string) => string;
  products: ProductStat[];
  money: (n: number) => string;
  moneyCompact: (n: number) => string;
  fx: ReportFx;
  onExport: (kind: ExportKind) => void;
  onShare: () => void;
  /** Error al cargar las ventas, o null. */
  salesError: ReactNode;
  /** Tarjeta de "sin ventas en el período" (null si hay ventas). */
  empty: ReactNode;
  /** Evolución de la tasa (bimonetario). */
  rateSection: ReactNode;
  cashClosings: ReactNode;
  /** "30 cortes · 2 con diferencia". */
  closingsSummary: string;
  /** Secciones de análisis adicionales (se despliegan bajo "Más análisis"). */
  more: ReactNode;
}

/** Reportes en el celular (ref/movil/reportes_anal_ticas_m_vil). */
export function ReportsMobile(p: ReportsMobileProps) {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-headline-lg-mobile tracking-tight text-on-surface">Analíticas</h1>
            <Pill tone="primary" dot pulse className="shadow-card">
              En vivo
            </Pill>
          </div>
          <p className="truncate text-body-sm text-on-surface-variant">
            Corte parcial al <span className="tnum">{hhmm(p.now)}</span> · {p.rangeLabel}
          </p>
        </div>
        <Popover
          panelClassName="w-80"
          trigger={({ open, toggle }) => (
            <RoundButton icon={Target} label={p.goal ? 'Cambiar meta diaria' : 'Definir meta diaria'} onClick={toggle} aria-expanded={open} active={!!p.goal} />
          )}
        >
          {(close) => (
            <GoalForm
              goal={p.goal}
              currencySymbol={p.currencySymbol}
              onSave={(v) => {
                p.onGoal(v);
                close();
              }}
            />
          )}
        </Popover>
      </div>

      {p.rate && (
        <span
          className={cn(
            'inline-flex w-fit max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-label-sm tnum',
            p.rate.stale || !p.rate.text ? 'bg-amber-50 text-amber-800' : 'bg-surface-container text-on-surface-variant'
          )}
        >
          {(p.rate.stale || !p.rate.text) && <TriangleAlert className="size-3 shrink-0" aria-hidden />}
          <span className="truncate">{p.rate.text ?? 'Sin tasa de cambio cargada'}</span>
        </span>
      )}

      <PillTabs label="Período" options={PRESETS} value={p.preset} onChange={p.onPreset} />

      {p.preset === 'custom' && (
        <div className="grid animate-fade-in grid-cols-2 gap-2 rounded-xl bg-surface-container-low p-2">
          <label className="flex min-w-0 flex-col gap-1 text-label-sm text-on-surface-variant">
            Desde
            <Input type="date" inputSize="sm" className="tnum" value={p.custom.from} max={p.custom.to || p.maxDate} onChange={(e) => e.target.value && p.onCustom({ ...p.custom, from: e.target.value })} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-label-sm text-on-surface-variant">
            Hasta
            <Input type="date" inputSize="sm" className="tnum" value={p.custom.to} min={p.custom.from} max={p.maxDate} onChange={(e) => e.target.value && p.onCustom({ ...p.custom, to: e.target.value })} />
          </label>
        </div>
      )}

      <Bento {...p} />

      {p.salesError ?? p.empty ?? (
        <>
          <SalesBars series={p.series} granularity={p.granularity} preset={p.preset} loading={p.loading} money={p.money} moneyCompact={p.moneyCompact} />
          <PaymentsCard stats={p.payments} loading={p.loading} money={p.money} fx={p.fx} colorOf={p.colorOf} />
          <TopRotation stats={p.products} loading={p.loading} money={p.money} />
        </>
      )}

      <Disclosure icon={Landmark} title="Cortes de caja (Z)" summary={p.closingsSummary}>
        {p.cashClosings}
      </Disclosure>
      {p.rateSection && (
        <Disclosure icon={ChartLine} title="Evolución de la tasa" summary={p.rate?.text ?? 'BCV, paralelo y tasa propia del período'}>
          {p.rateSection}
        </Disclosure>
      )}
      <Disclosure icon={ChartColumn} title="Más análisis" summary="Cajeros, categorías, horarios y salud del inventario">
        {p.more}
      </Disclosure>

      <div className="flex flex-col gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-label-lg text-on-primary shadow-lift transition-all hover:bg-primary-container active:scale-[0.99]"
        >
          <FileDown className="size-5" aria-hidden /> Descargar reportes (CSV)
        </button>
        <button
          type="button"
          onClick={p.onShare}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-surface-container-high text-label-lg text-on-surface shadow-card transition-all hover:bg-surface-container-highest active:scale-[0.99]"
        >
          <Share className="size-[19px]" aria-hidden /> Compartir resumen
        </button>
      </div>

      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Descargar reportes" subtitle={`Archivos CSV · ${p.rangeLabel}`} icon={FileDown} size="sm">
        <ul className="flex flex-col gap-1.5">
          {EXPORTS.filter((x) => !x.dualOnly || p.fx.dual).map((x) => (
            <li key={x.kind}>
              <button
                type="button"
                onClick={() => {
                  setExportOpen(false);
                  p.onExport(x.kind);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-surface-container-low px-3 py-2.5 text-left transition-colors hover:bg-surface-container active:bg-surface-container"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-label-lg text-on-surface">{x.label}</span>
                  <span className="truncate text-body-sm text-on-surface-variant">{x.hint}</span>
                </span>
                <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-on-surface-variant shadow-card">CSV</span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

/** Sección plegable: los análisis largos quedan a un toque sin alargar la pantalla. */
function Disclosure({ icon: Icon, title, summary, children }: { icon: LucideIcon; title: string; summary: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl bg-surface-container-lowest p-3 text-left shadow-card transition-colors active:bg-surface-container-low"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-label-lg text-on-surface">{title}</span>
            <span className="truncate text-body-sm text-on-surface-variant">{summary}</span>
          </span>
        </span>
        <ChevronDown className={cn('size-5 shrink-0 text-on-surface-variant transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && <div className="flex animate-fade-in flex-col gap-3">{children}</div>}
    </>
  );
}

/* ------------------------------------------------------------------ */

function heroSize(text: string) {
  if (text.length <= 10) return 'text-display-lg';
  if (text.length <= 13) return 'text-headline-lg';
  return 'text-headline-lg-mobile';
}

function Tile({ label, icon: Icon, iconClassName, children, className }: { label: string; icon: LucideIcon; iconClassName: string; children: ReactNode; className?: string }) {
  return (
    <MCard className={cn('flex min-w-0 flex-col justify-between', className)}>
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-label-md text-on-surface-variant">{label}</span>
        <Icon className={cn('size-[18px] shrink-0', iconClassName)} aria-hidden />
      </div>
      {children}
    </MCard>
  );
}

function Bento({ summary, prev, prevLoading, compareText, loading, shrink, shrinkLoading, periodGoal, minMarginPct, money, fx }: ReportsMobileProps) {
  const revenue = money(summary.revenue);
  const delta = prev ? pctChange(summary.revenue, prev.revenue) : null;
  const up = (delta ?? 0) >= 0;
  const goalPct = periodGoal ? (summary.revenue / periodGoal) * 100 : null;
  const loss = summary.voidedAmount + shrink.amount;
  const lossPct = lossLevel(loss, summary.revenue).pct;
  const incidents = summary.voidedCount + shrink.count;
  const margin = summary.marginPct;
  const marginPill =
    summary.count === 0 ? null : margin <= 0 ? (
      <Pill tone="error">Sin ganancia</Pill>
    ) : margin < minMarginPct ? (
      <Pill tone="tertiary">Bajo el mínimo</Pill>
    ) : (
      <Pill tone="success">Rentable</Pill>
    );
  const noLocal = summary.count > 0 && summary.localCount === 0;

  return (
    <section className="grid grid-cols-2 gap-2" aria-label="Indicadores clave">
      <MCard className="relative col-span-2 flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="text-label-md tracking-wider text-on-surface-variant uppercase">Ingresos totales</span>
            {loading ? (
              <Skeleton className="mt-1.5 h-10 w-48" />
            ) : (
              <span className={cn('mt-1 truncate tracking-tight text-on-surface tnum', heroSize(revenue))}>{revenue}</span>
            )}
            {fx.dual && !loading && (
              <span className="text-label-md text-on-surface-variant tnum" title="Cada venta a la tasa con que se cobró">
                ≈ {noLocal ? '—' : fx.formatLocal(summary.revenueLocal)}
              </span>
            )}
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary shadow-card">
            <Banknote className="size-[22px]" aria-hidden />
          </span>
        </div>
        <div className="mt-2 flex min-w-0 items-center gap-1.5">
          {loading || prevLoading ? (
            <Skeleton className="h-5 w-40" />
          ) : delta === null ? (
            <span className="text-body-sm text-on-surface-variant">Sin ventas en el período anterior para comparar</span>
          ) : (
            <>
              <Pill tone={up ? 'primary' : 'error'} icon={up ? TrendingUp : TrendingDown} className="shadow-card">
                <span className="tnum">
                  {up ? '+' : '−'}
                  {Math.abs(delta).toFixed(1)}%
                </span>
              </Pill>
              <span className="truncate text-body-sm text-on-surface-variant">
                {compareText} ({money(prev?.revenue ?? 0)})
              </span>
            </>
          )}
        </div>
        {goalPct !== null && !loading && (
          <div className="mt-2 flex flex-col gap-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, goalPct)}%` }} />
            </div>
            <span className="text-body-sm text-on-surface-variant tnum">
              <b className="font-semibold text-on-surface">{Math.round(goalPct)}%</b> de la meta del período ({money(periodGoal ?? 0)})
            </span>
          </div>
        )}
        {fx.dual && (fx.igtfEnabled || summary.igtf > 0) && !loading && (
          <span className="mt-2 border-t border-dashed border-slate-200 pt-2 text-body-sm text-on-surface-variant tnum">
            IGTF cobrado: <b className="font-semibold text-on-surface">{money(summary.igtf)}</b> · {plural(summary.igtfPayments, 'pago')} en divisas
          </span>
        )}
      </MCard>

      <Tile label="Margen bruto" icon={BadgeCheck} iconClassName="text-primary">
        {loading ? (
          <Skeleton className="my-1.5 h-7 w-20" />
        ) : (
          <div className="my-1 flex flex-col items-start gap-0.5">
            <span className="text-headline-lg-mobile text-on-surface tnum">{summary.count ? `${margin.toFixed(1)}%` : '—'}</span>
            {marginPill}
          </div>
        )}
        <span className="truncate text-[11px] leading-tight text-on-surface-variant tnum">Ganancia: {money(summary.profit)}</span>
      </Tile>

      <Tile label="Total ventas" icon={ReceiptText} iconClassName="text-secondary">
        {loading ? (
          <Skeleton className="my-1.5 h-7 w-20" />
        ) : (
          <div className="my-1 flex flex-col">
            <span className="flex items-baseline gap-1 text-headline-lg-mobile text-on-surface tnum">
              {formatNumber(summary.count)}
              <span className="text-label-sm text-on-surface-variant">{summary.count === 1 ? 'tkt' : 'tkts'}</span>
            </span>
            <span className="truncate text-data-mono font-semibold text-secondary tnum">
              {money(summary.avgTicket)} prom.
            </span>
          </div>
        )}
        <span className="truncate text-[11px] leading-tight text-on-surface-variant tnum">Ticket más alto: {money(summary.maxTicket)}</span>
      </Tile>

      <MCard className="col-span-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-error-container text-on-error-container">
            <PackageX className="size-[18px]" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-label-md text-on-surface">Mermas y anulaciones</span>
            <span className="truncate text-body-sm text-on-surface-variant">
              {shrinkLoading || loading ? 'Calculando…' : incidents ? `${plural(incidents, 'incidente registrado', 'incidentes registrados')}` : 'Sin incidentes en el período'}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className={cn('text-label-lg font-bold tnum', loss > 0 ? 'text-error' : 'text-on-surface')}>{money(loss)}</span>
          {summary.revenue > 0 && loss > 0 && <span className="text-label-sm text-on-surface-variant tnum">{lossPct.toFixed(1)}% del total</span>}
        </div>
      </MCard>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function SalesBars({
  series,
  granularity,
  preset,
  loading,
  money,
  moneyCompact
}: {
  series: TimeBucket[];
  granularity: Granularity;
  preset: ReportPreset;
  loading: boolean;
  money: (n: number) => string;
  moneyCompact: (n: number) => string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const buckets = series.map((b) => b.key).join('|');
  useEffect(() => setSelected(null), [buckets]);

  const bars = useMemo<MiniBar[]>(() => {
    const byWeekday = granularity === 'day' && series.length <= 7;
    return series.map((b) => ({
      key: b.key,
      label: granularity === 'hour' ? `${b.start.getHours()}h` : granularity === 'week' ? String(b.start.getDate()) : byWeekday ? WEEKDAY_INITIAL[b.start.getDay()] : String(b.start.getDate()),
      value: b.revenue,
      title: `${b.longLabel}: ${money(b.revenue)} · ${plural(b.count, 'ticket')}`
    }));
  }, [series, granularity, money]);

  const max = Math.max(0, ...series.map((b) => b.revenue));
  const peak = max > 0 ? series.findIndex((b) => b.revenue === max) : -1;
  const focus = selected ?? (peak >= 0 ? peak : null);
  const focused = focus !== null ? series[focus] : null;
  const short = (b: TimeBucket) =>
    granularity === 'hour' ? `${String(b.start.getHours()).padStart(2, '0')}:00` : granularity === 'week' ? b.label : `${WEEKDAY_SHORT[b.start.getDay()]} ${b.start.getDate()}`;
  const title = granularity === 'hour' ? 'Ventas por hora' : granularity === 'week' ? 'Ventas por semana' : preset === '7d' ? 'Ventas semanales' : 'Ventas por día';
  const labelEvery = bars.length <= 8 ? 1 : granularity === 'hour' ? 3 : Math.ceil(bars.length / 7);

  return (
    <MCard className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-headline-sm text-on-surface">{title}</h2>
          <span className="text-body-sm text-on-surface-variant">Toca una barra para ver el detalle</span>
        </div>
        {focused && (
          <span className="flex max-w-[60%] shrink-0 items-center gap-1 rounded-lg bg-surface-container-high px-2 py-1" aria-live="polite">
            <span className="size-2 shrink-0 rounded-full bg-primary-container" aria-hidden />
            <span className="truncate text-label-sm text-on-surface">
              {short(focused)}: {moneyCompact(focused.revenue)}
              {focus === peak ? ' (Pico)' : ''}
            </span>
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-44 w-full" />
      ) : (
        <MiniBarChart bars={bars} selected={selected} onSelect={setSelected} formatTop={moneyCompact} labelEvery={labelEvery} label={title} />
      )}
      {focused && !loading && (
        <p className="text-body-sm text-on-surface-variant tnum">
          {capitalize(focused.longLabel)} · {money(focused.revenue)} · {plural(focused.count, 'ticket')}
          {focused.voidedCount ? ` · ${plural(focused.voidedCount, 'anulada')}` : ''}
        </p>
      )}
    </MCard>
  );
}

/* ------------------------------------------------------------------ */

function PaymentsCard({
  stats,
  loading,
  money,
  fx,
  colorOf
}: {
  stats: PaymentStat[];
  loading: boolean;
  money: (n: number) => string;
  fx: ReportFx;
  colorOf: (methodId: string) => string;
}) {
  const used = stats.filter((s) => s.amountBase > 0).sort((a, b) => b.share - a.share);

  return (
    <MCard className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-headline-sm text-on-surface">Métodos de cobro</h2>
        <SectionNote>{used.length ? plural(used.length, 'forma de pago', 'formas de pago') : ''}</SectionNote>
      </div>
      {loading ? (
        <>
          <Skeleton className="h-3 w-full rounded-full" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </>
      ) : used.length === 0 ? (
        <p className="rounded-lg bg-surface-container-low p-3 text-body-sm text-on-surface-variant">Sin cobros registrados en este período.</p>
      ) : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-container" aria-hidden>
            {used.map((s) => (
              <div key={s.method} className="h-full" style={{ width: `${s.share}%`, background: colorOf(s.method) }} title={`${s.label}: ${Math.round(s.share)}%`} />
            ))}
          </div>
          <ul className="mt-1 flex flex-col gap-1">
            {used.map((s) => (
              <li key={s.method} className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-low/70 p-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(s.method) }} aria-hidden />
                  <span className="truncate text-label-md font-medium text-on-surface">{s.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="flex flex-col items-end">
                    <span className="text-data-mono font-semibold text-on-surface tnum">{fx.dual ? fx.moneyIn(s.amount, s.currency) : money(s.amountBase)}</span>
                    {fx.dual && s.side === 'local' && <span className="text-[11px] leading-tight text-on-surface-variant tnum">≈ {money(s.equivBase)}</span>}
                  </span>
                  <span className="w-11 rounded bg-surface-container-high py-0.5 text-center text-[11px] font-bold text-on-surface tnum">{Math.round(s.share)}%</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </MCard>
  );
}

/* ------------------------------------------------------------------ */

function TopRotation({ stats, loading, money }: { stats: ProductStat[]; loading: boolean; money: (n: number) => string }) {
  const top = useMemo(() => topProducts(stats, 'units', 5), [stats]);
  const maxUnits = top[0]?.units || 1;

  return (
    <MCard className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-headline-sm text-on-surface">Top 5 rotación</h2>
          <span className="text-body-sm text-on-surface-variant">Por unidades vendidas</span>
        </div>
        <Medal className="size-5 shrink-0 text-outline" aria-hidden />
      </div>
      {loading ? (
        [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)
      ) : top.length === 0 ? (
        <p className="rounded-lg bg-surface-container-low p-3 text-body-sm text-on-surface-variant">Aún no hay productos vendidos en este período.</p>
      ) : (
        <ol className="flex flex-col gap-3 pt-1">
          {top.map((s, i) => (
            <li key={s.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tnum',
                      i === 0 ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-on-surface'
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="truncate text-label-md font-semibold text-on-surface" title={s.name}>
                    {s.name}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-body-sm text-on-surface-variant tnum">{formatNumber(s.units)} un.</span>
                  <span className="text-data-mono font-bold text-on-surface tnum">{money(s.revenue)}</span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(s.units / maxUnits) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </MCard>
  );
}
