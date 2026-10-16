import { Link } from 'react-router';
import { CircleCheck, CloudOff, History, ReceiptText, RotateCcw, ShoppingCart } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { formatRelative } from '@/lib/format';
import { activeRegisters, registersOf } from '@/lib/registers';
import { cn } from '@/lib/utils';
import type { Sale } from '@/types';
import { Skeleton } from '@/components/ui';
import { MCard, MSectionHeader } from '@/components/mobile';
import { saleMethodsText, saleTime } from '@/features/sales/saleUtils';

/** Últimas ventas en tiempo real (tocar una abre su ticket). */
export function LiveLog({
  sales,
  loading,
  mine,
  canSell,
  money,
  onOpen
}: {
  sales: Sale[];
  loading: boolean;
  mine: boolean;
  canSell: boolean;
  money: (n: number) => string;
  onOpen: (sale: Sale) => void;
}) {
  const { business } = useActiveBusiness();
  const multi = activeRegisters(business).length > 1;
  const regName = new Map(registersOf(business).map((r) => [r.id, r.name]));

  return (
    <section className="flex flex-col gap-2" aria-label={mine ? 'Mis últimas ventas' : 'Bitácora en vivo'}>
      <MSectionHeader
        icon={History}
        iconClassName="text-secondary"
        title={mine ? 'Mis últimas ventas' : 'Bitácora en vivo'}
        aside={
          <Link to="/ventas" className="shrink-0 rounded text-label-sm text-primary hover:underline">
            Ver historial
          </Link>
        }
      />
      <MCard padded={false} className="flex flex-col gap-1 p-2">
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2 p-2">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-4 w-14" />
            </div>
          ))
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
            <ReceiptText className="size-7 text-outline" aria-hidden />
            <p className="text-body-sm text-on-surface-variant">Aún no hay ventas. Aquí verás cada ticket en cuanto se cobre.</p>
            {canSell && (
              <Link to="/pos" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-label-lg text-on-primary shadow-card">
                <ShoppingCart className="size-[18px]" aria-hidden /> Ir al punto de venta
              </Link>
            )}
          </div>
        ) : (
          sales.slice(0, 5).map((s) => {
            const voided = s.status === 'voided';
            const chip = voided ? 'Anulada' : multi && s.registerId ? (regName.get(s.registerId) ?? 'Caja') : saleMethodsText(s);
            const when = formatRelative(saleTime(s));
            const lines = s.items?.length ?? 0;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpen(s)}
                aria-label={`Ver ticket ${s.folio}`}
                className="flex w-full items-start justify-between gap-2 rounded-lg p-2 text-left transition-colors hover:bg-surface-container-low active:bg-surface-container-low"
              >
                <span className="flex min-w-0 items-start gap-2">
                  <span
                    className={cn(
                      'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                      voided ? 'bg-error-container text-on-error-container' : s.offline ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-primary-fixed text-on-primary-fixed'
                    )}
                    aria-hidden
                  >
                    {voided ? <RotateCcw className="size-[18px]" /> : s.offline ? <CloudOff className="size-[18px]" /> : <CircleCheck className="size-[18px]" />}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-label-lg font-bold text-on-surface tnum">Ticket {s.folio}</span>
                      <span
                        className={cn(
                          'max-w-28 shrink-0 truncate rounded px-1.5 py-px text-label-sm',
                          voided ? 'bg-error-container text-on-error-container' : 'bg-surface-container text-on-surface-variant'
                        )}
                      >
                        {chip}
                      </span>
                    </span>
                    <span className="truncate text-body-sm text-outline">
                      {when.charAt(0).toUpperCase() + when.slice(1)} • {lines} {lines === 1 ? 'artículo' : 'artículos'}
                    </span>
                  </span>
                </span>
                <span className={cn('shrink-0 text-label-lg font-bold tnum', voided ? 'text-error line-through' : 'text-primary')}>
                  {voided ? '−' : '+'}
                  {money(s.total)}
                </span>
              </button>
            );
          })
        )}
      </MCard>
    </section>
  );
}
