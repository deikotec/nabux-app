import { useMemo } from 'react';
import { BadgePercent, Coins, Wallet } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useFx } from '@/contexts/FxContext';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { sumPayments } from '@/services/cash';
import { Card, Skeleton } from '@/components/ui';
import type { MethodTotal, PaymentKind, Sale } from '@/types';
import { KIND_ICONS, KIND_TONES } from './SaleBadges';

interface Row extends MethodTotal {
  id: string;
}

/**
 * Cobros del período por forma de pago, cada uno en SU moneda (neto: descuenta los vueltos
 * entregados con ese método), con su equivalente aplicado a ventas en $ y el IGTF cobrado.
 * Solo se muestra en modo bimonetario.
 */
export function PaymentBreakdownCard({ sales, loading }: { sales: Sale[]; loading: boolean }) {
  const { money } = useActiveBusiness();
  const fx = useFx();

  const totals = useMemo(
    () => sumPayments(sales, { baseCurrency: fx.baseCurrency, localCurrency: fx.localCurrency, methods: fx.allMethods }),
    [sales, fx.baseCurrency, fx.localCurrency, fx.allMethods]
  );

  const rows = useMemo<Row[]>(() => {
    const config = new Map(fx.allMethods.map((m) => [m.id, m]));
    return Object.entries(totals.byMethod ?? {})
      .map(([id, m]) => {
        const cfg = config.get(id);
        // Un método usado solo para dar vuelto llega sin nombre ni tipo propios: se toman de la configuración.
        const onlyChange = m.count === 0;
        return {
          ...m,
          id,
          label: cfg && (m.label === id || onlyChange) ? cfg.label : m.label,
          kind: (cfg && onlyChange ? cfg.kind : m.kind) as PaymentKind
        };
      })
      .filter((r) => r.count > 0 || Math.abs(r.amount) > 0.004)
      .sort((a, b) => b.amountBase - a.amountBase || b.count - a.count);
  }, [totals, fx.allMethods]);

  const amountIn = (n: number, currency: string) => fx.moneyIn(n, currency || fx.baseCurrency);
  const igtf = totals.igtf ?? 0;
  const hasCash = rows.some((r) => r.kind === 'cash');

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
            <Coins className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-headline-sm text-on-surface">Cobros por forma de pago</h2>
            <p className="text-body-sm text-on-surface-variant">Neto recibido en la moneda de cada método (descontando vueltos) en las ventas completadas.</p>
          </div>
        </div>
        {!loading && hasCash && (
          <div className="flex flex-wrap items-center gap-2 text-label-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed/35 px-2.5 py-1 text-on-primary-fixed-variant tnum">
              <Wallet className="size-3.5" aria-hidden />
              Efectivo neto: {amountIn(totals.cashBase ?? 0, fx.baseCurrency)} · {amountIn(totals.cashLocal ?? 0, fx.localCurrency)}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-2 p-4 sm:p-5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[76px] w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="m-4 rounded-xl bg-surface-container-low px-4 py-3 text-body-md text-on-surface-variant sm:m-5">Sin cobros en el período.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 p-4 sm:p-5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {rows.map((r) => {
            const Icon = KIND_ICONS[r.kind] ?? Wallet;
            const isLocal = !!fx.localCurrency && r.currency === fx.localCurrency;
            const negative = r.amount < 0;
            return (
              <li key={r.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200/80 bg-surface-container-lowest p-3">
                <span className="hidden size-9 shrink-0 min-[420px]:flex items-center justify-center rounded-lg bg-surface-container-low">
                  <Icon className={cn('size-[18px]', KIND_TONES[r.kind] ?? KIND_TONES.other)} aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-center gap-1 text-label-md text-on-surface-variant" title={r.label}>
                    <Icon className={cn('size-3.5 shrink-0 min-[420px]:hidden', KIND_TONES[r.kind] ?? KIND_TONES.other)} aria-hidden />
                    <span className="truncate">{r.label}</span>
                  </span>
                  <span
                    className={cn('truncate text-headline-sm tnum', negative ? 'text-error' : 'text-on-surface')}
                    title={negative ? 'Se entregó más en vueltos de lo que se recibió con este método' : undefined}
                  >
                    {amountIn(r.amount, r.currency)}
                  </span>
                  <span className="truncate text-body-sm text-on-surface-variant tnum">
                    {r.count > 0 ? `${formatNumber(r.count)} ${r.count === 1 ? 'pago' : 'pagos'}` : 'Solo vueltos'}
                    {isLocal && r.amountBase > 0 ? ` · ≈ ${money(r.amountBase)}` : ''}
                  </span>
                </span>
              </li>
            );
          })}
          {igtf > 0 && (
            <li className="flex min-w-0 items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <span className="hidden size-9 shrink-0 min-[420px]:flex items-center justify-center rounded-lg bg-white text-amber-700">
                <BadgePercent className="size-[18px]" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-label-md text-amber-800">IGTF cobrado ({formatNumber(fx.settings.igtfRate)}%)</span>
                <span className="truncate text-headline-sm text-amber-900 tnum">{money(igtf)}</span>
                <span className="truncate text-body-sm text-amber-800" title="Se cobra aparte: no forma parte del total vendido">Sobre pagos en divisas</span>
              </span>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}
