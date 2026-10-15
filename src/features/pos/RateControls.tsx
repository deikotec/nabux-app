import { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, CircleAlert, PencilLine, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button, Modal, Popover, useConfirm, useToast } from '@/components/ui';
import { RATE_SOURCE_LABELS } from '@/config/app';
import { useFx } from '@/contexts/FxContext';
import { formatRelative } from '@/lib/format';
import { caracasToday, formatRate } from '@/lib/fx';
import { cn, errorMessage } from '@/lib/utils';
import type { RatesPatch } from '@/services/fx';
import type { FxRates, RateSource } from '@/types';
import { MoneyInput } from './MoneyInput';

const SHORT_SOURCE: Record<RateSource, string> = { bcv: 'BCV', parallel: 'Paralelo', custom: 'Tasa propia' };
const SOURCES: RateSource[] = ['bcv', 'parallel', 'custom'];

/** Fuente cuya tasa se está usando de verdad (si la elegida no tiene valor, se cae a BCV). */
export function effectiveSource(rates: FxRates | null, source: RateSource): RateSource | null {
  if (!rates) return null;
  if ((rates[source] ?? 0) > 0) return source;
  return rates.bcv && rates.bcv > 0 ? 'bcv' : null;
}

/** "2026-10-15" → "15/10/2026". */
function formatIsoDate(iso: string | null | undefined) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/** Etiqueta corta de la tasa vigente: "BCV 879,12 Bs/$". */
export function useRateLabel() {
  const fx = useFx();
  const src = effectiveSource(fx.rates, fx.rateSource);
  return fx.rate ? `${SHORT_SOURCE[src ?? fx.rateSource]} ${formatRate(fx.rate)}` : null;
}

/** Consulta BCV y paralelo en internet y avisa el resultado. */
export function useRateRefresh() {
  const fx = useFx();
  const toast = useToast();
  return useCallback(async () => {
    try {
      const r = await fx.refreshFromInternet();
      if (!r.bcv && !r.parallel) {
        toast.warning('El servicio de tasas no devolvió valores. Carga la tasa a mano.');
        return;
      }
      toast.success(
        `Tasas actualizadas${r.bcv ? ` · BCV ${formatRate(r.bcv)}` : ''}${r.parallel ? ` · Paralelo ${formatRate(r.parallel)}` : ''}`
      );
    } catch (e) {
      toast.error(`No se pudo actualizar la tasa: ${errorMessage(e)}`);
    }
  }, [fx, toast]);
}

/* ------------------------------------------------------------------ */
/* Editor de tasa                                                      */
/* ------------------------------------------------------------------ */

/** Tasas vigentes, edición manual de la tasa activa y actualización desde internet. */
export function RateEditor({ onDone, autoFocus }: { onDone?: () => void; autoFocus?: boolean }) {
  const fx = useFx();
  const toast = useToast();
  const { confirm } = useConfirm();
  const refresh = useRateRefresh();
  const source = fx.rateSource;
  const rates = fx.rates;
  const inUse = effectiveSource(rates, source);
  const [value, setValue] = useState<number | ''>(() => rates?.[source] ?? fx.rate ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Si llega una tasa nueva (p. ej. desde internet) mientras el editor está abierto, se muestra.
  const current = rates?.[source] ?? null;
  useEffect(() => {
    if (current) setValue(current);
  }, [current]);

  const save = async () => {
    if (!(typeof value === 'number' && value > 0)) {
      setError('Ingresa una tasa mayor a cero.');
      return;
    }
    setError(null);
    const prev = current ?? fx.rate;
    if (prev && Math.abs(value - prev) / prev > 0.25) {
      const pct = Math.round(((value - prev) / prev) * 100);
      const ok = await confirm({
        title: '¿Guardar la nueva tasa?',
        message: `La tasa pasa de ${formatRate(prev)} a ${formatRate(value)} (${pct > 0 ? '+' : ''}${pct}%). Revisa que no falte ni sobre un dígito.`,
        confirmLabel: 'Sí, guardar',
        tone: 'primary'
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const patch: RatesPatch = {};
      patch[source] = value;
      if (source === 'bcv') patch.bcvDate = caracasToday();
      await fx.updateRates(patch);
      toast.success(`Tasa ${SHORT_SOURCE[source]} actualizada: ${formatRate(value)}`);
      onDone?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1" aria-label="Tasas vigentes">
        {SOURCES.map((s) => {
          const v = rates?.[s] ?? null;
          const detail =
            s === 'bcv' && rates?.bcvDate
              ? `Vigente ${formatIsoDate(rates.bcvDate)}`
              : s === 'parallel' && rates?.parallelUpdatedAt
                ? `Act. ${formatRelative(new Date(rates.parallelUpdatedAt))}`
                : s === source
                  ? 'Elegida en configuración'
                  : '';
          const active = inUse === s;
          return (
            <li
              key={s}
              className={cn(
                'flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5',
                active ? 'bg-primary-fixed/35 text-on-primary-fixed-variant' : 'text-on-surface'
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-label-md">
                  {RATE_SOURCE_LABELS[s]}
                  {active && <span className="ml-1.5 rounded-full bg-primary px-1.5 py-px text-[10px] font-bold text-white uppercase">En uso</span>}
                </span>
                {detail && <span className="truncate text-body-sm text-on-surface-variant">{detail}</span>}
              </span>
              <span className="shrink-0 text-label-lg tnum">{v ? formatRate(v) : '—'}</span>
            </li>
          );
        })}
      </ul>

      {fx.stale && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-body-sm text-amber-900">
          <TriangleAlert className="mt-px size-4 shrink-0 text-amber-600" />
          {rates?.bcv ? `La tasa BCV no es la del día${rates.bcvDate ? ` (vigente ${formatIsoDate(rates.bcvDate)})` : ''}.` : 'Todavía no hay tasa BCV registrada.'}
        </p>
      )}

      {fx.canEditRates ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pos-rate-input" className="text-label-md text-slate-700">
              Tasa {RATE_SOURCE_LABELS[source]} (Bs por $1)
            </label>
            <div className="flex items-center gap-2">
              <MoneyInput
                id="pos-rate-input"
                size="md"
                autoFocus={autoFocus}
                data-autofocus={autoFocus || undefined}
                locale={fx.settings.localLocale}
                maxDecimals={4}
                thousands={false}
                suffix="Bs/$"
                value={value}
                onValueChange={(v) => {
                  setValue(v);
                  setError(null);
                }}
                invalid={!!error}
                placeholder="0,00"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void save();
                  }
                }}
              />
              <Button size="md" onClick={() => void save()} loading={saving}>
                Guardar
              </Button>
            </div>
            {error && <p className="text-body-sm text-error">{error}</p>}
          </div>
          <Button variant="secondary" size="sm" icon={RefreshCw} loading={fx.refreshing} onClick={() => void refresh()}>
            Actualizar desde internet (BCV y paralelo)
          </Button>
        </>
      ) : (
        <p className="text-body-sm text-on-surface-variant">Pide a un encargado que actualice la tasa del día.</p>
      )}

      {rates?.updatedAt && (
        <p className="text-body-sm text-on-surface-variant">
          Actualizada {formatRelative(rates.updatedAt)}
          {rates.updatedByName ? ` por ${rates.updatedByName}` : ''}
          {rates.source ? ` · ${rates.source === 'auto' ? 'automática' : 'manual'}` : ''}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chip de la franja de estado                                         */
/* ------------------------------------------------------------------ */

/** Tasa vigente en la franja de estado; con permiso abre el editor. */
export function RateChip() {
  const fx = useFx();
  const label = useRateLabel();
  if (!fx.enabled) return null;

  const tone = !fx.rate ? 'missing' : fx.stale ? 'stale' : 'ok';
  const content = (
    <>
      <ArrowRightLeft className={cn('size-[18px]', tone === 'ok' ? 'text-secondary' : tone === 'stale' ? 'text-amber-600' : 'text-error')} />
      <span className="tnum">{fx.loading ? 'Cargando tasa…' : (label ?? 'Sin tasa de cambio')}</span>
      {tone === 'stale' && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800 uppercase">Vieja</span>}
    </>
  );
  const cls = cn(
    'inline-flex items-center gap-1.5 rounded-md text-label-md transition-colors',
    tone === 'ok' ? 'text-on-surface-variant hover:text-on-surface' : tone === 'stale' ? 'text-amber-800' : 'text-error'
  );

  if (!fx.canEditRates) {
    return (
      <span className={cls} title="Tasa de cambio del día">
        {content}
      </span>
    );
  }

  return (
    <Popover
      align="left"
      panelClassName="w-[min(21rem,calc(100vw-3rem))] p-3"
      trigger={({ open, toggle }) => (
        <button type="button" onClick={toggle} aria-expanded={open} className={cls} title="Ver o actualizar la tasa de cambio">
          {content}
          <PencilLine className="size-3.5 opacity-60" />
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-2">
          <p className="text-label-sm tracking-wider text-on-surface-variant uppercase">Tasa de cambio</p>
          <RateEditor onDone={close} />
        </div>
      )}
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Aviso: sin tasa o tasa vieja                                        */
/* ------------------------------------------------------------------ */

export function RateNotice() {
  const fx = useFx();
  const refresh = useRateRefresh();
  const [open, setOpen] = useState(false);
  if (!fx.enabled || fx.loading) return null;
  const missing = !fx.rate;
  if (!missing && !fx.stale) return null;

  const bcvDate = fx.rates?.bcvDate;
  return (
    <>
      <div
        role={missing ? 'alert' : 'status'}
        className={cn(
          'flex flex-col gap-3 rounded-2xl border p-3 shadow-card sm:flex-row sm:items-center sm:px-4',
          missing ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
        )}
      >
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <div
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-xl',
              missing ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            )}
          >
            {missing ? <CircleAlert className="size-5" /> : <TriangleAlert className="size-5" />}
          </div>
          <div className="min-w-0">
            <p className={cn('text-label-lg', missing ? 'text-red-900' : 'text-amber-900')}>
              {missing ? 'No hay tasa de cambio cargada' : `La tasa BCV no es la del día${bcvDate ? ` (vigente ${formatIsoDate(bcvDate)})` : ''}`}
            </p>
            <p className={cn('text-body-sm', missing ? 'text-red-800' : 'text-amber-800')}>
              {missing
                ? 'Sin tasa no se muestran los precios en Bs ni se puede cobrar en bolívares (efectivo Bs, pago móvil, punto…).'
                : 'Verifica la tasa antes de cobrar en bolívares.'}
              {!fx.canEditRates && ' Pide a un encargado que la actualice.'}
            </p>
          </div>
        </div>
        {fx.canEditRates && (
          <div className="flex shrink-0 flex-wrap gap-2 sm:ml-auto">
            <Button size="sm" variant={missing ? 'primary' : 'secondary'} icon={RefreshCw} loading={fx.refreshing} onClick={() => void refresh()}>
              Actualizar desde internet
            </Button>
            <Button size="sm" variant="secondary" icon={PencilLine} onClick={() => setOpen(true)}>
              {missing ? 'Cargar a mano' : 'Editar'}
            </Button>
          </div>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Tasa de cambio" subtitle="Bolívares por cada dólar para convertir precios y cobros." icon={ArrowRightLeft} size="sm">
        <RateEditor onDone={() => setOpen(false)} autoFocus />
      </Modal>
    </>
  );
}
