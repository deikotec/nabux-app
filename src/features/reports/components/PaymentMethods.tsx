import { Banknote, ChartPie, CreditCard, Smartphone, type LucideIcon } from 'lucide-react';
import { DonutChart } from '@/components/charts';
import { Skeleton } from '@/components/ui';
import type { PaymentMethod } from '@/types';
import type { PaymentStat } from '../analytics';
import { InlineEmpty, SectionCard, SectionHeader } from './Section';

/** Colores del mockup: efectivo = primario, tarjeta = secundario, transferencia/QR = terciario claro. */
export const PAYMENT_COLORS: Record<PaymentMethod, string> = {
  cash: '#006948',
  card: '#316bf3',
  transfer: '#ffb95f'
};

const PAYMENT_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  transfer: Smartphone
};

export function PaymentMethods({
  stats,
  loading,
  money,
  moneyCompact
}: {
  stats: PaymentStat[];
  loading: boolean;
  money: (n: number) => string;
  moneyCompact: (n: number) => string;
}) {
  const total = stats.reduce((a, s) => a + s.amount, 0);

  return (
    <SectionCard>
      <SectionHeader title="Métodos de pago" subtitle="Participación porcentual en caja" icon={ChartPie} tone="secondary" />
      {loading ? (
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="size-[168px] rounded-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : total <= 0 ? (
        <InlineEmpty icon={ChartPie}>Sin cobros registrados en este período.</InlineEmpty>
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-4">
          <div className="flex justify-center py-1">
            <DonutChart
              size={168}
              thickness={20}
              segments={stats.map((s) => ({ label: s.label, value: s.amount, color: PAYMENT_COLORS[s.method] }))}
              centerValue={<span className={moneyCompact(total).length > 7 ? 'text-headline-md' : 'text-headline-lg'}>{moneyCompact(total)}</span>}
              centerLabel="Facturado"
            />
          </div>
          <ul className="flex flex-col gap-1.5">
            {stats.map((s) => {
              const Icon = PAYMENT_ICONS[s.method];
              return (
                <li key={s.method} className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low px-2.5 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-3 shrink-0 rounded-full" style={{ background: PAYMENT_COLORS[s.method] }} />
                    <Icon className="size-4 shrink-0 text-on-surface-variant" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-label-md text-on-surface">{s.label}</span>
                      <span className="text-[11px] leading-tight text-on-surface-variant tnum">
                        {s.count} {s.count === 1 ? 'ticket' : 'tickets'}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2.5">
                    <span className="text-data-mono text-on-surface-variant tnum">{money(s.amount)}</span>
                    <span className="w-10 text-right text-label-md text-on-surface tnum">{Math.round(s.share)}%</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
