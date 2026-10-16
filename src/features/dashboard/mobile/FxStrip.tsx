import { ArrowRightLeft, PencilLine, RefreshCw } from 'lucide-react';
import { useFx } from '@/contexts/FxContext';
import { useOnline } from '@/hooks/data';
import { formatRelative, toDate } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import type { RateSource } from '@/types';
import { Skeleton, useToast } from '@/components/ui';
import { bcvValidityText, rateNumber, usedRateSource } from '../fxText';

const SOURCE: Record<RateSource, string> = { bcv: 'BCV', parallel: 'paralelo', custom: 'propia' };

/** Tasa del día en una fila (modo bimonetario), con aviso si falta o está vieja. */
export function FxStrip({ onEdit }: { onEdit: () => void }) {
  const fx = useFx();
  const online = useOnline();
  const toast = useToast();
  if (!fx.enabled) return null;

  const used = usedRateSource(fx.rates, fx.rateSource);
  const value = used ? (fx.rates?.[used] ?? null) : null;
  const missing = !fx.loading && !fx.rate;
  const stale = !fx.loading && !missing && fx.stale;
  const updatedAt = toDate(fx.rates?.updatedAt);
  const meta = missing
    ? 'Sin tasa: no se puede cobrar en Bs'
    : stale
      ? 'Puede estar desactualizada · revísala'
      : ((used === 'bcv' ? bcvValidityText(fx.rates?.bcvDate) : null) ?? (updatedAt ? `Actualizada ${formatRelative(updatedAt)}` : ''));

  const refresh = async () => {
    try {
      const r = await fx.refreshFromInternet();
      if (!r.bcv && !r.parallel) toast.warning('El servicio no devolvió tasas. Puedes cargarlas a mano.');
      else toast.success(`Tasas actualizadas · BCV ${rateNumber(r.bcv)} Bs/$`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const iconBtn =
    'flex size-9 items-center justify-center rounded-lg bg-surface-container text-on-surface transition-all hover:bg-surface-container-high active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div
      role={missing ? 'alert' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl p-3 shadow-card',
        missing ? 'bg-red-50 ring-1 ring-error/25' : stale ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-surface-container-lowest'
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary shadow-card">
        <ArrowRightLeft className="size-5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-label-sm tracking-wider text-on-surface-variant uppercase">Tasa {SOURCE[used ?? fx.rateSource]} del día</span>
        {fx.loading ? (
          <Skeleton className="my-1 h-5 w-28" />
        ) : (
          <span className="text-headline-sm font-bold text-on-surface tnum">{value ? `${rateNumber(value)} Bs/$` : 'Sin tasa'}</span>
        )}
        {meta && <span className={cn('truncate text-label-sm first-letter:uppercase', missing ? 'text-error' : stale ? 'text-amber-800' : 'text-outline')}>{meta}</span>}
      </div>
      {fx.canEditRates && (
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={refresh} disabled={!online || fx.refreshing} aria-label="Actualizar tasas desde internet" title="Actualizar desde internet" className={iconBtn}>
            <RefreshCw className={cn('size-[18px]', fx.refreshing && 'animate-spin')} aria-hidden />
          </button>
          <button type="button" onClick={onEdit} aria-label="Editar tasas" title="Editar tasas" className={iconBtn}>
            <PencilLine className="size-[18px]" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
