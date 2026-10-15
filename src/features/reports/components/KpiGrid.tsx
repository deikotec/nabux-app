import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Banknote, Info, PackageX, Percent, ReceiptText, Wallet } from 'lucide-react';
import { Badge, Card, DeltaChip, Skeleton, type Tone } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { cn, round2 } from '@/lib/utils';
import { lossLevel, pctChange, type LossLevel, type SalesSummary, type ShrinkSummary } from '../analytics';
import { plural, plainPct, type ReportFx } from '../format';
import { IconChip, type SectionTone } from './Section';

const blob: Record<Exclude<SectionTone, 'neutral'>, string> = {
  primary: 'bg-primary-fixed/25',
  secondary: 'bg-secondary-fixed/50',
  tertiary: 'bg-tertiary-fixed/45',
  error: 'bg-error-container/50'
};

const barColor: Record<Exclude<SectionTone, 'neutral'>, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary-container',
  tertiary: 'bg-tertiary-container',
  error: 'bg-error'
};

function KpiTile({
  label,
  icon,
  tone,
  value,
  sub,
  loading,
  footer,
  bar,
  caption,
  extra
}: {
  label: string;
  icon: LucideIcon;
  tone: Exclude<SectionTone, 'neutral'>;
  value: string;
  /** Línea secundaria bajo el valor (equivalente en moneda local). */
  sub?: ReactNode;
  loading: boolean;
  footer: ReactNode;
  /** 0–100; null oculta la barra. */
  bar: number | null;
  caption?: ReactNode;
  /** Dato adicional al pie de la tarjeta (ej. IGTF cobrado). */
  extra?: ReactNode;
}) {
  return (
    <Card className="relative flex min-w-0 flex-col gap-3 overflow-hidden">
      <span aria-hidden className={cn('pointer-events-none absolute -right-6 -bottom-6 size-24 rounded-full', blob[tone])} />
      <div className="flex items-start justify-between gap-3">
        <span className="text-label-md text-on-surface-variant">{label}</span>
        <IconChip icon={icon} tone={tone} />
      </div>
      {loading ? (
        <Skeleton className="h-9 w-40" />
      ) : (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-headline-lg text-on-surface tnum" title={value}>
            {value}
          </span>
          {sub}
        </div>
      )}
      <div className="relative flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1">{loading ? <Skeleton className="h-5 w-32" /> : footer}</div>
      <div className="relative mt-auto flex flex-col gap-1.5">
        {bar !== null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
            <div className={cn('h-full rounded-full transition-all', barColor[tone])} style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
          </div>
        )}
        {caption && !loading && <span className="truncate text-body-sm text-on-surface-variant">{caption}</span>}
        {extra && !loading && <div className="mt-1">{extra}</div>}
      </div>
    </Card>
  );
}

/** "≈ Bs. 1.234,56 ⓘ" con la explicación de cómo se calculó en el tooltip. */
function LocalLine({ value, help }: { value: string; help: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-label-md text-on-surface-variant tnum" title={help}>
      <span className="truncate">≈ {value}</span>
      <Info className="size-3.5 shrink-0 text-outline" aria-label={help} />
    </span>
  );
}

const LOSS_BADGE: Record<LossLevel, { tone: Tone; label: string }> = {
  none: { tone: 'success', label: 'Sin pérdidas' },
  low: { tone: 'success', label: 'Bajo control' },
  watch: { tone: 'warning', label: 'Vigilar' },
  high: { tone: 'danger', label: 'Alto' }
};

export function KpiGrid({
  summary,
  prev,
  compare,
  prevLoading,
  loading,
  shrink,
  shrinkLoading,
  periodGoal,
  compareText,
  money,
  fx
}: {
  summary: SalesSummary;
  prev: SalesSummary | null;
  compare: boolean;
  prevLoading: boolean;
  loading: boolean;
  shrink: ShrinkSummary;
  shrinkLoading: boolean;
  /** Meta acumulada del período (meta diaria × días); null si no hay meta. */
  periodGoal: number | null;
  compareText: string;
  money: (n: number) => string;
  fx: ReportFx;
}) {
  const delta = (cur: number, before: number | undefined) =>
    prevLoading ? <Skeleton className="h-5 w-16" /> : <DeltaChip value={before === undefined ? null : pctChange(cur, before)} />;

  const goalPct = periodGoal ? (summary.revenue / periodGoal) * 100 : null;
  const loss = round2(summary.voidedAmount + shrink.amount);
  const lossInfo = lossLevel(loss, summary.revenue);
  const badge = LOSS_BADGE[lossInfo.level];

  /* ---------- Moneda local (solo modo bimonetario) ---------- */
  const dual = fx.dual;
  const missing = summary.localMissing ? ` ${plural(summary.localMissing, 'venta')} sin tasa registrada no se ${summary.localMissing === 1 ? 'incluye' : 'incluyen'}.` : '';
  const avgRateText = summary.avgRate ? ` Tasa promedio del período: ${fx.formatRate(summary.avgRate)}.` : '';
  const noLocal = summary.count > 0 && summary.localCount === 0;
  const localValue = (v: number) => (noLocal ? '—' : fx.formatLocal(v));
  const lossLocal = round2(summary.voidedAmountLocal + (shrink.amountLocal ?? 0));
  // Si ninguna anulación ni merma pudo convertirse (sin tasa), no se muestra "Bs. 0,00" engañoso.
  const lossConvertible = summary.voidedCount - summary.voidedLocalMissing + (shrink.count - shrink.localMissing);
  const lossLocalText = loss > 0 && lossConvertible === 0 ? '—' : fx.formatLocal(lossLocal);
  const showIgtf = dual && (fx.igtfEnabled || summary.igtf > 0);

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores clave">
      <KpiTile
        label="Ingresos totales"
        icon={Banknote}
        tone="primary"
        value={money(summary.revenue)}
        sub={
          dual && (
            <LocalLine
              value={localValue(summary.revenueLocal)}
              help={`Suma del total en bolívares de cada venta, a la tasa con que se cobró ese día (no a la tasa de hoy).${avgRateText}${missing}`}
            />
          )
        }
        loading={loading}
        footer={
          compare ? (
            <>
              {delta(summary.revenue, prev?.revenue)}
              <span className="text-body-sm text-on-surface-variant">{compareText}</span>
            </>
          ) : (
            <span className="text-body-sm text-on-surface-variant">
              <b className="font-semibold text-on-surface tnum">{formatNumber(summary.count)}</b> ventas completadas
            </span>
          )
        }
        bar={goalPct}
        caption={
          periodGoal ? (
            <>
              <b className="font-semibold text-on-surface tnum">{Math.round(goalPct ?? 0)}%</b> de la meta del período ({money(periodGoal)})
            </>
          ) : (
            'Sin meta definida para el período'
          )
        }
        extra={
          showIgtf && (
            <div
              className="flex flex-col gap-0.5 border-t border-dashed border-slate-200 pt-2.5"
              title={`IGTF (${plainPct(fx.igtfRate, 0)}) cobrado sobre los pagos en divisas. Se cobra aparte del total de la venta, por eso no suma en los ingresos.`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-label-md text-on-surface-variant">
                  <Percent className="size-3.5" /> IGTF cobrado
                </span>
                <span className="text-label-lg text-on-surface tnum">{money(summary.igtf)}</span>
              </div>
              <span className="text-body-sm text-on-surface-variant tnum">
                {summary.igtfPayments ? (
                  <>
                    {plural(summary.igtfPayments, 'pago')} en divisas por {money(summary.igtfBase)}
                    {summary.igtfLocal ? <span className="whitespace-nowrap"> · ≈ {fx.formatLocal(summary.igtfLocal)}</span> : null}
                  </>
                ) : (
                  'Sin pagos en divisas con IGTF en el período'
                )}
              </span>
            </div>
          )
        }
      />

      <KpiTile
        label="Ganancia neta estimada"
        icon={Wallet}
        tone="secondary"
        value={money(summary.profit)}
        sub={dual && <LocalLine value={localValue(summary.profitLocal)} help={`Ganancia de cada venta convertida a la tasa con que se cobró.${missing}`} />}
        loading={loading}
        footer={
          <>
            <span className="inline-flex items-center rounded-full bg-secondary-fixed px-2 py-0.5 text-label-sm text-on-secondary-fixed-variant tnum">
              Margen {summary.marginPct.toFixed(1)}%
            </span>
            {compare ? delta(summary.profit, prev?.profit) : <span className="text-body-sm text-on-surface-variant">sobre venta neta</span>}
          </>
        }
        bar={summary.marginPct}
        caption={
          <>
            Costo de lo vendido: <span className="tnum">{money(summary.cost)}</span>
          </>
        }
      />

      <KpiTile
        label="Ticket promedio"
        icon={ReceiptText}
        tone="tertiary"
        value={money(summary.avgTicket)}
        sub={
          dual && (
            <LocalLine value={localValue(summary.avgTicketLocal)} help={`Promedio del total en bolívares de cada venta, a la tasa con que se cobró.${missing}`} />
          )
        }
        loading={loading}
        footer={
          <>
            {compare && delta(summary.avgTicket, prev?.avgTicket)}
            <span className="text-body-sm text-on-surface-variant">
              <b className="font-semibold text-on-surface tnum">{formatNumber(summary.count)}</b> transacciones
            </span>
          </>
        }
        bar={summary.maxTicket ? (summary.avgTicket / summary.maxTicket) * 100 : 0}
        caption={
          summary.count ? (
            <>
              Ticket más alto <span className="tnum">{money(summary.maxTicket)}</span> · <span className="tnum">{formatNumber(summary.itemsPerTicket, undefined, 1)}</span> art./ticket
            </>
          ) : (
            'Sin tickets en el período'
          )
        }
      />

      <KpiTile
        label="Mermas y anulaciones"
        icon={PackageX}
        tone="error"
        value={money(loss)}
        sub={
          dual && (
            <LocalLine
              value={lossLocalText}
              help={`Anulaciones: a la tasa registrada en cada venta (${fx.formatLocal(summary.voidedAmountLocal)}). Mermas a costo: a la tasa del día en que se registraron, según el historial de tasas, o la actual si no hay registro (${fx.formatLocal(shrink.amountLocal ?? 0)}).${
                summary.voidedLocalMissing || shrink.localMissing
                  ? ` ${plural(summary.voidedLocalMissing + shrink.localMissing, 'movimiento')} sin tasa no se ${summary.voidedLocalMissing + shrink.localMissing === 1 ? 'incluye' : 'incluyen'}.`
                  : ''
              }`}
            />
          )
        }
        loading={loading || shrinkLoading}
        footer={
          <>
            <Badge tone={badge.tone} dot>
              {badge.label}
            </Badge>
            {lossInfo.level !== 'none' && summary.revenue > 0 && (
              <span className="text-body-sm text-on-surface-variant">
                <span className="tnum">{lossInfo.pct.toFixed(2)}%</span> de los ingresos
              </span>
            )}
          </>
        }
        bar={(lossInfo.pct / 5) * 100}
        caption={
          <span title={`${shrink.count} salidas de inventario (${formatNumber(shrink.units)} uds)`}>
            Anuladas <span className="tnum">{money(summary.voidedAmount)}</span> ({summary.voidedCount}) · Mermas{' '}
            <span className="tnum">{money(shrink.amount)}</span> ({shrink.count})
          </span>
        }
      />
    </section>
  );
}
