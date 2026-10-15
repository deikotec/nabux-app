import { useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, Eye, Info, MousePointerClick, Plus, RotateCcw, Trash2, WalletCards } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useOnline } from '@/hooks/data';
import { DEFAULT_PAYMENT_METHODS, PAYMENT_KIND_LABELS, VE_PAYMENT_METHODS } from '@/config/app';
import { fxSettingsOf, isDualCurrency, paymentMethodsOf } from '@/lib/payments';
import { currencySymbol } from '@/lib/format';
import { cn, errorMessage, normalize } from '@/lib/utils';
import { logActivity } from '@/services/activity';
import { updateBusiness } from '@/services/business';
import type { PaymentKind, PaymentMethodConfig } from '@/types';
import { Badge, Button, IconButton, Input, Toggle, useConfirm, useToast } from '@/components/ui';
import { isPredefinedMethod, KIND_ICONS, newMethodId } from './fxHelpers';
import { persist, usePendingChanges, useSyncedForm, type SettingsTabId } from './settingsState';
import { Callout, SettingsCard } from './SettingsUI';

const LABEL_MAX = 30;
const KIND_OPTIONS = (Object.keys(PAYMENT_KIND_LABELS) as PaymentKind[]).map((k) => ({ value: k, label: PAYMENT_KIND_LABELS[k] }));

/** Copia limpia (solo los campos del modelo) para guardar en Firestore. */
function cleanMethod(m: PaymentMethodConfig): PaymentMethodConfig {
  return {
    id: m.id,
    label: m.label.trim(),
    currency: m.currency === 'local' ? 'local' : 'base',
    kind: m.kind,
    igtf: m.currency === 'local' ? false : !!m.igtf,
    requiresReference: !!m.requiresReference,
    allowsChange: !!m.allowsChange,
    active: !!m.active
  };
}

/** Resumen legible de lo que cambió (para la bitácora). */
function describeChanges(before: PaymentMethodConfig[], after: PaymentMethodConfig[]): string {
  const prev = new Map(before.map((m) => [m.id, m]));
  const next = new Map(after.map((m) => [m.id, m]));
  const added = after.filter((m) => !prev.has(m.id)).map((m) => m.label);
  const removed = before.filter((m) => !next.has(m.id)).map((m) => m.label);
  const on: string[] = [];
  const off: string[] = [];
  let edited = 0;
  for (const m of after) {
    const p = prev.get(m.id);
    if (!p) continue;
    if (p.active !== m.active) (m.active ? on : off).push(m.label);
    else if (JSON.stringify(cleanMethod(p)) !== JSON.stringify(cleanMethod(m))) edited++;
  }
  const sameOrder = before.filter((m) => next.has(m.id)).map((m) => m.id).join() === after.filter((m) => prev.has(m.id)).map((m) => m.id).join();
  const parts = [
    added.length ? `agregó ${added.join(', ')}` : null,
    removed.length ? `eliminó ${removed.join(', ')}` : null,
    on.length ? `activó ${on.join(', ')}` : null,
    off.length ? `desactivó ${off.join(', ')}` : null,
    edited ? `editó ${edited}` : null,
    sameOrder ? null : 'cambió el orden'
  ].filter(Boolean);
  const text = parts.join('; ');
  return text.length > 220 ? `${text.slice(0, 217)}…` : text;
}

export function PaymentMethodsTab({ onNavigate }: { onNavigate: (tab: SettingsTabId) => void }) {
  const { business, businessId, actor } = useActiveBusiness();
  const toast = useToast();
  const { confirm, prompt } = useConfirm();
  const online = useOnline();
  const dual = isDualCurrency(business);
  const fx = fxSettingsOf(business);
  const baseCurrency = business.currency;
  const baseSymbol = currencySymbol(business.currency, business.locale);

  const source = useMemo(() => ({ methods: paymentMethodsOf(business).map((m) => ({ ...m })) }), [business]);
  const form = useSyncedForm(source);
  const methods = form.values.methods;
  const [saving, setSaving] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  const setMethods = (next: PaymentMethodConfig[]) => form.set('methods', next);
  const update = (id: string, patch: Partial<PaymentMethodConfig>) => setMethods(methods.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= methods.length) return;
    const next = [...methods];
    [next[index], next[j]] = [next[j], next[index]];
    setMethods(next);
  };

  // Validación
  const usable = (m: PaymentMethodConfig) => m.active && (dual || m.currency === 'base');
  const nameCount = new Map<string, number>();
  for (const m of methods) {
    const k = normalize(m.label);
    if (k) nameCount.set(k, (nameCount.get(k) ?? 0) + 1);
  }
  const rowErrors = new Map<string, string>();
  for (const m of methods) {
    if (!m.label.trim()) rowErrors.set(m.id, 'Escribe un nombre.');
    else if ((nameCount.get(normalize(m.label)) ?? 0) > 1) rowErrors.set(m.id, 'Ya hay otra forma de pago con este nombre.');
  }
  const activeUsable = methods.filter(usable);
  const globalError =
    activeUsable.length === 0
      ? dual
        ? 'Activa al menos una forma de pago.'
        : `Activa al menos una forma de pago en ${baseCurrency}.`
      : null;
  const valid = rowErrors.size === 0 && !globalError;
  const hiddenLocal = !dual ? methods.filter((m) => m.active && m.currency === 'local') : [];

  const save = async () => {
    if (!valid) {
      toast.error(globalError ?? 'Revisa los nombres marcados.');
      return;
    }
    const clean = methods.map(cleanMethod);
    const changes = describeChanges(form.baseline.methods, clean);
    form.set('methods', clean);
    setSaving(true);
    try {
      const synced = await persist(updateBusiness(businessId, { paymentMethods: clean }), online);
      logActivity(businessId, actor, {
        type: 'settings_update',
        message: `Actualizó las formas de pago${changes ? `: ${changes}` : ''} (${clean.filter((m) => m.active).length} activas)`
      });
      if (synced) toast.success('Formas de pago guardadas');
      else toast.info('Guardado en este dispositivo. Se sincronizará al recuperar la conexión.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  usePendingChanges({ area: 'las formas de pago', dirty: form.dirty, saving, canSave: valid, onSave: save, onDiscard: form.reset });

  const add = async () => {
    const name = await prompt({
      title: 'Nueva forma de pago',
      message: 'Ej.: "Transferencia Banesco", "PayPal", "Crédito de la casa". Después eliges su moneda y opciones.',
      inputLabel: 'Nombre',
      placeholder: 'Nombre visible en el POS',
      required: true,
      confirmLabel: 'Agregar',
      tone: 'primary'
    });
    const label = name?.replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX);
    if (!label) return;
    if (methods.some((m) => normalize(m.label) === normalize(label))) {
      toast.error(`Ya existe una forma de pago llamada "${label}".`);
      return;
    }
    const id = newMethodId(methods.map((m) => m.id));
    setMethods([
      ...methods,
      { id, label, currency: dual ? 'local' : 'base', kind: 'other', igtf: false, requiresReference: false, allowsChange: false, active: true }
    ]);
    setFocusId(id);
  };

  const remove = async (m: PaymentMethodConfig) => {
    const ok = await confirm({
      title: `Eliminar "${m.label}"`,
      message: 'Dejará de aparecer en el POS. Las ventas y cortes anteriores conservan el nombre con el que se cobraron.',
      confirmLabel: 'Eliminar',
      tone: 'danger'
    });
    if (ok) setMethods(methods.filter((x) => x.id !== m.id));
  };

  const resetDefaults = async () => {
    const defaults = dual ? VE_PAYMENT_METHODS : DEFAULT_PAYMENT_METHODS;
    const customs = methods.filter((m) => !isPredefinedMethod(m.id));
    const names = defaults
      .filter((m) => m.active)
      .map((m) => m.label)
      .join(', ');
    const ok = await confirm({
      title: 'Restablecer formas de pago',
      message: [
        `Se cargan las predeterminadas${dual ? ' de Venezuela' : ''} (${names}) con su orden y opciones originales.`,
        customs.length ? `Se quitarán tus ${customs.length} formas de pago personalizadas.` : '',
        'No se guarda hasta que pulses "Guardar cambios".'
      ]
        .filter(Boolean)
        .join(' '),
      confirmLabel: 'Restablecer',
      tone: 'danger'
    });
    if (ok) setMethods(defaults.map((m) => ({ ...m })));
  };

  const stats = {
    base: activeUsable.filter((m) => m.currency === 'base').length,
    local: activeUsable.filter((m) => m.currency === 'local').length,
    igtf: activeUsable.filter((m) => m.igtf && m.currency === 'base').length,
    ref: activeUsable.filter((m) => m.requiresReference).length
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      <div className="flex flex-col gap-5 lg:col-span-8 lg:gap-6">
        <SettingsCard
          icon={WalletCards}
          title="Formas de pago"
          subtitle="Los botones de cobro del POS aparecen en este orden."
          badge={
            <Badge tone={globalError ? 'warning' : 'primary'}>
              {activeUsable.length} en el POS
            </Badge>
          }
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-body-sm text-on-surface-variant">
              {dual
                ? 'Moneda $ = divisas (base). Moneda Bs = bolívares a la tasa del día.'
                : `Todas se cobran en ${baseCurrency}. Activa el modo bimonetario para cobrar también en bolívares.`}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={resetDefaults}>
                Restablecer
              </Button>
              <Button size="sm" icon={Plus} onClick={add}>
                Agregar
              </Button>
            </div>
          </div>

          {globalError && (
            <Callout tone="warning" title="El POS necesita al menos una forma de pago">
              {globalError}
            </Callout>
          )}
          {hiddenLocal.length > 0 && (
            <Callout title="Formas de pago en bolívares ocultas">
              <span>
                {hiddenLocal.map((m) => m.label).join(', ')} {hiddenLocal.length === 1 ? 'no se muestra' : 'no se muestran'} en el POS porque el modo bimonetario está
                desactivado.
              </span>
              <Button size="sm" variant="secondary" iconRight={ArrowRight} onClick={() => onNavigate('moneda')} className="mt-1 self-start">
                Ir a Moneda y tasas
              </Button>
            </Callout>
          )}

          <ol className="flex flex-col gap-2.5">
            {methods.map((m, i) => (
              <MethodRow
                key={m.id}
                method={m}
                index={i}
                count={methods.length}
                dual={dual}
                igtfOn={fx.igtfEnabled}
                baseCurrency={baseCurrency}
                baseSymbol={baseSymbol}
                error={rowErrors.get(m.id) ?? null}
                autoFocus={focusId === m.id}
                onChange={(patch) => update(m.id, patch)}
                onMove={(dir) => move(i, dir)}
                onRemove={isPredefinedMethod(m.id) ? undefined : () => remove(m)}
              />
            ))}
          </ol>
        </SettingsCard>
      </div>

      <div className="flex flex-col gap-5 lg:col-span-4 lg:gap-6">
        <div className="flex flex-col gap-5 lg:sticky lg:top-20 lg:gap-6">
          <SettingsCard icon={Eye} iconTone="secondary" title="Así se ven en el POS" subtitle="Vista previa con los cambios sin guardar.">
            {activeUsable.length ? (
              <div className="grid grid-cols-2 gap-2">
                {activeUsable.map((m) => {
                  const Icon = KIND_ICONS[m.kind] ?? WalletCards;
                  return (
                    <div key={m.id} className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-card">
                      <div className="flex items-center justify-between gap-1">
                        <Icon className="size-4 shrink-0 text-primary" />
                        <span
                          className={cn(
                            'rounded px-1.5 text-[10px] font-bold tnum',
                            m.currency === 'local' ? 'bg-secondary-fixed/60 text-on-secondary-fixed-variant' : 'bg-primary-fixed/40 text-on-primary-fixed-variant'
                          )}
                        >
                          {m.currency === 'local' ? 'Bs' : baseSymbol}
                        </span>
                      </div>
                      <span className="truncate text-label-md text-on-surface" title={m.label}>
                        {m.label || 'Sin nombre'}
                      </span>
                      <span className="flex flex-wrap gap-1 text-[10px] text-on-surface-variant">
                        {dual && fx.igtfEnabled && m.igtf && m.currency === 'base' && <span>+IGTF</span>}
                        {m.requiresReference && <span>Ref.</span>}
                        {m.allowsChange && <span>Vuelto</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-body-sm text-on-surface-variant">No hay formas de pago activas.</p>
            )}
            <dl className="grid grid-cols-2 gap-2 text-body-sm">
              <Stat label="Activas" value={activeUsable.length} />
              {dual ? (
                <>
                  <Stat label="En $" value={stats.base} />
                  <Stat label="En Bs" value={stats.local} />
                  <Stat label="Con IGTF" value={fx.igtfEnabled ? stats.igtf : 0} muted={!fx.igtfEnabled} />
                </>
              ) : (
                <Stat label="Piden referencia" value={stats.ref} />
              )}
            </dl>
          </SettingsCard>

          <Callout icon={Info} title="¿Por qué no puedo eliminar algunas?">
            Las formas de pago predeterminadas solo se desactivan: así tus ventas y cortes anteriores siguen agrupándose bien. Las personalizadas sí se pueden eliminar.
          </Callout>
          {dual && !fx.igtfEnabled && (
            <Callout tone="warning" title="IGTF desactivado">
              <span>Aunque marques "IGTF" en una forma de pago, no se cobrará hasta activarlo en Moneda y tasas.</span>
              <Button size="sm" variant="secondary" iconRight={ArrowRight} onClick={() => onNavigate('moneda')} className="mt-1 self-start">
                Ir a Moneda y tasas
              </Button>
            </Callout>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-low px-3 py-2">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className={cn('text-label-lg tnum', muted ? 'text-slate-400' : 'text-on-surface')}>{value}</dd>
    </div>
  );
}

function MethodRow({
  method: m,
  index,
  count,
  dual,
  igtfOn,
  baseCurrency,
  baseSymbol,
  error,
  autoFocus,
  onChange,
  onMove,
  onRemove
}: {
  method: PaymentMethodConfig;
  index: number;
  count: number;
  dual: boolean;
  igtfOn: boolean;
  baseCurrency: string;
  baseSymbol: string;
  error: string | null;
  autoFocus: boolean;
  onChange: (patch: Partial<PaymentMethodConfig>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove?: () => void;
}) {
  const Icon = KIND_ICONS[m.kind] ?? WalletCards;
  const predefined = isPredefinedMethod(m.id);
  const hiddenLocal = !dual && m.currency === 'local';
  const inputId = `pm-${m.id}`;

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-3 transition-colors sm:p-4',
        error ? 'border-red-200 bg-red-50/30' : m.active ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-surface-container-low/60'
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex shrink-0 flex-col">
          <IconButton icon={ArrowUp} label={`Subir ${m.label}`} size="icon-sm" className="h-6" disabled={index === 0} onClick={() => onMove(-1)} />
          <IconButton icon={ArrowDown} label={`Bajar ${m.label}`} size="icon-sm" className="h-6" disabled={index === count - 1} onClick={() => onMove(1)} />
        </div>
        <div className={cn('hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex', m.active ? 'bg-primary/10 text-primary' : 'bg-white text-slate-400')}>
          <Icon className="size-5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Input
            id={inputId}
            value={m.label}
            autoFocus={autoFocus}
            maxLength={LABEL_MAX}
            onChange={(e) => onChange({ label: e.target.value })}
            invalid={!!error}
            aria-label={`Nombre de la forma de pago ${index + 1}`}
            className={cn('font-semibold', !m.active && 'text-on-surface-variant')}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <span className="hidden sm:inline-flex">
            <OriginBadge predefined={predefined} />
          </span>
          <Toggle checked={m.active} onChange={(on) => onChange({ active: on })} ariaLabel={`${m.active ? 'Desactivar' : 'Activar'} ${m.label || 'forma de pago'}`} />
          {onRemove ? (
            <IconButton icon={Trash2} label={`Eliminar ${m.label}`} size="icon-sm" onClick={onRemove} className="text-red-700 hover:bg-red-50 hover:text-red-800" />
          ) : (
            <span className="hidden w-8 sm:block" aria-hidden />
          )}
        </div>
      </div>

      {error && <p className="-mt-1 text-body-sm text-error">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-label-sm text-on-surface-variant tnum">#{index + 1}</span>
        {dual ? (
          <div className="inline-flex rounded-lg bg-surface-container p-0.5" role="radiogroup" aria-label="Moneda">
            {(['base', 'local'] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={m.currency === c}
                onClick={() => onChange(c === 'local' ? { currency: c, igtf: false } : { currency: c })}
                className={cn(
                  'rounded-md px-2.5 py-1 text-label-md transition-colors',
                  m.currency === c ? 'bg-white text-on-surface shadow-card' : 'text-on-surface-variant hover:text-on-surface'
                )}
              >
                {c === 'base' ? `${baseSymbol} ${baseCurrency}` : 'Bs (local)'}
              </button>
            ))}
          </div>
        ) : hiddenLocal ? (
          <>
            <Badge tone="warning">Bs · requiere modo bimonetario</Badge>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onChange({ currency: 'base' })}>
              Cobrar en {baseCurrency}
            </Button>
          </>
        ) : (
          <Badge tone="neutral">{baseCurrency}</Badge>
        )}
        <select
          value={m.kind}
          onChange={(e) => onChange({ kind: e.target.value as PaymentKind })}
          aria-label="Tipo de forma de pago"
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-body-sm text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none"
        >
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {dual && (
          <Chip
            checked={m.currency === 'base' && m.igtf}
            disabled={m.currency === 'local'}
            onChange={(on) => onChange({ igtf: on })}
            label="IGTF"
            ariaLabel="Aplica IGTF"
            title={
              m.currency === 'local'
                ? 'El IGTF solo aplica a pagos en divisas'
                : igtfOn
                  ? 'Aplica IGTF: se suma sobre lo pagado con esta forma'
                  : 'Aplica IGTF (desactivado en Moneda y tasas)'
            }
          />
        )}
        <Chip
          checked={m.requiresReference}
          onChange={(on) => onChange({ requiresReference: on })}
          label="Pide ref."
          ariaLabel="Pide referencia"
          title="Pide referencia: el cajero debe escribir el número de referencia o confirmación"
        />
        <Chip
          checked={m.allowsChange}
          onChange={(on) => onChange({ allowsChange: on })}
          label="Da vuelto"
          ariaLabel="Permite dar vuelto"
          title="Permite dar vuelto: se puede usar para entregar el cambio"
        />
        <span className="ml-auto sm:hidden">
          <OriginBadge predefined={predefined} />
        </span>
      </div>
    </li>
  );
}

function OriginBadge({ predefined }: { predefined: boolean }) {
  return predefined ? (
    <Badge tone="neutral" size="xs">
      Predeterminada
    </Badge>
  ) : (
    <Badge tone="violet" size="xs" icon={MousePointerClick}>
      Personalizada
    </Badge>
  );
}

/** Opción tipo píldora con casilla (accesible como botón conmutable). */
function Chip({
  checked,
  onChange,
  label,
  ariaLabel,
  title,
  disabled
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-label-md transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        checked ? 'border-primary/40 bg-primary-fixed/25 text-on-primary-fixed-variant' : 'border-slate-200 bg-white text-on-surface-variant hover:border-slate-300'
      )}
    >
      <span className={cn('flex size-3.5 items-center justify-center rounded-sm border', checked ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white')}>
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}
