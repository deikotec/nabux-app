import { useMemo, useState, type ReactNode } from 'react';
import { limit, orderBy, query } from 'firebase/firestore';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeftRight, ArrowRight, Coins, Lock, Percent, Power, RefreshCw, Scale, SlidersHorizontal, WalletCards } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useFx } from '@/contexts/FxContext';
import { useOnline, useQueryData } from '@/hooks/data';
import { RATE_SOURCE_LABELS } from '@/config/app';
import { ceilTo, effectiveRate, formatRate } from '@/lib/fx';
import { fxSettingsOf, isDualCurrency, paymentMethodsOf } from '@/lib/payments';
import { cn, errorMessage, round2 } from '@/lib/utils';
import { logActivity } from '@/services/activity';
import { updateBusiness } from '@/services/business';
import { refs } from '@/services/refs';
import type { FxHistoryEntry, RateSource } from '@/types';
import { Badge, Button, Card, NumberInput, Segmented, Toggle, useConfirm, useToast } from '@/components/ui';
import { EnableFxModal } from './EnableFxModal';
import { FxHistoryCard } from './FxHistoryCard';
import { FxCalculator, RatesCard } from './FxRatesCard';
import { bcvSeries, LOCAL_ROUNDING_OPTIONS, RATE_SOURCE_HELP, RATE_SOURCES } from './fxHelpers';
import { persist, usePendingChanges, useSyncedForm, type SettingsTabId } from './settingsState';
import { Callout, InsetPanel, RuleToggle, SettingsCard } from './SettingsUI';

interface FxForm {
  rateSource: RateSource;
  autoUpdate: boolean;
  igtfEnabled: boolean;
  igtfRate: number | '';
  localRounding: number;
}

const roundingLabel = (n: number) => (n < 1 ? '0,01 Bs' : `${n} Bs`);

function describeChanges(a: FxForm, b: FxForm): string {
  const out: string[] = [];
  if (a.rateSource !== b.rateSource) out.push(`tasa del POS: ${RATE_SOURCE_LABELS[b.rateSource]}`);
  if (a.autoUpdate !== b.autoUpdate) out.push(b.autoUpdate ? 'actualización automática activada' : 'actualización automática desactivada');
  if (a.igtfEnabled !== b.igtfEnabled || Number(a.igtfRate) !== Number(b.igtfRate)) out.push(b.igtfEnabled ? `IGTF ${b.igtfRate}%` : 'IGTF desactivado');
  if (a.localRounding !== b.localRounding) out.push(`redondeo en Bs: ${roundingLabel(b.localRounding)}`);
  return out.join(', ');
}

export function CurrencyRatesTab({ onNavigate }: { onNavigate: (tab: SettingsTabId) => void }) {
  const { business, businessId, actor } = useActiveBusiness();
  const fx = useFx();
  const toast = useToast();
  const { confirm } = useConfirm();
  const online = useOnline();
  const dual = isDualCurrency(business);

  const source = useMemo<FxForm>(() => {
    const s = fxSettingsOf(business);
    return { rateSource: s.rateSource, autoUpdate: s.autoUpdate, igtfEnabled: s.igtfEnabled, igtfRate: s.igtfRate, localRounding: s.localRounding };
  }, [business]);
  const form = useSyncedForm(source);
  const v = form.values;
  const [saving, setSaving] = useState(false);
  const [enableOpen, setEnableOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  const errors = {
    igtfRate: v.igtfEnabled && (v.igtfRate === '' || v.igtfRate <= 0 || v.igtfRate > 100) ? 'Indica una tasa mayor que 0 y hasta 100 %.' : null
  };
  const valid = !errors.igtfRate;

  const save = async () => {
    if (!valid) {
      toast.error('Revisa los campos marcados.');
      return;
    }
    const clean: FxForm = {
      rateSource: v.rateSource,
      autoUpdate: v.autoUpdate,
      igtfEnabled: v.igtfEnabled,
      igtfRate: v.igtfRate === '' ? Number(form.baseline.igtfRate) || 3 : round2(Number(v.igtfRate)),
      localRounding: v.localRounding
    };
    const changes = describeChanges(form.baseline, clean);
    form.patch(clean);
    setSaving(true);
    try {
      const fxNext = { ...fxSettingsOf(business), ...clean, igtfRate: Number(clean.igtfRate) };
      const synced = await persist(updateBusiness(businessId, { fx: fxNext }), online);
      logActivity(businessId, actor, { type: 'settings_update', message: `Actualizó la configuración bimonetaria${changes ? ` (${changes})` : ''}` });
      if (synced) toast.success('Configuración de moneda y tasas guardada');
      else toast.info('Guardado en este dispositivo. Se sincronizará al recuperar la conexión.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  usePendingChanges({ area: 'moneda y tasas', dirty: form.dirty, saving, canSave: valid, onSave: save, onDiscard: form.reset });

  const disable = async () => {
    const baseActive = paymentMethodsOf(business).filter((m) => m.active && m.currency === 'base');
    const ok = await confirm({
      title: 'Desactivar el modo bimonetario',
      message: (
        <span className="flex flex-col gap-2">
          <span>
            El POS dejará de mostrar montos en bolívares y de ofrecer formas de pago en Bs. Tus precios no cambian y se conserva la configuración (tasas, IGTF,
            redondeo) por si lo reactivas.
          </span>
          {baseActive.length === 0 && (
            <span className="font-semibold text-amber-800">No tienes formas de pago en {business.currency} activas: activa al menos una en Formas de pago.</span>
          )}
          {form.dirty && <span>Se descartarán los cambios sin guardar de esta pestaña.</span>}
        </span>
      ),
      confirmLabel: 'Desactivar',
      tone: 'danger'
    });
    if (!ok) return;
    form.reset();
    setToggling(true);
    try {
      const synced = await persist(updateBusiness(businessId, { fx: { ...fxSettingsOf(business), enabled: false } }), online);
      logActivity(businessId, actor, { type: 'settings_update', message: 'Desactivó el modo bimonetario (USD + Bs)' });
      if (synced) toast.success('Modo bimonetario desactivado');
      else toast.info('Desactivado en este dispositivo. Se sincronizará al recuperar la conexión.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setToggling(false);
    }
  };

  // Historial (solo en modo bimonetario).
  const historyQuery = useMemo(
    () => (dual && businessId ? query(refs.fxHistory(businessId), orderBy('createdAt', 'desc'), limit(60)) : null),
    [businessId, dual]
  );
  const history = useQueryData<FxHistoryEntry>(historyQuery);
  const trend = useMemo(() => bcvSeries(history.data, 30), [history.data]);

  // La tasa que usaría el POS con lo elegido en el formulario (cae a BCV si la fuente no tiene valor).
  const usedSource: RateSource = fx.rates?.[v.rateSource] ? v.rateSource : 'bcv';
  const posRate = effectiveRate(fx.rates, v.rateSource);
  const igtfMethods = paymentMethodsOf(business).filter((m) => m.active && m.igtf && m.currency === 'base');
  const activeMethods = fx.allMethods.filter((m) => m.active && (dual || m.currency === 'base'));
  const saved = fxSettingsOf(business);

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      {/* Interruptor del modo */}
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', dual ? 'bg-primary text-white' : 'bg-surface-container-low text-primary')}>
              <ArrowLeftRight className="size-5" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-headline-sm text-on-surface">Modo bimonetario (USD + Bs)</h2>
                {dual ? (
                  <Badge tone="success" dot>
                    Activo
                  </Badge>
                ) : (
                  <Badge tone="neutral">Desactivado</Badge>
                )}
              </div>
              <p className="text-body-sm text-on-surface-variant">
                {dual
                  ? 'Los precios se guardan en dólares y en el POS se cobra en $ y en Bs a la tasa del día.'
                  : 'Para negocios en Venezuela: precios en dólares y cobro también en bolívares a la tasa del día.'}
              </p>
            </div>
          </div>
          <label className={cn('flex shrink-0 items-center gap-3 self-start rounded-xl bg-surface-container-low px-3 py-2', toggling ? 'cursor-wait' : 'cursor-pointer')}>
            <span className="text-label-md text-on-surface">{dual ? 'Activado' : 'Desactivado'}</span>
            <Toggle checked={dual} disabled={toggling} onChange={(on) => (on ? setEnableOpen(true) : disable())} ariaLabel="Modo bimonetario (USD + Bs)" />
          </label>
        </div>

        {dual ? (
          <>
            <div className="flex flex-wrap gap-2">
              <InfoChip label="Moneda base" value={business.currency} tone={business.currency === 'USD' ? undefined : 'warning'} />
              <InfoChip label="Moneda local" value="VES · Bs." />
              <InfoChip label="Tasa del POS" value={RATE_SOURCE_LABELS[saved.rateSource]} />
              <InfoChip label="Impuesto" value={`${business.taxName || 'IVA'} ${business.taxRate}%`} />
              <InfoChip label="IGTF" value={saved.igtfEnabled ? `${saved.igtfRate}% en divisas` : 'Desactivado'} />
              <button type="button" onClick={() => onNavigate('pagos')} className="group text-left">
                <InfoChip label="Formas de pago" value={`${activeMethods.length} activas`} action />
              </button>
            </div>
            {business.currency !== 'USD' && (
              <Callout tone="warning" title={`Tu moneda base es ${business.currency}`}>
                <span>En Venezuela lo habitual es fijar los precios en dólares (USD). Puedes cambiarla en Impuestos y ticket (no convierte tus precios).</span>
                <Button size="sm" variant="secondary" iconRight={ArrowRight} onClick={() => onNavigate('impuestos')} className="mt-1 self-start">
                  Ir a Impuestos y ticket
                </Button>
              </Callout>
            )}
          </>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Feature icon={Coins} title="Precios en $, cobro en Bs" text="Cada precio se muestra también en bolívares a la tasa del día." />
              <Feature icon={RefreshCw} title="Tasa BCV al día" text="BCV, paralelo o tasa propia, con actualización automática e historial." />
              <Feature icon={WalletCards} title="Pagos mixtos y vuelto" text="Efectivo $, pago móvil, punto, Zelle, USDT… en una misma venta." />
              <Feature icon={Percent} title="IGTF 3 %" text="Se calcula solo sobre la parte pagada en divisas." />
            </ul>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-body-sm text-on-surface-variant">
                {business.fx
                  ? 'Ya lo usaste antes: al reactivarlo se recupera tu configuración de tasas e IGTF.'
                  : 'Te guiamos paso a paso: moneda base, IVA y formas de pago de Venezuela.'}
              </p>
              <Button icon={Power} onClick={() => setEnableOpen(true)} className="sm:self-auto">
                Activar modo bimonetario
              </Button>
            </div>
          </>
        )}
      </Card>

      {dual && (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-7">
              <RatesCard selectedSource={v.rateSource} trend={trend} className="h-full" />
            </div>
            <div className="lg:col-span-5">
              <FxCalculator
                className="h-full"
                rate={posRate}
                source={usedSource}
                rounding={v.localRounding}
                igtfRate={v.igtfEnabled && Number(v.igtfRate) > 0 ? Number(v.igtfRate) : null}
              />
            </div>
          </div>

          {/* Tasa que usa el POS */}
          <SettingsCard
            icon={Scale}
            title="Tasa que usa el POS"
            subtitle="Con esta tasa se convierten los precios a bolívares al cobrar y en el ticket."
            badge={v.rateSource !== form.baseline.rateSource ? <Badge tone="warning">Sin guardar</Badge> : <Badge tone="primary">{RATE_SOURCE_LABELS[v.rateSource]}</Badge>}
          >
            <div role="radiogroup" aria-label="Tasa que usa el POS" className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {RATE_SOURCES.map((src) => {
                const selected = v.rateSource === src;
                const value = fx.rates?.[src] ?? null;
                return (
                  <button
                    key={src}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => form.set('rateSource', src)}
                    className={cn(
                      'flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none',
                      selected ? 'border-primary bg-primary-fixed/15' : 'border-slate-200 bg-white hover:border-slate-300'
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-label-lg text-on-surface">
                        <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border-2', selected ? 'border-primary' : 'border-slate-300')}>
                          {selected && <span className="size-2 rounded-full bg-primary" />}
                        </span>
                        {RATE_SOURCE_LABELS[src]}
                      </span>
                      {src === 'bcv' && (
                        <Badge tone="primary" size="xs">
                          Legal
                        </Badge>
                      )}
                    </span>
                    <span className={cn('text-data-mono tnum', value ? 'text-on-surface' : 'text-slate-400')}>{value ? formatRate(value) : 'Sin valor cargado'}</span>
                    <span className="text-body-sm text-on-surface-variant">{RATE_SOURCE_HELP[src]}</span>
                  </button>
                );
              })}
            </div>
            {v.rateSource !== 'bcv' && (
              <Callout title="La BCV sigue siendo la referencia legal">
                El ticket indica la tasa usada en cada venta. Si la tasa elegida no tiene valor, el POS usa la BCV.
              </Callout>
            )}
          </SettingsCard>

          {/* Opciones */}
          <SettingsCard icon={SlidersHorizontal} iconTone="secondary" title="Opciones de cobro" subtitle="Actualización de tasas, redondeo en bolívares e impuesto a las divisas.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <RuleToggle
                label="Actualizar tasas automáticamente"
                description="Al abrir la app y cada 2 horas se consultan BCV y paralelo en internet (ve.dolarapi.com). La tasa propia siempre es manual."
                checked={v.autoUpdate}
                onChange={(on) => form.set('autoUpdate', on)}
              />
              <InsetPanel
                label="Redondeo de montos en Bs"
                hint={
                  posRate ? (
                    <>
                      Ej.: un cobro de <b className="tnum">{fx.moneyIn(7.49, fx.baseCurrency)}</b> se pide como{' '}
                      <b className="text-primary tnum">{fx.formatLocal(ceilTo(7.49 * posRate, v.localRounding))}</b> (se redondea hacia arriba).
                    </>
                  ) : (
                    'Los montos a cobrar en bolívares se redondean hacia arriba a este múltiplo.'
                  )
                }
              >
                <Segmented
                  options={LOCAL_ROUNDING_OPTIONS.map((n) => ({ value: String(n), label: roundingLabel(n) }))}
                  value={String(v.localRounding)}
                  onChange={(s) => form.set('localRounding', Number(s))}
                  className="w-full [&>button]:flex-1 [&>button]:justify-center"
                />
              </InsetPanel>
              <RuleToggle
                label="Cobrar IGTF"
                description="3 % sobre pagos en divisas: efectivo $, Zelle, USDT. Se suma encima del total y solo sobre la parte pagada en divisas."
                checked={v.igtfEnabled}
                onChange={(on) => form.set('igtfEnabled', on)}
                extra={
                  v.igtfEnabled ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <NumberInput
                          value={v.igtfRate}
                          onValueChange={(n) => form.set('igtfRate', n)}
                          suffix="%"
                          aria-label="Tasa del IGTF"
                          invalid={!!errors.igtfRate}
                          className="w-28 bg-white"
                        />
                        <span className="text-body-sm text-on-surface-variant">{errors.igtfRate ?? 'Tasa vigente: 3 %.'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-body-sm text-on-surface-variant">
                        <span>Aplica a:</span>
                        {igtfMethods.length ? (
                          igtfMethods.map((m) => (
                            <Badge key={m.id} tone="neutral" size="xs">
                              {m.label}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-amber-800">ninguna forma de pago activa</span>
                        )}
                        <Button size="sm" variant="ghost" iconRight={ArrowRight} onClick={() => onNavigate('pagos')} className="h-7 px-2">
                          Elegir
                        </Button>
                      </div>
                    </div>
                  ) : undefined
                }
              />
              <InsetPanel
                label="Moneda local"
                aside={<Lock className="size-4 text-on-surface-variant" aria-label="Fija" />}
                hint="Fija para Venezuela. Los montos se muestran como Bs. 1.234,56 y los vueltos en Bs se calculan con la tasa del POS."
              >
                <div className="flex h-10 items-center justify-between gap-2 rounded-lg bg-white px-3 shadow-card">
                  <span className="truncate text-label-lg text-on-surface">Bolívar digital</span>
                  <span className="shrink-0 text-data-mono text-on-surface-variant tnum">VES · Bs.</span>
                </div>
              </InsetPanel>
            </div>
          </SettingsCard>

          <FxHistoryCard entries={history.data} loading={history.loading} error={history.error} />
        </>
      )}

      {enableOpen && <EnableFxModal onClose={() => setEnableOpen(false)} />}
    </div>
  );
}

function InfoChip({ label, value, tone, action }: { label: string; value: ReactNode; tone?: 'warning'; action?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-body-sm',
        tone === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-surface-container-low text-on-surface-variant',
        action && 'transition-colors group-hover:bg-surface-container'
      )}
    >
      {label}:<b className="font-semibold text-on-surface tnum">{value}</b>
      {action && <ArrowRight className="size-3.5" />}
    </span>
  );
}

function Feature({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <li className="flex items-start gap-3 rounded-xl bg-surface-container-low p-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-card">
        <Icon className="size-4" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-label-md text-on-surface">{title}</span>
        <span className="text-body-sm text-on-surface-variant">{text}</span>
      </div>
    </li>
  );
}
