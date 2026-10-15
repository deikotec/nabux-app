import { Link } from 'react-router';
import { ChevronRight, ReceiptText, ShoppingCart } from 'lucide-react';
import { Card, EmptyState, Skeleton, StatusDot, Table, TD, TH, THead, TR } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { sameDay } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { Sale } from '@/types';
import { OfflineBadge, PaymentBadge, SaleLocalAmount, SaleStatusBadge } from '@/features/sales/SaleBadges';
import { formatClock, saleTime, summarizeItems } from '@/features/sales/saleUtils';

function when(d: Date) {
  const now = new Date();
  if (sameDay(d, now)) return null;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  return sameDay(d, y) ? 'Ayer' : formatDate(d, { day: 'numeric', month: 'short' });
}

export function RecentSalesCard({
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
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <h2 className="text-headline-md text-on-surface">{mine ? 'Mis últimas ventas' : 'Últimas ventas'}</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
            <StatusDot tone="success" pulse /> En vivo
          </span>
        </div>
        <Link
          to="/ventas"
          className="inline-flex items-center gap-0.5 rounded text-label-md text-primary hover:text-primary-hover hover:underline focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          Ver historial completo <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3 border-t border-slate-100 p-5" aria-busy="true" aria-label="Cargando ventas">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : sales.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Aún no hay ventas"
          description={canSell ? 'Cobra tu primer ticket desde la terminal de punto de venta.' : 'Aquí aparecerán los tickets en cuanto se registren.'}
          action={
            canSell ? (
              <Link
                to="/pos"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-label-lg text-on-primary shadow-card hover:bg-primary-hover"
              >
                <ShoppingCart className="size-[18px]" aria-hidden /> Ir al punto de venta
              </Link>
            ) : undefined
          }
          className="border-t border-slate-100"
        />
      ) : (
        <>
          {/* La tabla se adapta al ancho de la tarjeta: en contenedores angostos la hora va bajo el folio
              y el método de pago se muestra solo con ícono. */}
          <div className="hidden @container md:block">
            <Table>
              <THead>
                <TH className="pl-6">Folio / Ticket</TH>
                <TH className="hidden @min-[46rem]:table-cell">Hora</TH>
                <TH>Artículos</TH>
                <TH>
                  <span className="@min-[42rem]:hidden">Pago</span>
                  <span className="hidden @min-[42rem]:inline">Método de pago</span>
                </TH>
                <TH align="right">Total</TH>
                <TH align="center" className="pr-6">
                  Estado
                </TH>
              </THead>
              <tbody>
                {sales.map((s) => {
                  const d = saleTime(s);
                  const day = when(d);
                  const voided = s.status === 'voided';
                  const time = `${day ? `${day} · ` : ''}${formatClock(d)}`;
                  return (
                    <TR key={s.id} onClick={() => onOpen(s)}>
                      <TD className="pl-6">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(s);
                          }}
                          aria-label={`Ver ticket ${s.folio}`}
                          className="flex items-center gap-2 rounded-md text-on-surface hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                        >
                          <ReceiptText className="size-[18px] shrink-0 text-primary" aria-hidden />
                          <span className="text-data-mono font-bold whitespace-nowrap tnum">{s.folio}</span>
                        </button>
                        <span className="mt-0.5 block pl-[26px] text-body-sm whitespace-nowrap text-on-surface-variant tnum @min-[46rem]:hidden">{time}</span>
                        {s.offline && <OfflineBadge />}
                      </TD>
                      <TD className="hidden whitespace-nowrap text-on-surface-variant @min-[46rem]:table-cell">
                        <span className="text-body-sm tnum">{formatClock(d)}</span>
                        {day && <span className="block text-body-sm">{day}</span>}
                      </TD>
                      <TD>
                        <span className="line-clamp-2 min-w-28 max-w-64 text-body-sm text-on-surface" title={summarizeItems(s.items, 50)}>
                          {summarizeItems(s.items)}
                        </span>
                      </TD>
                      <TD>
                        <PaymentBadge sale={s} short compactBelow="42rem" />
                      </TD>
                      <TD align="right" className={cn('font-bold whitespace-nowrap', voided ? 'text-on-surface-variant line-through' : 'text-on-surface')}>
                        {money(s.total)}
                        <SaleLocalAmount sale={s} />
                      </TD>
                      <TD align="center" className="pr-6">
                        <SaleStatusBadge status={s.status} />
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>

          <ul className="divide-y divide-slate-100 border-t border-slate-100 md:hidden">
            {sales.map((s) => {
              const d = saleTime(s);
              const day = when(d);
              const voided = s.status === 'voided';
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(s)}
                    aria-label={`Ver ticket ${s.folio}`}
                    className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                  >
                    <ReceiptText className="mt-0.5 size-[18px] shrink-0 text-primary" aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-data-mono font-bold tnum">{s.folio}</span>
                        <span className={cn('text-right text-label-lg tnum', voided ? 'text-on-surface-variant line-through' : 'text-on-surface')}>
                          {money(s.total)}
                          <SaleLocalAmount sale={s} />
                        </span>
                      </span>
                      <span className="truncate text-body-sm text-on-surface">{summarizeItems(s.items, 2)}</span>
                      <span className="flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
                        <span className="tnum">
                          {day ? `${day} · ` : ''}
                          {formatClock(d)}
                        </span>
                        <PaymentBadge sale={s} short className="py-0.5" />
                        {voided && <SaleStatusBadge status={s.status} />}
                        {s.offline && <OfflineBadge />}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
