import { useNavigate } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, ArrowRightLeft, CircleCheck, CircleDashed, PackagePlus, ReceiptText, Rocket, ShoppingCart, UserPlus, Wallet } from 'lucide-react';
import { DEFAULT_RECEIPT_FOOTER } from '@/config/app';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCash } from '@/contexts/CashContext';
import { useFx } from '@/contexts/FxContext';
import { useBusinessInvites, useClosedCashSessions, useMembers } from '@/hooks/data';
import { Button, Card, ProgressBar } from '@/components/ui';
import { firstName } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Sale } from '@/types';

const XL_COLS: Record<number, string> = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5',
  6: 'xl:grid-cols-3'
};

interface Step {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
  done: boolean;
  cta: string;
  action: () => void;
  loading?: boolean;
}

/**
 * Checklist de arranque para negocios nuevos. Cada paso se marca con datos reales
 * y solo se muestran los pasos que el usuario puede realizar con sus permisos.
 * En modo bimonetario incluye "Configura la tasa de cambio" (listo cuando hay tasa).
 */
export function GettingStartedCard({
  productCount,
  recentSales,
  onSetupRates
}: {
  productCount: number;
  recentSales: Sale[];
  /** Carga la tasa del día (desde internet o a mano). */
  onSetupRates: () => void;
}) {
  const { business, can, member } = useActiveBusiness();
  const fx = useFx();
  const { session, requestOpen } = useCash();
  const navigate = useNavigate();
  const members = useMembers();
  const invites = useBusinessInvites();
  const closedSessions = useClosedCashSessions(1);

  const ticketConfigured =
    !!business.logoUrl || (business.receiptFooter ?? '') !== DEFAULT_RECEIPT_FOOTER || (!!business.taxId && !!business.address);

  const all: (Step & { allowed: boolean })[] = [
    {
      key: 'product',
      icon: PackagePlus,
      title: 'Agrega tu primer producto',
      description: 'Da de alta artículos con precio, costo y stock, o impórtalos desde CSV.',
      done: productCount > 0,
      cta: 'Ir a inventario',
      action: () => navigate('/inventario'),
      allowed: can('inventory')
    },
    {
      key: 'fx',
      icon: ArrowRightLeft,
      title: 'Configura la tasa de cambio',
      description: 'Carga la tasa BCV del día (o tráela de internet) para cobrar en bolívares.',
      done: !!fx.rate,
      cta: 'Cargar tasa',
      action: onSetupRates,
      loading: fx.refreshing,
      allowed: fx.enabled && fx.canEditRates
    },
    {
      key: 'cash',
      icon: Wallet,
      title: 'Abre tu caja',
      description: 'Registra el fondo inicial para llevar el control del efectivo del turno.',
      done: !!session || closedSessions.data.length > 0 || recentSales.some((s) => !!s.sessionId),
      cta: 'Abrir caja',
      action: requestOpen,
      allowed: can('pos')
    },
    {
      key: 'sale',
      icon: ShoppingCart,
      title: 'Haz tu primera venta',
      description: 'Escanea o busca productos en la terminal y cobra en segundos.',
      done: recentSales.length > 0,
      cta: 'Ir al POS',
      action: () => navigate('/pos'),
      allowed: can('pos')
    },
    {
      key: 'team',
      icon: UserPlus,
      title: 'Invita a tu equipo',
      description: 'Agrega cajeros o encargados con permisos a la medida.',
      done: members.data.length > 1 || invites.data.length > 0,
      cta: 'Invitar',
      action: () => navigate('/personal'),
      allowed: can('staff')
    },
    {
      key: 'ticket',
      icon: ReceiptText,
      title: 'Configura tu ticket',
      description: 'Logo, datos fiscales y mensaje de pie para tus comprobantes.',
      done: ticketConfigured,
      cta: 'Configurar',
      action: () => navigate('/configuracion'),
      allowed: can('settings')
    }
  ];
  const steps = all.filter((s) => s.allowed);
  if (!steps.length) return null;

  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex flex-col gap-4 bg-linear-to-br from-primary-fixed/25 via-white to-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-card">
            <Rocket className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-headline-md text-on-surface">Primeros pasos{firstName(member.displayName) ? `, ${firstName(member.displayName)}` : ''}</h2>
            <p className="text-body-md text-on-surface-variant">Completa estos pasos para dejar {business.name} listo para vender.</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-56">
          <span className="text-label-md text-on-surface-variant tnum">
            {doneCount} de {steps.length} completados
          </span>
          <ProgressBar value={doneCount} max={steps.length} />
        </div>
      </div>

      <ol className={cn('grid grid-cols-1 gap-3 border-t border-slate-100 p-4 sm:p-5', steps.length > 1 && 'sm:grid-cols-2', XL_COLS[steps.length])}>
        {steps.map((s, i) => {
          const isNext = next?.key === s.key;
          return (
            <li key={s.key} className={cn('flex flex-col gap-3 rounded-xl border p-4', s.done ? 'border-slate-100 bg-slate-50' : isNext ? 'border-primary/30 bg-white shadow-card' : 'border-slate-200 bg-white')}>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg',
                    s.done ? 'bg-emerald-50 text-emerald-600' : isNext ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant'
                  )}
                >
                  <s.icon className="size-[18px]" aria-hidden />
                </span>
                {s.done ? (
                  <span className="inline-flex items-center gap-1 text-label-sm text-emerald-700">
                    <CircleCheck className="size-4" aria-hidden /> Listo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant">
                    <CircleDashed className="size-4" aria-hidden /> Paso {i + 1}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <h3 className={cn('text-label-lg', s.done ? 'text-on-surface-variant line-through decoration-slate-300' : 'text-on-surface')}>{s.title}</h3>
                <p className="text-body-sm text-on-surface-variant">{s.description}</p>
              </div>
              {!s.done && (
                <Button size="sm" variant={isNext ? 'primary' : 'soft'} iconRight={ArrowRight} onClick={s.action} loading={s.loading} className="self-start">
                  {s.cta}
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
