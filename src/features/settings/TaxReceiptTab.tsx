import { useMemo, useState } from 'react';
import { ArrowLeftRight, ArrowRight, Coins, Eye, Info, ReceiptText, Sparkles, Store } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useFx } from '@/contexts/FxContext';
import { useOnline } from '@/hooks/data';
import { CURRENCIES, currencyOptionBase, RATE_SOURCE_LABELS } from '@/config/app';
import { currencySymbol, formatMoney } from '@/lib/format';
import { effectiveRate, formatRate } from '@/lib/fx';
import { fxSettingsOf, isDualCurrency, paymentMethodsOf } from '@/lib/payments';
import { errorMessage } from '@/lib/utils';
import { logActivity } from '@/services/activity';
import { updateBusiness, type BusinessPatch } from '@/services/business';
import type { Business, FxSettings } from '@/types';
import { Receipt } from '@/components/receipt/Receipt';
import { Badge, Button, Field, Input, NumberInput, Select, Textarea, Toggle, useConfirm, useToast } from '@/components/ui';
import { enabledFxSettings, enableFxPatch, hasLocalMethods, VE_OPTION } from './fxHelpers';
import { EXAMPLE_RATE, sampleDualCurrencySale, sampleSingleCurrencySale } from './receiptSample';
import { persist, usePendingChanges, useSyncedForm, type SettingsTabId } from './settingsState';
import { Callout, SettingsCard } from './SettingsUI';

const FOOTER_MAX = 300;

/** Prefijo para la moneda actual cuando no está en el catálogo como opción de una sola moneda. */
const CURRENT_PREFIX = 'actual:';

/**
 * Opción del selector de moneda para un negocio: "VES" = Venezuela bimonetario (base USD);
 * el código ISO si está en el catálogo; si no, "actual:XXX" (evita confundir, p. ej., un negocio
 * antiguo de una sola moneda en VES con la opción bimonetaria).
 */
function currencyOptionOf(business: Pick<Business, 'currency' | 'fx'>): string {
  if (isDualCurrency(business)) return VE_OPTION.code;
  return CURRENCIES.some((c) => !c.baseCurrency && c.code === business.currency) ? business.currency : `${CURRENT_PREFIX}${business.currency}`;
}

export function TaxReceiptTab({ onNavigate }: { onNavigate: (tab: SettingsTabId) => void }) {
  const { business, businessId, actor } = useActiveBusiness();
  const fx = useFx();
  const toast = useToast();
  const { confirm } = useConfirm();
  const online = useOnline();
  const dual = isDualCurrency(business);

  const source = useMemo(
    () => ({
      option: currencyOptionOf(business),
      currency: business.currency,
      locale: business.locale,
      taxName: business.taxName ?? 'IVA',
      taxRate: (Number(business.taxRate) || 0) as number | '',
      pricesIncludeTax: business.pricesIncludeTax !== false,
      receiptFooter: business.receiptFooter ?? ''
    }),
    [business]
  );
  const form = useSyncedForm(source);
  const v = form.values;
  const [saving, setSaving] = useState(false);

  const baselineOption = form.baseline.option;
  const currencyOptions = useMemo(() => {
    const list = CURRENCIES.map((c) => ({ value: c.code, label: c.label }));
    // Moneda actual fuera del catálogo (o "VES" de una sola moneda): se conserva como opción propia.
    if (baselineOption.startsWith(CURRENT_PREFIX)) {
      list.unshift({ value: baselineOption, label: `${baselineOption.slice(CURRENT_PREFIX.length)} (moneda actual, una sola moneda)` });
    }
    return list;
  }, [baselineOption]);

  const preset = CURRENCIES.find((c) => c.code === v.option);
  const targetDual = !!preset?.baseCurrency;
  const enabling = targetDual && !dual;
  const disabling = !targetDual && dual;
  const optionChanged = v.option !== form.baseline.option;
  const currencyChanged = v.currency !== form.baseline.currency;
  // Al cambiar de moneda sugerimos el impuesto habitual de ese país (sin aplicarlo solo).
  const presetDiffers = optionChanged && !!preset && (preset.taxName !== v.taxName.trim() || preset.taxRate !== v.taxRate);

  const errors = {
    taxName: !v.taxName.trim() ? 'Escribe el nombre del impuesto (ej. IVA).' : null,
    taxRate: v.taxRate === '' ? 'Indica la tasa (0 si no aplica).' : v.taxRate < 0 || v.taxRate > 100 ? 'La tasa debe estar entre 0 y 100.' : null
  };
  const valid = !errors.taxName && !errors.taxRate;

  const save = async () => {
    if (!valid) {
      toast.error('Revisa los campos marcados.');
      return;
    }
    const clean = {
      currency: v.currency,
      locale: v.locale,
      taxName: v.taxName.trim(),
      taxRate: Number(v.taxRate),
      pricesIncludeTax: v.pricesIncludeTax,
      receiptFooter: v.receiptFooter.trim()
    };
    let patch: BusinessPatch = clean;
    let modeNote = '';
    if (enabling) {
      const ok = await confirm({
        title: 'Activar el modo bimonetario',
        message: [
          'Tus precios quedarán en dólares (USD) y en el POS se cobrará también en bolívares a la tasa del día.',
          currencyChanged
            ? `No se convierten los precios actuales: ${formatMoney(25, form.baseline.currency, form.baseline.locale)} (${form.baseline.currency}) pasa a ser ${formatMoney(25, clean.currency, clean.locale)} (${clean.currency}).`
            : '',
          hasLocalMethods(business) ? '' : 'Se cargan las formas de pago de Venezuela (pago móvil, punto, Zelle…).',
          'Después revisa la tasa del día en Moneda y tasas.'
        ]
          .filter(Boolean)
          .join(' '),
        confirmLabel: 'Guardar y activar',
        tone: 'primary'
      });
      if (!ok) return;
      patch = { ...enableFxPatch(business, { useVeMethods: !hasLocalMethods(business) }), ...clean };
      modeNote = ' y activó el modo bimonetario (USD + Bs)';
    } else if (disabling) {
      const ok = await confirm({
        title: 'Desactivar el modo bimonetario',
        message: 'El POS dejará de mostrar montos y formas de pago en bolívares. Tus precios no cambian y la configuración de tasas e IGTF se conserva.',
        confirmLabel: 'Guardar y desactivar',
        tone: 'danger'
      });
      if (!ok) return;
      patch = { ...clean, fx: { ...fxSettingsOf(business), enabled: false } };
      modeNote = ' y desactivó el modo bimonetario';
    }
    form.patch(clean);
    setSaving(true);
    try {
      const synced = await persist(updateBusiness(businessId, patch), online);
      logActivity(businessId, actor, {
        type: 'settings_update',
        message: `Actualizó impuestos y ticket (${clean.currency}, ${clean.taxName} ${clean.taxRate}%)${modeNote}`
      });
      if (!synced) toast.info('Guardado en este dispositivo. Se sincronizará al recuperar la conexión.');
      else if (enabling) toast.success('Guardado. Modo bimonetario activado: revisa la tasa en Moneda y tasas.');
      else toast.success('Impuestos y ticket guardados');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  usePendingChanges({ area: 'impuestos y ticket', dirty: form.dirty, saving, canSave: valid, onSave: save, onDiscard: form.reset });

  // Vista previa: venta de ejemplo con los valores del formulario (aún sin guardar).
  const previewFx = useMemo<FxSettings>(
    () => (targetDual ? enabledFxSettings(business) : { ...fxSettingsOf(business), enabled: false }),
    [targetDual, business]
  );
  const liveRate = targetDual ? effectiveRate(fx.rates, previewFx.rateSource) : null;
  const sampleRate = liveRate ?? EXAMPLE_RATE;
  const sampleMethods = useMemo(() => paymentMethodsOf({ paymentMethods: business.paymentMethods, fx: previewFx }), [business.paymentMethods, previewFx]);
  const taxRateNum = Number(v.taxRate) || 0;

  const sampleSale = useMemo(
    () =>
      targetDual
        ? sampleDualCurrencySale({
            taxRate: taxRateNum,
            pricesIncludeTax: v.pricesIncludeTax,
            actor,
            currency: v.currency,
            fx: previewFx,
            methods: sampleMethods,
            rate: sampleRate,
            rateSource: previewFx.rateSource
          })
        : sampleSingleCurrencySale({ taxRate: taxRateNum, pricesIncludeTax: v.pricesIncludeTax, actor }),
    [targetDual, taxRateNum, v.pricesIncludeTax, v.currency, actor, previewFx, sampleMethods, sampleRate]
  );

  const receiptBusiness = {
    name: business.name,
    legalName: business.legalName,
    taxId: business.taxId,
    address: business.address,
    phone: business.phone,
    logoUrl: business.logoUrl,
    currency: v.currency,
    locale: v.locale,
    taxName: v.taxName.trim() || 'IVA',
    taxRate: taxRateNum,
    receiptFooter: v.receiptFooter.trim(),
    fx: previewFx
  };

  const symbol = currencySymbol(v.currency, v.locale);
  const venezuela = targetDual || business.country === 'VE';
  const formatHint = targetDual
    ? `Formato: ${formatMoney(1234.5, v.currency, v.locale)} · ${formatMoney(1234.5, previewFx.localCurrency, previewFx.localLocale)}`
    : `Formato: ${formatMoney(1234.5, v.currency, v.locale)}`;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      <div className="flex flex-col gap-5 lg:col-span-7 lg:gap-6">
        <SettingsCard icon={Coins} title="Moneda e impuestos" subtitle="Cómo se cobran y desglosan los montos en el POS y en el ticket." badge={<Badge tone="info">Finanzas</Badge>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Moneda" htmlFor="tax-currency" hint={formatHint} className="sm:col-span-2">
              <Select
                id="tax-currency"
                value={v.option}
                options={currencyOptions}
                onChange={(e) => {
                  const value = e.target.value;
                  const next = CURRENCIES.find((c) => c.code === value);
                  if (next) form.patch({ option: next.code, ...currencyOptionBase(next) });
                  else if (value === form.baseline.option) form.patch({ option: value, currency: form.baseline.currency, locale: form.baseline.locale });
                }}
              />
            </Field>

            {enabling ? (
              <Callout icon={ArrowLeftRight} title="Al guardar se activará el modo bimonetario" className="sm:col-span-2">
                <span>
                  Precios en dólares y cobro también en bolívares, con las formas de pago de Venezuela.
                  {currencyChanged ? ` No se convierten tus precios: solo cambian a ${symbol} (USD).` : ''}
                </span>
              </Callout>
            ) : disabling ? (
              <Callout tone="warning" title="Al guardar se desactivará el modo bimonetario" className="sm:col-span-2">
                El POS dejará de cobrar en bolívares. Tu configuración de tasas e IGTF se conserva por si lo reactivas.
                {currencyChanged ? ` Además, cambiar la moneda no convierte tus precios (pasan a ${symbol}).` : ''}
              </Callout>
            ) : targetDual ? (
              <div className="flex flex-col gap-2 rounded-xl bg-primary-fixed/15 p-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-start gap-2 text-body-sm text-on-surface-variant">
                  <ArrowLeftRight className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <b className="font-semibold text-on-surface">Modo bimonetario activo.</b> Precios en dólares; cobro en $ y Bs a la tasa del día.
                  </span>
                </span>
                <Button size="sm" variant="secondary" iconRight={ArrowRight} onClick={() => onNavigate('moneda')}>
                  Moneda y tasas
                </Button>
              </div>
            ) : currencyChanged ? (
              <Callout tone="warning" title="Cambiar la moneda no convierte tus precios" className="sm:col-span-2">
                Los productos, ventas y cortes conservan sus montos actuales; solo cambian el símbolo ({symbol}) y el formato de los números.
              </Callout>
            ) : (
              <p className="-mt-2 text-body-sm text-on-surface-variant sm:col-span-2">
                Cambiar la moneda no convierte los precios existentes, solo el símbolo y el formato.
                {venezuela ? ' ¿Cobras en dólares y bolívares? Elige "Venezuela · Dólar + Bolívar".' : ''}
              </p>
            )}

            <Field label="Nombre del impuesto" htmlFor="tax-name" required error={errors.taxName}>
              <Input id="tax-name" value={v.taxName} onChange={(e) => form.set('taxName', e.target.value)} maxLength={20} placeholder="IVA" invalid={!!errors.taxName} />
            </Field>
            <Field label="Tasa" htmlFor="tax-rate" required error={errors.taxRate}>
              <NumberInput id="tax-rate" value={v.taxRate} onValueChange={(n) => form.set('taxRate', n)} suffix="%" invalid={!!errors.taxRate} placeholder="16" />
            </Field>
            {presetDiffers && preset && (
              <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                  <Sparkles className="size-4 shrink-0 text-primary" />
                  Lo habitual para {preset.baseCurrency ? 'Venezuela' : preset.code} es {preset.taxName} {preset.taxRate}%.
                </span>
                <Button size="sm" variant="tonal" onClick={() => form.patch({ taxName: preset.taxName, taxRate: preset.taxRate })}>
                  Usar {preset.taxName} {preset.taxRate}%
                </Button>
              </div>
            )}
            <div className="sm:col-span-2">
              <Toggle
                checked={v.pricesIncludeTax}
                onChange={(on) => form.set('pricesIncludeTax', on)}
                label="Los precios incluyen impuesto"
                description={
                  v.pricesIncludeTax
                    ? `El precio de venta ya trae el ${v.taxName.trim() || 'impuesto'}; el ticket lo desglosa sin cambiar el total.`
                    : `El ${v.taxName.trim() || 'impuesto'} se suma al subtotal al momento de cobrar.`
                }
              />
            </div>
            {targetDual && (
              <p className="flex items-start gap-2 text-body-sm text-on-surface-variant sm:col-span-2">
                <Info className="mt-0.5 size-4 shrink-0" />
                Los productos exentos de {v.taxName.trim() || 'IVA'} (canasta básica) se marcan en su ficha y salen con (E) en el ticket. El IGTF se configura en Moneda y
                tasas.
              </p>
            )}
          </div>
        </SettingsCard>

        <SettingsCard icon={ReceiptText} iconTone="secondary" title="Ticket de venta" subtitle="Texto al pie de cada ticket impreso o compartido." badge={<Badge tone="neutral">80 mm</Badge>}>
          <Field
            label="Pie de ticket"
            htmlFor="tax-footer"
            hint="Puedes usar varias líneas: agradecimiento, políticas de cambio, redes sociales…"
            aside={
              <span className="text-body-sm text-on-surface-variant tnum">
                {v.receiptFooter.length}/{FOOTER_MAX}
              </span>
            }
          >
            <Textarea
              id="tax-footer"
              rows={4}
              maxLength={FOOTER_MAX}
              value={v.receiptFooter}
              onChange={(e) => form.set('receiptFooter', e.target.value)}
              placeholder="¡Gracias por su compra!"
            />
          </Field>
          <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Store className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="flex flex-col">
                <span className="text-label-md text-on-surface">Encabezado del ticket</span>
                <span className="text-body-sm text-on-surface-variant">
                  Logotipo, nombre, razón social, {venezuela ? 'RIF' : 'RFC/NIT'}, dirección y teléfono se toman de la pestaña Negocio.
                </span>
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => onNavigate('negocio')}>
              Editar datos
            </Button>
          </div>
        </SettingsCard>
      </div>

      <div className="lg:col-span-5">
        <div className="lg:sticky lg:top-20">
          <SettingsCard
            icon={Eye}
            title="Vista previa en vivo"
            subtitle="Se actualiza mientras editas, antes de guardar."
            badge={<Badge tone="warning">Ejemplo</Badge>}
          >
            <div className="rounded-xl bg-slate-100 p-3 sm:p-4">
              <div className="mx-auto max-w-[320px] rounded-lg bg-white p-4 shadow-card">
                <div className="mb-3 rounded bg-amber-50 py-1 text-center text-[10px] font-bold tracking-wider text-amber-800 uppercase">
                  Ticket de ejemplo · no es una venta real
                </div>
                <Receipt sale={sampleSale} business={receiptBusiness} />
              </div>
            </div>
            <p className="flex items-start gap-2 text-body-sm text-on-surface-variant">
              <Info className="mt-0.5 size-4 shrink-0" />
              {targetDual ? (
                <span>
                  Venta ficticia en dos monedas: una parte por pago móvil y el resto con un billete en $
                  {previewFx.igtfEnabled ? ` (con IGTF ${previewFx.igtfRate} %)` : ''}, con vuelto.{' '}
                  {liveRate ? (
                    <>
                      Usa la tasa {RATE_SOURCE_LABELS[previewFx.rateSource]} actual ({formatRate(liveRate)}).
                    </>
                  ) : (
                    <b className="font-semibold text-amber-800">Tasa de ejemplo ({formatRate(EXAMPLE_RATE)}): aún no hay tasa cargada.</b>
                  )}{' '}
                  No se registra en tus ventas.
                </span>
              ) : (
                'Venta ficticia con artículos de ejemplo, solo para visualizar el formato. No se registra en tus ventas.'
              )}
            </p>
          </SettingsCard>
        </div>
      </div>
    </div>
  );
}
