import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownUp, Bot, Calculator, Check, CloudDownload, Pencil, RefreshCw, TriangleAlert, User, WifiOff } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useFx } from '@/contexts/FxContext';
import { useOnline } from '@/hooks/data';
import { RATE_SOURCE_LABELS } from '@/config/app';
import { formatDateTime, formatRelative } from '@/lib/format';
import { caracasToday, effectiveRate, formatRate, roundTo } from '@/lib/fx';
import { cn, errorMessage, round2 } from '@/lib/utils';
import { logActivity } from '@/services/activity';
import type { RatesPatch } from '@/services/fx';
import type { RateSource } from '@/types';
import { Sparkline } from '@/components/charts';
import { Badge, Button, Field, Input, NumberInput, Skeleton, useConfirm, useToast } from '@/components/ui';
import { formatIsoDay, RATE_PHRASE, RATE_SHORT_LABELS, RATE_SOURCES, rateNumber, type RatePoint } from './fxHelpers';
import { persist } from './settingsState';
import { Callout, SettingsCard } from './SettingsUI';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Mensaje claro para fallas al consultar las tasas en internet. */
function fetchErrorMessage(e: unknown): string {
  if (e instanceof TypeError) return 'No se pudo conectar con el servicio de tasas (ve.dolarapi.com).';
  return errorMessage(e);
}

/**
 * Tasas vigentes (BCV, paralelo y propia). Se guardan al instante en businesses/{bid}/meta/fx
 * mediante useFx(): no pasan por la barra de "cambios sin guardar".
 */
export function RatesCard({ selectedSource, trend, className }: { selectedSource: RateSource; trend: RatePoint[]; className?: string }) {
  const { businessId, actor } = useActiveBusiness();
  const fx = useFx();
  const toast = useToast();
  const { confirm } = useConfirm();
  const online = useOnline();
  const rates = fx.rates;
  const canEdit = fx.canEditRates;

  // Si la fuente elegida no tiene valor, el POS cae a la BCV (ver effectiveRate).
  const usedSource: RateSource = rates?.[selectedSource] ? selectedSource : 'bcv';
  const posRate = effectiveRate(rates, selectedSource);

  const sparkData = useMemo(() => {
    const pts = trend.slice(-14).map((p) => p.value);
    if (pts.length < 2) return null;
    const min = Math.min(...pts);
    return pts.map((v) => v - min);
  }, [trend]);

  const refresh = async () => {
    if (!online) {
      toast.error('Sin conexión a internet. Escribe la tasa a mano o inténtalo más tarde.');
      return;
    }
    const before = fx.rates;
    try {
      const f = await fx.refreshFromInternet();
      if (!f.bcv && !f.parallel) {
        toast.warning('El servicio de tasas no devolvió valores. Escríbelas a mano.');
        return;
      }
      const parts = [f.bcv ? `BCV ${formatRate(f.bcv)}` : null, f.parallel ? `Paralelo ${formatRate(f.parallel)}` : null].filter(Boolean).join(' · ');
      const changed =
        (!!f.bcv && f.bcv !== before?.bcv) || (!!f.parallel && f.parallel !== before?.parallel) || (!!f.bcvDate && f.bcvDate !== before?.bcvDate);
      if (changed) {
        logActivity(businessId, actor, { type: 'settings_update', message: `Actualizó las tasas desde internet (${parts})` });
        toast.success(`Tasas actualizadas: ${parts}${f.bcvDate ? ` (BCV vigente desde ${formatIsoDay(f.bcvDate)})` : ''}`);
      } else {
        toast.info(`Las tasas ya estaban al día: ${parts}`);
      }
    } catch (e) {
      toast.error(`${fetchErrorMessage(e)} Puedes escribir la tasa a mano.`);
    }
  };

  const saveRate = async (source: RateSource, value: number | null, bcvDate?: string) => {
    const prev = rates?.[source] ?? null;
    if (value && prev && Math.abs(value / prev - 1) > 0.25) {
      const pct = ((value / prev - 1) * 100).toFixed(1).replace('.', ',');
      const ok = await confirm({
        title: '¿Seguro que la tasa es correcta?',
        message: `${capitalize(RATE_PHRASE[source])} pasaría de ${formatRate(prev)} a ${formatRate(value)} (${value > prev ? '+' : ''}${pct} %). Revisa que no falte o sobre un dígito.`,
        confirmLabel: 'Sí, guardar'
      });
      if (!ok) return false;
    }
    const patch: RatesPatch = {};
    patch[source] = value;
    if (source === 'bcv' && bcvDate) patch.bcvDate = bcvDate;
    try {
      const synced = await persist(fx.updateRates(patch), online);
      const label = RATE_SOURCE_LABELS[source];
      if (!synced) toast.info(`Guardaste ${RATE_PHRASE[source]} en este dispositivo. Se sincronizará al reconectar.`);
      else toast.success(value ? `Tasa actualizada · ${label}: ${formatRate(value)}` : `Se quitó ${RATE_PHRASE[source]}`);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    }
  };

  const clearCustom = async () => {
    const ok = await confirm({
      title: 'Quitar la tasa propia',
      message:
        selectedSource === 'custom'
          ? 'El POS está configurado con la tasa propia; sin valor usará la BCV hasta que cargues otra.'
          : 'La tasa propia quedará vacía. Puedes cargarla de nuevo cuando quieras.',
      confirmLabel: 'Quitar tasa',
      tone: 'danger'
    });
    if (ok) await saveRate('custom', null);
  };

  const meta: Record<RateSource, ReactNode> = {
    bcv: rates?.bcvDate ? (
      <span className={cn(fx.stale && 'font-semibold text-amber-700')}>
        Vigente desde {formatIsoDay(rates.bcvDate)}
        {fx.stale ? ' · desactualizada' : ''}
      </span>
    ) : (
      'Sin fecha de vigencia'
    ),
    parallel: rates?.parallelUpdatedAt ? (
      <span title={formatDateTime(new Date(rates.parallelUpdatedAt))}>Publicada {formatRelative(new Date(rates.parallelUpdatedAt))}</span>
    ) : (
      'Promedio del mercado, desde internet'
    ),
    custom: rates?.custom ? 'Definida por tu negocio' : 'Sin cargar · opcional'
  };

  const updatedAuto = rates?.source === 'auto';

  return (
    <SettingsCard
      icon={CloudDownload}
      title="Tasas vigentes"
      subtitle="Bolívares por dólar. Se guardan al instante para todas las cajas."
      className={className}
      badge={posRate ? <Badge tone="primary">POS: {formatRate(posRate)}</Badge> : <Badge tone="warning">Sin tasa</Badge>}
    >
      <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-card">
            {updatedAuto ? <Bot className="size-4" /> : <User className="size-4" />}
          </div>
          {rates?.updatedAt ? (
            <div className="flex min-w-0 flex-col text-body-sm text-on-surface-variant">
              <span>
                Última actualización{' '}
                <b className="font-semibold text-on-surface" title={formatDateTime(rates.updatedAt)}>
                  {formatRelative(rates.updatedAt)}
                </b>
                {rates.updatedByName ? (
                  <>
                    {' '}
                    por <b className="font-semibold text-on-surface">{rates.updatedByName}</b>
                  </>
                ) : null}
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <Badge tone={updatedAuto ? 'info' : 'neutral'} size="xs">
                  {updatedAuto ? 'Automática' : 'Manual'}
                </Badge>
                {updatedAuto ? 'Consultada en internet' : 'Cargada a mano'}
              </span>
            </div>
          ) : (
            <span className="text-body-sm text-on-surface-variant">{fx.loading ? 'Cargando tasas…' : 'Aún no se ha registrado ninguna tasa.'}</span>
          )}
        </div>
        {canEdit && (
          <Button
            size="sm"
            variant="secondary"
            icon={online ? RefreshCw : WifiOff}
            loading={fx.refreshing}
            onClick={refresh}
            disabled={!online}
            title={online ? 'Consulta BCV y paralelo en ve.dolarapi.com' : 'Necesitas conexión a internet'}
            className="sm:self-center"
          >
            Actualizar desde internet
          </Button>
        )}
      </div>

      {!fx.loading && !posRate ? (
        <Callout tone="warning" title="Falta la tasa del día">
          Sin tasa, el POS no puede mostrar ni cobrar montos en Bs. {canEdit ? 'Actualízala desde internet o escribe la BCV a mano.' : 'Pide a un encargado que la cargue.'}
        </Callout>
      ) : !fx.loading && !rates?.bcv ? (
        <Callout tone="warning" title="No hay tasa BCV cargada">
          La BCV es la tasa legal para facturar y la que usa el POS cuando falta la elegida.
        </Callout>
      ) : fx.stale ? (
        <Callout tone="warning" title="La tasa BCV está desactualizada">
          Está vigente desde el {formatIsoDay(rates?.bcvDate)}. El BCV publica en días hábiles; actualízala para cobrar con la tasa correcta.
        </Callout>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {RATE_SOURCES.map((source) =>
          fx.loading ? (
            <Skeleton key={source} className="h-36 rounded-xl" />
          ) : (
            <RateTile
              key={source}
              source={source}
              value={rates?.[source] ?? null}
              inUse={usedSource === source && !!rates?.[source]}
              selectedEmpty={selectedSource === source && !rates?.[source]}
              meta={meta[source]}
              trend={source === 'bcv' ? sparkData : null}
              editable={canEdit}
              onSave={(v, date) => saveRate(source, v, date)}
              onClear={source === 'custom' && rates?.custom ? clearCustom : undefined}
            />
          )
        )}
      </div>
    </SettingsCard>
  );
}

function RateTile({
  source,
  value,
  inUse,
  selectedEmpty,
  meta,
  trend,
  editable,
  onSave,
  onClear
}: {
  source: RateSource;
  value: number | null;
  inUse: boolean;
  selectedEmpty: boolean;
  meta: ReactNode;
  trend: number[] | null;
  editable: boolean;
  onSave: (value: number, bcvDate?: string) => Promise<boolean>;
  onClear?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number | ''>('');
  const [date, setDate] = useState(caracasToday);
  const [busy, setBusy] = useState(false);
  const invalid = draft === '' || draft <= 0;

  const start = () => {
    setDraft(value ?? '');
    setDate(caracasToday());
    setEditing(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid || busy) return;
    setBusy(true);
    const ok = await onSave(Number(draft), source === 'bcv' ? date : undefined);
    setBusy(false);
    if (ok) setEditing(false);
  };

  const inputId = `rate-${source}`;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2.5 rounded-xl border p-4 transition-colors',
        inUse ? 'border-primary/40 bg-primary-fixed/10' : 'border-slate-200 bg-white'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-label-md tracking-wider text-on-surface-variant uppercase">{RATE_SHORT_LABELS[source]}</span>
        {inUse ? (
          <Badge tone="primary" size="xs" dot>
            En uso
          </Badge>
        ) : selectedEmpty ? (
          <Badge tone="warning" size="xs">
            Elegida · sin valor
          </Badge>
        ) : null}
      </div>

      {editing ? (
        <form onSubmit={submit} className="flex flex-col gap-2" onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}>
          <NumberInput
            id={inputId}
            autoFocus
            value={draft}
            onValueChange={setDraft}
            suffix="Bs/$"
            aria-label={`Tasa ${RATE_SOURCE_LABELS[source]} en bolívares por dólar`}
            invalid={draft !== '' && draft <= 0}
          />
          {source === 'bcv' && (
            <label className="flex flex-col gap-1 text-body-sm text-on-surface-variant">
              Vigente desde
              <Input type="date" inputSize="sm" value={date} max={caracasToday()} onChange={(e) => setDate(e.target.value || caracasToday())} />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit" icon={Check} loading={busy} disabled={invalid}>
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className={cn('truncate text-headline-md tnum', value ? 'text-on-surface' : 'text-slate-400')}>{rateNumber(value)}</span>
            {value ? <span className="shrink-0 text-body-sm text-on-surface-variant">Bs/$</span> : null}
          </div>
          {trend && (
            <div title="Tendencia de los últimos días" aria-hidden>
              <Sparkline data={trend} className="h-7 w-full" />
            </div>
          )}
          <div className="text-body-sm text-on-surface-variant">{meta}</div>
          {selectedEmpty && source !== 'bcv' && (
            <p className="flex items-start gap-1.5 text-body-sm text-amber-800">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              Mientras no la cargues, el POS usa la BCV.
            </p>
          )}
          {editable && (
            <div className="mt-auto flex flex-wrap gap-2">
              <Button size="sm" variant={value ? 'soft' : 'tonal'} icon={Pencil} onClick={start}>
                {value ? 'Editar' : 'Cargar tasa'}
              </Button>
              {onClear && (
                <Button size="sm" variant="ghost" onClick={onClear}>
                  Quitar
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const QUICK_AMOUNTS = [1, 5, 10, 20, 50, 100];

/** Conversión rápida $ ⇄ Bs con la tasa que usará el POS. */
export function FxCalculator({
  rate,
  source,
  rounding,
  igtfRate,
  className
}: {
  rate: number | null;
  /** Fuente realmente usada (si la elegida no tiene valor, BCV). */
  source: RateSource;
  rounding: number;
  /** % de IGTF si está activo; null si no aplica. */
  igtfRate: number | null;
  className?: string;
}) {
  const fx = useFx();
  const [calc, setCalc] = useState<{ side: 'usd' | 'ves'; value: number | '' }>({ side: 'usd', value: 10 });

  const usd: number | '' = calc.side === 'usd' ? calc.value : calc.value === '' || !rate ? '' : round2(calc.value / rate);
  const ves: number | '' = calc.side === 'ves' ? calc.value : calc.value === '' || !rate ? '' : roundTo(calc.value * rate, rounding);
  const usdNum = Number(usd) || 0;
  const base = (n: number) => fx.moneyIn(n, fx.baseCurrency);

  return (
    <SettingsCard
      icon={Calculator}
      iconTone="secondary"
      title="Calculadora rápida"
      subtitle={rate ? `Con la tasa ${RATE_SOURCE_LABELS[source]}: ${formatRate(rate)}` : 'Carga una tasa para convertir montos.'}
      className={className}
    >
      <div className="flex flex-col gap-1">
        <Field label="Dólares" htmlFor="fx-calc-usd">
          <NumberInput
            id="fx-calc-usd"
            prefix="$"
            inputSize="lg"
            value={usd}
            disabled={!rate}
            onValueChange={(n) => setCalc({ side: 'usd', value: n })}
          />
        </Field>
        <div className="flex justify-center py-0.5 text-on-surface-variant" aria-hidden>
          <ArrowDownUp className="size-4" />
        </div>
        <Field label="Bolívares" htmlFor="fx-calc-ves">
          <NumberInput
            id="fx-calc-ves"
            prefix="Bs."
            inputSize="lg"
            value={ves}
            disabled={!rate}
            onValueChange={(n) => setCalc({ side: 'ves', value: n })}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_AMOUNTS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={!rate}
            onClick={() => setCalc({ side: 'usd', value: n })}
            className={cn(
              'rounded-full border px-2.5 py-1 text-label-md tnum transition-colors disabled:opacity-50',
              calc.side === 'usd' && calc.value === n
                ? 'border-primary bg-primary text-white'
                : 'border-slate-200 bg-white text-on-surface-variant hover:border-slate-300 hover:text-on-surface'
            )}
          >
            ${n}
          </button>
        ))}
      </div>
      {rate && igtfRate && usdNum > 0 ? (
        <div className="flex flex-col gap-0.5 rounded-xl bg-surface-container-low p-3 text-body-sm text-on-surface-variant">
          <span>
            Pagado en divisas (efectivo $, Zelle, USDT) con IGTF {igtfRate} %:{' '}
            <b className="text-on-surface tnum">{base(round2(usdNum * (1 + igtfRate / 100)))}</b>
          </span>
          <span>
            Pagado en bolívares: <b className="text-on-surface tnum">{fx.formatLocal(Number(ves) || 0)}</b> (sin IGTF)
          </span>
        </div>
      ) : null}
    </SettingsCard>
  );
}
