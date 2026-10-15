import { ReceiptText } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar, Skeleton, Table, TD, TH, THead, TR } from '@/components/ui';
import type { Sale } from '@/types';
import { OfflineBadge, PaymentBadge, SaleStatusBadge } from './SaleBadges';
import { formatClock, formatQty, saleTime, summarizeItems } from './saleUtils';

interface SalesListProps {
  rows: Sale[];
  loading: boolean;
  showCashier: boolean;
  money: (n: number) => string;
  onOpen: (sale: Sale) => void;
}

const DEFAULT_CUSTOMER = 'Cliente mostrador';

/*
 * La tabla se adapta al ancho de su contenedor (container queries):
 *  - < 52rem: método de pago solo con ícono.
 *  - < 60rem: el cajero se muestra bajo la fecha.
 *  - < 70rem: el cliente se muestra bajo el folio.
 * En móvil (< md) se usa una lista de tarjetas.
 */
export function SalesList({ rows, loading, showCashier, money, onOpen }: SalesListProps) {
  if (loading) return <SalesListSkeleton />;
  return (
    <>
      <div className="hidden @container md:block">
        <Table>
          <THead>
            <TH>Folio</TH>
            <TH>Fecha y hora</TH>
            <TH className="hidden @min-[70rem]:table-cell">Cliente</TH>
            {showCashier && <TH className="hidden @min-[60rem]:table-cell">Cajero</TH>}
            <TH>Artículos</TH>
            <TH>Método</TH>
            <TH align="right">Total</TH>
            <TH align="center">Estado</TH>
          </THead>
          <tbody>
            {rows.map((s) => {
              const d = saleTime(s);
              const voided = s.status === 'voided';
              const customer = s.customerName || DEFAULT_CUSTOMER;
              return (
                <TR key={s.id} onClick={() => onOpen(s)} highlight={voided ? 'danger' : undefined}>
                  <TD>
                    <div className="flex flex-col items-start gap-1">
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
                      {customer !== DEFAULT_CUSTOMER && (
                        <span className="block max-w-36 truncate pl-[26px] text-body-sm text-on-surface-variant @min-[70rem]:hidden" title={customer}>
                          {customer}
                        </span>
                      )}
                      {s.offline && <OfflineBadge />}
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap">
                    <div>{formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    <div className="text-body-sm text-on-surface-variant tnum">{formatClock(d)} hrs</div>
                    {showCashier && (
                      <div className="max-w-36 truncate text-body-sm text-on-surface-variant @min-[60rem]:hidden" title={s.cashierName}>
                        {s.cashierName}
                      </div>
                    )}
                  </TD>
                  <TD className="hidden @min-[70rem]:table-cell">
                    <span className="block max-w-40 truncate" title={customer}>
                      {customer}
                    </span>
                  </TD>
                  {showCashier && (
                    <TD className="hidden @min-[60rem]:table-cell">
                      <span className="flex max-w-44 items-center gap-2">
                        <Avatar name={s.cashierName} size="xs" />
                        <span className="truncate">{s.cashierName}</span>
                      </span>
                    </TD>
                  )}
                  <TD>
                    <p className="line-clamp-2 max-w-72 min-w-32 text-body-sm text-on-surface" title={summarizeItems(s.items, 50)}>
                      {summarizeItems(s.items)}
                    </p>
                    <p className="text-body-sm text-on-surface-variant tnum">{formatQty(Number(s.itemCount) || 0)} art.</p>
                  </TD>
                  <TD>
                    <PaymentBadge method={s.paymentMethod} compactBelow="52rem" />
                  </TD>
                  <TD align="right" className={cn('font-bold whitespace-nowrap', voided ? 'text-on-surface-variant line-through' : 'text-on-surface')}>
                    {money(s.total)}
                  </TD>
                  <TD align="center">
                    <SaleStatusBadge status={s.status} />
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </div>

      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((s) => {
          const d = saleTime(s);
          const voided = s.status === 'voided';
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onOpen(s)}
                aria-label={`Ver ticket ${s.folio}`}
                className={cn(
                  'flex w-full flex-col gap-2 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none',
                  voided && 'bg-red-50/40'
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <ReceiptText className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-data-mono font-bold tnum">{s.folio}</span>
                    {s.offline && <OfflineBadge />}
                  </span>
                  <SaleStatusBadge status={s.status} />
                </span>
                <span className="line-clamp-2 text-body-sm text-on-surface">{summarizeItems(s.items)}</span>
                <span className="truncate text-body-sm text-on-surface-variant tnum">
                  {formatDate(d, { day: 'numeric', month: 'short' })} · {formatClock(d)}
                  {s.customerName && s.customerName !== DEFAULT_CUSTOMER ? ` · ${s.customerName}` : ''}
                  {showCashier ? ` · ${s.cashierName}` : ''}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <PaymentBadge method={s.paymentMethod} />
                  <span className={cn('text-headline-sm tnum', voided ? 'text-on-surface-variant line-through' : 'text-on-surface')}>{money(s.total)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function SalesListSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="Cargando ventas">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="hidden h-10 w-28 sm:block" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="hidden h-10 w-28 md:block" />
          <Skeleton className="h-10 w-20" />
        </div>
      ))}
    </div>
  );
}
