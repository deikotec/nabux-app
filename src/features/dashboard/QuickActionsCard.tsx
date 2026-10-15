import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight, LockKeyhole, PackagePlus, ShoppingCart, Tag, Wallet } from 'lucide-react';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCash } from '@/contexts/CashContext';
import { Card, Kbd } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatClock } from '@/features/sales/saleUtils';
import { toDate } from '@/lib/format';

type Tone = 'primary' | 'secondary' | 'tertiary';

interface Action {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tone: Tone;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  kbd?: string;
}

const toneClasses: Record<Tone, string> = {
  primary: 'text-primary group-hover:bg-primary group-hover:text-white',
  secondary: 'text-secondary group-hover:bg-secondary group-hover:text-white',
  tertiary: 'text-tertiary group-hover:bg-tertiary group-hover:text-white'
};

const rowClass =
  'group flex w-full items-center justify-between gap-3 rounded-xl bg-surface-container-low p-2.5 text-left text-on-surface transition-colors hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60';

function Body({ action }: { action: Action }) {
  const Icon = action.icon;
  return (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-card transition-colors', toneClasses[action.tone])}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-label-lg text-on-surface">{action.title}</span>
          <span className="truncate text-body-sm text-on-surface-variant">{action.description}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {action.kbd && <Kbd className="hidden sm:inline">{action.kbd}</Kbd>}
        <ChevronRight className="size-[18px] text-on-surface-variant" aria-hidden />
      </span>
    </>
  );
}

/** Atajos operativos (se ocultan los que el usuario no tiene permitidos). */
export function QuickActionsCard() {
  const { can } = useBusiness();
  const { session, loading, requestOpen, requestClose } = useCash();

  const actions: Action[] = [];
  if (can('pos')) {
    actions.push(
      session
        ? {
            key: 'cash',
            icon: LockKeyhole,
            title: 'Corte de caja',
            description: `Caja abierta desde las ${formatClock(toDate(session.openedAt) ?? new Date())}`,
            tone: 'primary',
            onClick: requestClose
          }
        : {
            key: 'cash',
            icon: Wallet,
            title: 'Abrir caja',
            description: loading ? 'Revisando el estado de tu caja…' : 'Registra el fondo inicial del turno',
            tone: 'primary',
            onClick: requestOpen,
            disabled: loading
          },
      { key: 'pos', icon: ShoppingCart, title: 'Nueva venta', description: 'Cobra un ticket en la terminal', tone: 'primary', to: '/pos', kbd: 'F2' }
    );
  }
  if (can('inventory')) {
    actions.push(
      { key: 'in', icon: PackagePlus, title: 'Entrada de mercancía', description: 'Registra compras y reabastece stock', tone: 'secondary', to: '/inventario' },
      { key: 'prices', icon: Tag, title: 'Lista de precios', description: 'Revisa precios, costos y márgenes', tone: 'tertiary', to: '/inventario' }
    );
  }
  if (!actions.length) return null;

  return (
    <Card padded={false} className="p-4">
      <h2 className="mb-3 text-label-sm tracking-wider text-on-surface-variant uppercase">Acciones directas</h2>
      <ul className="flex flex-col gap-1.5">
        {actions.map((a): ReactNode => (
          <li key={a.key}>
            {a.to ? (
              <Link to={a.to} className={rowClass}>
                <Body action={a} />
              </Link>
            ) : (
              <button type="button" onClick={a.onClick} disabled={a.disabled} className={rowClass}>
                <Body action={a} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
