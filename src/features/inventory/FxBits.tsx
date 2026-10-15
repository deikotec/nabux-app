import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Calculator, CloudDownload, Landmark, PencilLine, TriangleAlert, X } from 'lucide-react';
import { Button, NumberInput, useConfirm, useToast } from '@/components/ui';
import { useFx } from '@/contexts/FxContext';
import { useOnline } from '@/hooks/data';
import { formatDate } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import { commitWrite } from './helpers';
import { parseNumber } from './import/numbers';
import type { InventoryFx } from './useInventoryFx';

/** Equivalente en Bs (texto secundario) de un monto en $. No pinta nada sin modo bimonetario o sin tasa. */
export function LocalLine({ usd, local, className }: { usd: number | null | undefined; local: InventoryFx['local']; className?: string }) {
  if (!local) return null;
  return <span className={cn('text-[11px] leading-4 text-on-surface-variant tnum', className)}>{local(usd)}</span>;
}

/** Píldora con la tasa vigente ("BCV (oficial) · 36,52 Bs/$"). */
export function RateChip({ ifx, className }: { ifx: InventoryFx; className?: string }) {
  const fx = useFx();
  if (!ifx.dual || !ifx.rate) return null;
  const when = fx.rates?.bcvDate && fx.rateSource === 'bcv' ? `Vigencia BCV: ${fx.rates.bcvDate}` : fx.rates?.updatedAt ? `Actualizada: ${formatDate(fx.rates.updatedAt)}` : '';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-label-sm tnum',
        ifx.stale ? 'bg-amber-100 text-amber-800' : 'bg-secondary-fixed/60 text-secondary',
        className
      )}
      title={`Los montos en Bs se calculan con esta tasa.${when ? ` ${when}.` : ''}${ifx.stale ? ' La tasa BCV podría estar desactualizada.' : ''}`}
    >
      <Landmark className="size-3.5" aria-hidden />
      {ifx.sourceLabel} · {ifx.rateText}
    </span>
  );
}

/** Aviso discreto cuando el negocio es bimonetario pero aún no hay tasa de cambio. */
export function MissingRateNotice({ ifx, className }: { ifx: InventoryFx; className?: string }) {
  const fx = useFx();
  const toast = useToast();
  const { prompt } = useConfirm();
  const online = useOnline();
  if (!ifx.missingRate) return null;

  const fetchRates = async () => {
    try {
      const r = await fx.refreshFromInternet();
      if (!r.bcv && !r.parallel) toast.warning('El servicio no devolvió tasas. Ingrésala a mano.');
      else toast.success('Tasa de cambio actualizada.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const enterRate = async () => {
    const raw = await prompt({
      title: 'Ingresar tasa de cambio',
      message: `Bolívares por cada dólar (${ifx.sourceLabel}). Se usará en todo el negocio.`,
      inputLabel: 'Tasa (Bs por $)',
      placeholder: 'Ej. 36,52',
      required: true,
      tone: 'primary',
      confirmLabel: 'Guardar tasa'
    });
    if (raw === null) return;
    const n = parseNumber(raw);
    if (n === null || Number.isNaN(n) || n <= 0) {
      toast.error('Escribe una tasa válida, por ejemplo 36,52.');
      return;
    }
    try {
      await commitWrite(fx.updateRates({ [fx.rateSource]: n }), online, (e) => toast.error(errorMessage(e)));
      toast.success('Tasa de cambio guardada.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div
      className={cn('flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-body-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between', className)}
      role="status"
    >
      <span className="flex items-start gap-2">
        <TriangleAlert className="mt-px size-4 shrink-0 text-amber-600" aria-hidden />
        <span>
          <b className="font-semibold">Sin tasa de cambio:</b> los equivalentes en Bs no están disponibles. Los precios en $ funcionan con normalidad.
        </span>
      </span>
      {fx.canEditRates && (
        <span className="flex shrink-0 flex-wrap gap-1.5 pl-6 sm:pl-0">
          <Button size="sm" variant="secondary" icon={CloudDownload} onClick={fetchRates} loading={fx.refreshing} disabled={!online}>
            Consultar BCV
          </Button>
          <Button size="sm" variant="ghost" icon={PencilLine} onClick={enterRate}>
            Ingresar tasa
          </Button>
        </span>
      )}
    </div>
  );
}

/** Botón pequeño "Desde Bs" para el lado derecho de la etiqueta de un campo de precio. */
export function FromLocalTrigger({ ifx, active, onClick }: { ifx: InventoryFx; active: boolean; onClick: () => void }) {
  if (!ifx.dual) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!ifx.rate}
      aria-expanded={active}
      title={ifx.rate ? 'Escribe el precio en bolívares y lo convertimos a $' : 'Sin tasa de cambio'}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-label-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        active ? 'bg-secondary-fixed text-secondary' : 'text-primary hover:bg-surface-container'
      )}
    >
      <Calculator className="size-3.5" aria-hidden />
      Desde Bs
    </button>
  );
}

/**
 * Ayudante "Calcular desde Bs": el usuario escribe un monto en bolívares y se convierte a $
 * con la tasa vigente. Indica la tasa usada y el equivalente final.
 */
export function FromLocalHelper({
  ifx,
  title,
  applyLabel,
  money,
  onApply,
  onClose,
  id
}: {
  ifx: InventoryFx;
  title: string;
  applyLabel: string;
  money: (n: number) => string;
  onApply: (usd: number) => void;
  onClose: () => void;
  id?: string;
}) {
  const [bs, setBs] = useState<number | ''>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const usd = bs === '' || bs <= 0 ? null : ifx.fromLocal(bs);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const apply = () => {
    if (usd === null || usd <= 0) return;
    onApply(usd);
  };

  return (
    <div id={id} className="flex animate-fade-in flex-col gap-3 rounded-xl border border-secondary/25 bg-secondary-fixed/20 p-3" role="group" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-label-md text-on-surface">
          <Calculator className="size-4 text-secondary" aria-hidden />
          {title}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-on-surface-variant transition-colors hover:bg-white/70 hover:text-on-surface"
          aria-label="Cerrar calculadora"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <NumberInput
          ref={inputRef}
          value={bs}
          onValueChange={setBs}
          prefix="Bs."
          placeholder="0,00"
          aria-label="Monto en bolívares"
          className="sm:w-52"
          onKeyDown={(e) => {
            // Dentro del formulario del producto: Enter aplica la conversión, no guarda.
            if (e.key === 'Enter') {
              e.preventDefault();
              apply();
            } else if (e.key === 'Escape') {
              e.stopPropagation();
              onClose();
            }
          }}
        />
        <ArrowRight className="hidden size-4 shrink-0 text-on-surface-variant sm:block" aria-hidden />
        <div className="flex min-w-0 flex-col" aria-live="polite">
          <span className={cn('text-headline-sm tnum', usd ? 'text-on-surface' : 'text-slate-400')}>{usd ? money(usd) : '$ —'}</span>
          <span className="text-body-sm text-on-surface-variant">en $ (moneda base)</span>
        </div>
        <Button size="sm" onClick={apply} disabled={!usd} className="sm:ml-auto">
          {applyLabel}
        </Button>
      </div>
      <p className="text-body-sm text-on-surface-variant">
        Tasa usada: <b className="font-semibold text-on-surface tnum">{ifx.sourceLabel} · {ifx.rateText}</b>
        {usd ? (
          <>
            {' '}
            · Se guarda en $; al cambio de hoy equivale a <span className="tnum">{ifx.local?.(usd)}</span>.
          </>
        ) : (
          '. El precio se guarda en $ y su valor en Bs se actualiza con cada tasa.'
        )}
      </p>
    </div>
  );
}
