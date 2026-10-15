import { useState } from 'react';
import { ArrowLeftRight, Banknote, Bitcoin, ChartPie, CircleDollarSign, CreditCard, HandCoins, Smartphone, Wallet, type LucideIcon } from 'lucide-react';
import { DonutChart, type DonutSegment } from '@/components/charts';
import { Segmented, Skeleton, type TabOption } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { PaymentKind } from '@/types';
import { hasActivity, type CurrencyGroup, type PaymentStat } from '../analytics';
import { CURRENCY_COLORS, OTHER_COLOR } from '../colors';
import { plural, type ReportFx } from '../format';
import { InlineEmpty, SectionCard, SectionHeader } from './Section';

const KIND_ICONS: Record<PaymentKind, LucideIcon> = {
  cash: Banknote,
  mobile: Smartphone,
  card: CreditCard,
  transfer: ArrowLeftRight,
  crypto: Bitcoin,
  credit: HandCoins,
  other: Wallet
};

/** Ícono de la forma de pago (los legados conservan los de siempre). */
function iconFor(s: Pick<PaymentStat, 'method' | 'kind'>): LucideIcon {
  if (s.method === 'transfer') return Smartphone;
  return KIND_ICONS[s.kind] ?? Wallet;
}

/** Máximo de porciones en el donut; el resto se agrupa en "Otras". */
const MAX_SEGMENTS = 7;

type View = 'method' | 'currency';
const VIEW_OPTIONS: TabOption<View>[] = [
  { value: 'method', label: 'Por método' },
  { value: 'currency', label: 'Por moneda' }
];

function CurrencyTag({ side, currency, className }: { side: PaymentStat['side']; currency: string; className?: string }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1 py-px text-[10px] leading-tight font-bold tracking-wide',
        side === 'local' ? 'bg-blue-50 text-blue-800' : 'bg-emerald-50 text-emerald-800',
        className
      )}
    >
      {currency === 'VES' ? 'Bs' : currency}
    </span>
  );
}

export function PaymentMethods({
  stats,
  groups,
  loading,
  money,
  moneyCompact,
  fx,
  colorOf
}: {
  stats: PaymentStat[];
  groups: CurrencyGroup[];
  loading: boolean;
  money: (n: number) => string;
  moneyCompact: (n: number) => string;
  fx: ReportFx;
  colorOf: (methodId: string) => string;
}) {
  const [view, setView] = useState<View>('method');
  const dual = fx.dual;
  const total = stats.reduce((a, s) => a + Math.max(0, s.amountBase), 0);
  const active = dual ? stats.filter(hasActivity) : stats;
  const idle = dual ? stats.filter((s) => !hasActivity(s)) : [];

  const withShare = stats.filter((s) => s.amountBase > 0);
  const segments: DonutSegment[] = withShare.slice(0, MAX_SEGMENTS).map((s) => ({ label: s.label, value: s.amountBase, color: colorOf(s.method) }));
  if (withShare.length > MAX_SEGMENTS) {
    const rest = withShare.slice(MAX_SEGMENTS);
    segments.push({ label: `Otras (${rest.length})`, value: rest.reduce((a, s) => a + s.amountBase, 0), color: OTHER_COLOR });
  }

  return (
    <SectionCard>
      <SectionHeader
        title="Métodos de pago"
        subtitle={dual ? 'Participación en las ventas y lo cobrado en cada moneda' : 'Participación porcentual en caja'}
        info={
          dual
            ? 'El % es la parte de las ventas que cubrió cada forma de pago. El monto es lo que entró neto por ella en su moneda (incluye IGTF y descuenta los vueltos entregados con esa forma de pago); el equivalente usa la tasa de cada venta.'
            : undefined
        }
        icon={ChartPie}
        tone="secondary"
      />
      {dual && !loading && total > 0 && <Segmented options={VIEW_OPTIONS} value={view} onChange={setView} size="sm" className="mb-3 self-start" />}

      {loading ? (
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="size-[168px] rounded-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : total <= 0 ? (
        <InlineEmpty icon={ChartPie}>Sin cobros registrados en este período.</InlineEmpty>
      ) : dual && view === 'currency' ? (
        <CurrencyView groups={groups} money={money} fx={fx} colorOf={colorOf} />
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-4">
          <div className="flex justify-center py-1">
            <DonutChart
              size={168}
              thickness={20}
              segments={segments}
              centerValue={<span className={moneyCompact(total).length > 7 ? 'text-headline-md' : 'text-headline-lg'}>{moneyCompact(total)}</span>}
              centerLabel="Facturado"
            />
          </div>
          <ul className="flex flex-col gap-1.5">
            {active.map((s) => {
              const Icon = iconFor(s);
              const notes = [
                plural(s.tickets, 'ticket'),
                s.igtf > 0 ? `IGTF ${money(s.igtf)}` : null,
                s.changeOut > 0 ? `vuelto ${fx.moneyIn(s.changeOut, s.currency)}` : null
              ].filter(Boolean);
              return (
                <li key={s.method} className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low px-2.5 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-3 shrink-0 rounded-full" style={{ background: colorOf(s.method) }} />
                    {/* En móvil (bimonetario) se ocultan ícono y etiqueta de moneda para dar espacio al nombre: el monto ya indica la moneda. */}
                    <Icon className={cn('size-4 shrink-0 text-on-surface-variant', dual && 'hidden sm:block')} />
                    <span className="flex min-w-0 flex-col">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-label-md text-on-surface">{s.label}</span>
                        {dual && <CurrencyTag side={s.side} currency={s.currency} className="hidden sm:inline" />}
                      </span>
                      <span className="truncate text-[11px] leading-tight text-on-surface-variant tnum">{dual ? notes.join(' · ') : plural(s.tickets, 'ticket')}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2.5">
                    {dual ? (
                      <span className="flex flex-col items-end">
                        <span className="text-data-mono text-on-surface tnum">{fx.moneyIn(s.amount, s.currency)}</span>
                        <span className="text-[11px] leading-tight text-on-surface-variant tnum">
                          ≈ {s.side === 'local' ? money(s.equivBase) : s.equivLocal ? fx.formatLocal(s.equivLocal) : '—'}
                        </span>
                      </span>
                    ) : (
                      <span className="text-data-mono text-on-surface-variant tnum">{money(s.amountBase)}</span>
                    )}
                    <span className="w-10 text-right text-label-md text-on-surface tnum">{Math.round(s.share)}%</span>
                  </span>
                </li>
              );
            })}
          </ul>
          {idle.length > 0 && (
            <p className="text-body-sm text-on-surface-variant">
              Sin movimiento en el período: <span className="text-on-surface">{idle.map((s) => s.label).join(', ')}</span>
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function CurrencyView({
  groups,
  money,
  fx,
  colorOf
}: {
  groups: CurrencyGroup[];
  money: (n: number) => string;
  fx: ReportFx;
  colorOf: (methodId: string) => string;
}) {
  const unconverted = groups.reduce((a, g) => a + g.unconverted, 0);
  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* Barra apilada: parte de las ventas cobrada en cada moneda */}
      <div className="flex flex-col gap-1.5" aria-hidden>
        <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-surface-container">
          {groups
            .filter((g) => g.share > 0)
            .map((g) => (
              <div key={g.side} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${g.share}%`, background: CURRENCY_COLORS[g.side] }} />
            ))}
        </div>
      </div>

      {groups.map((g) => {
        const isLocal = g.side === 'local';
        return (
          <div key={g.side} className="flex flex-col gap-2 rounded-xl bg-surface-container-low px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-3 shrink-0 rounded-full" style={{ background: CURRENCY_COLORS[g.side] }} />
                {isLocal ? <Banknote className="size-4 shrink-0 text-on-surface-variant" /> : <CircleDollarSign className="size-4 shrink-0 text-on-surface-variant" />}
                <span className="truncate text-label-lg text-on-surface">{isLocal ? 'Bolívares' : 'Divisas'}</span>
                <CurrencyTag side={g.side} currency={g.currency} />
              </span>
              <span className="text-label-lg text-on-surface tnum" title="Parte de las ventas cobrada en esta moneda">
                {Math.round(g.share)}%
              </span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-headline-sm text-on-surface tnum">{fx.moneyIn(g.amount, g.currency)}</span>
              <span className="text-body-sm text-on-surface-variant tnum">≈ {isLocal ? money(g.equivBase) : fx.formatLocal(g.equivLocal)}</span>
            </div>
            {g.methods.length ? (
              <ul className="flex flex-col gap-1 border-t border-slate-200/70 pt-2">
                {g.methods.map((m) => (
                  <li key={m.method} className="flex items-center justify-between gap-3 text-body-sm">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: colorOf(m.method) }} />
                      <span className="truncate text-on-surface">{m.label}</span>
                      <span className="shrink-0 text-on-surface-variant tnum">· {plural(m.tickets, 'ticket')}</span>
                    </span>
                    <span className="shrink-0 text-on-surface tnum">{fx.moneyIn(m.amount, m.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-on-surface-variant">{isLocal ? 'No hubo cobros en bolívares.' : 'No hubo cobros en divisas.'}</p>
            )}
            {!isLocal && g.igtf > 0 && (
              <p className="text-body-sm text-on-surface-variant tnum">
                Incluye <b className="font-semibold text-on-surface">{money(g.igtf)}</b> de IGTF{fx.igtfRate ? ` (${fx.igtfRate}%)` : ''}
              </p>
            )}
            {g.changeOut > 0 && (
              <p className="text-body-sm text-on-surface-variant tnum">Descontado el vuelto entregado en {isLocal ? 'bolívares' : 'divisas'}.</p>
            )}
          </div>
        );
      })}
      {unconverted > 0 && (
        <p className="text-body-sm text-on-surface-variant">
          {plural(unconverted, 'movimiento')} de ventas sin tasa registrada no {unconverted === 1 ? 'entra' : 'entran'} en el equivalente.
        </p>
      )}
    </div>
  );
}
