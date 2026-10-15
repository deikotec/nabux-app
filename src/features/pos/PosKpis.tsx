import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Banknote, CirclePause, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PosKpisProps {
  todayCount: number;
  todayTotal: number;
  todayLoading: boolean;
  cashInDrawer: number | null;
  openingFloat: number | null;
  cashLoading: boolean;
  heldCount: number;
  money: (n: number) => string;
  onCashClick: () => void;
  onHeldClick: () => void;
}

/** Tira de métricas rápidas del turno, debajo del catálogo. */
export function PosKpis({
  todayCount,
  todayTotal,
  todayLoading,
  cashInDrawer,
  openingFloat,
  cashLoading,
  heldCount,
  money,
  onCashClick,
  onHeldClick
}: PosKpisProps) {
  return (
    <div className="grid grid-cols-1 gap-2 @xl:grid-cols-3 sm:gap-3">
      <MiniKpi
        icon={ShoppingBag}
        tone="bg-primary-fixed text-primary"
        label="Mis ventas hoy"
        loading={todayLoading}
        value={`${todayCount} ${todayCount === 1 ? 'ticket' : 'tickets'}`}
        sub={money(todayTotal)}
      />
      <MiniKpi
        icon={Banknote}
        tone="bg-secondary-fixed text-secondary"
        label="Efectivo en caja"
        loading={cashInDrawer !== null && cashLoading}
        value={cashInDrawer !== null ? money(cashInDrawer) : 'Caja cerrada'}
        sub={cashInDrawer !== null ? `Fondo inicial ${money(openingFloat ?? 0)}` : 'Toca para abrir caja'}
        onClick={onCashClick}
        actionLabel={cashInDrawer !== null ? 'Hacer corte de caja' : 'Abrir caja'}
      />
      <MiniKpi
        icon={CirclePause}
        tone="bg-tertiary-fixed text-tertiary"
        label="Tickets en pausa"
        value={`${heldCount} ${heldCount === 1 ? 'cliente' : 'clientes'}`}
        sub={heldCount ? 'Toca para recuperar' : 'F8 pone un ticket en espera'}
        onClick={heldCount ? onHeldClick : undefined}
        actionLabel="Ver tickets en espera"
      />
    </div>
  );
}

function MiniKpi({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  loading,
  onClick,
  actionLabel
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  loading?: boolean;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const body = (
    <>
      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="size-[22px]" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-label-sm text-on-surface-variant uppercase">{label}</span>
        {loading ? (
          <span className="mt-1 h-5 w-24 animate-pulse rounded bg-slate-100" />
        ) : (
          <span className="truncate text-headline-sm text-on-surface tnum">{value}</span>
        )}
        {sub && <span className="truncate text-body-sm text-on-surface-variant tnum">{sub}</span>}
      </div>
    </>
  );
  const cls = 'flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 text-left shadow-card';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={actionLabel} className={cn(cls, 'transition-shadow hover:shadow-lift')}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}
