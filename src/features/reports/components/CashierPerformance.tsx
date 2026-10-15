import { Ban, Users } from 'lucide-react';
import { Avatar, Table, TD, TH, THead, TR } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CashierStat } from '../analytics';
import { InlineEmpty, ListSkeleton, SectionCard, SectionHeader } from './Section';

function Voids({ stat, money }: { stat: CashierStat; money: (n: number) => string }) {
  if (!stat.voidedCount) return <span className="text-body-sm text-on-surface-variant">—</span>;
  return (
    <span className="inline-flex flex-col items-end">
      <span className="inline-flex items-center gap-1 text-label-md text-error tnum">
        <Ban className="size-3.5" /> {stat.voidedCount}
      </span>
      <span className="text-body-sm text-on-surface-variant tnum">{money(stat.voidedAmount)}</span>
    </span>
  );
}

function CashierSummary({ stats, money }: { stats: CashierStat[]; money: (n: number) => string }) {
  const tickets = stats.reduce((a, c) => a + c.tickets, 0);
  const voided = stats.reduce((a, c) => a + c.voidedCount, 0);
  const voidedAmount = stats.reduce((a, c) => a + c.voidedAmount, 0);
  const rate = tickets + voided ? (voided / (tickets + voided)) * 100 : 0;
  const item = 'flex min-w-0 flex-col rounded-xl bg-surface-container-low/70 px-3 py-2';
  const label = 'text-label-sm tracking-wider text-on-surface-variant uppercase';
  return (
    <dl className="mt-auto grid grid-cols-1 gap-2 pt-4 min-[420px]:grid-cols-3">
      <div className={item}>
        <dt className={label}>Más ventas</dt>
        <dd className="truncate text-label-lg text-on-surface">{stats[0]?.name ?? '—'}</dd>
      </div>
      <div className={item}>
        <dt className={label}>Cajeros activos</dt>
        <dd className="text-label-lg text-on-surface tnum">{stats.filter((c) => c.tickets > 0).length}</dd>
      </div>
      <div className={item}>
        <dt className={label}>Tasa de anulación</dt>
        <dd className={cn('truncate text-label-lg tnum', voided ? 'text-error' : 'text-primary')}>
          {rate.toFixed(1)}% <span className="text-body-sm font-normal text-on-surface-variant">· {money(voidedAmount)}</span>
        </dd>
      </div>
    </dl>
  );
}

export function CashierPerformance({ stats, loading, money, className }: { stats: CashierStat[]; loading: boolean; money: (n: number) => string; className?: string }) {
  return (
    <SectionCard className={className}>
      <SectionHeader title="Rendimiento por cajero" subtitle="Tickets, ventas y anulaciones de cada persona en el período" icon={Users} tone="secondary" />
      {loading ? (
        <ListSkeleton rows={4} />
      ) : stats.length === 0 ? (
        <InlineEmpty icon={Users}>Nadie ha registrado ventas en este período.</InlineEmpty>
      ) : (
        <>
          {/* Escritorio: tabla */}
          <div className="-mx-5 hidden md:block">
            <Table>
              <THead>
                <TH className="pl-5">Cajero</TH>
                <TH align="right">Tickets</TH>
                <TH align="right">Ventas</TH>
                <TH align="right">Ticket prom.</TH>
                <TH align="right" className="pr-5">
                  Anulaciones
                </TH>
              </THead>
              <tbody>
                {stats.map((c) => (
                  <TR key={c.cashierId} highlight={c.voidedCount > 0 && c.voidedCount >= Math.max(3, c.tickets * 0.1) ? 'danger' : undefined}>
                    <TD className="pl-5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={c.name} size="sm" />
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="truncate text-label-lg text-on-surface">{c.name}</span>
                          <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-container">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, c.share)}%` }} />
                          </div>
                        </div>
                      </div>
                    </TD>
                    <TD align="right">{formatNumber(c.tickets)}</TD>
                    <TD align="right" className="font-semibold text-on-surface">
                      {money(c.revenue)}
                      <span className="block text-body-sm font-normal text-on-surface-variant">{c.share.toFixed(0)}% del total</span>
                    </TD>
                    <TD align="right">{money(c.avgTicket)}</TD>
                    <TD align="right" className="pr-5">
                      <Voids stat={c} money={money} />
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>


          {/* Móvil: tarjetas */}
          <ul className="flex flex-col gap-2 md:hidden">
            {stats.map((c) => (
              <li key={c.cashierId} className={cn('rounded-xl border border-slate-200/80 p-3', c.voidedCount > 0 && 'border-red-100')}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={c.name} size="sm" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-label-lg text-on-surface">{c.name}</span>
                      <span className="text-body-sm text-on-surface-variant tnum">
                        {formatNumber(c.tickets)} tickets · prom. {money(c.avgTicket)}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-label-lg text-on-surface tnum">{money(c.revenue)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, c.share)}%` }} />
                  </div>
                  {c.voidedCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-body-sm text-error tnum">
                      <Ban className="size-3.5" /> {c.voidedCount} · {money(c.voidedAmount)}
                    </span>
                  ) : (
                    <span className="text-body-sm text-on-surface-variant">Sin anulaciones</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <CashierSummary stats={stats} money={money} />
        </>
      )}
    </SectionCard>
  );
}
