import { useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Coins, Eye, Info, ReceiptText, Sparkles, Store } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useOnline } from '@/hooks/data';
import { CURRENCIES } from '@/config/app';
import { currencySymbol, formatMoney } from '@/lib/format';
import { computeTotals } from '@/lib/totals';
import { errorMessage } from '@/lib/utils';
import { logActivity } from '@/services/activity';
import { updateBusiness } from '@/services/business';
import type { Sale, SaleItem } from '@/types';
import { Receipt } from '@/components/receipt/Receipt';
import { Badge, Button, Field, Input, NumberInput, Select, Textarea, Toggle, useToast } from '@/components/ui';
import { persist, usePendingChanges, useSyncedForm, type SettingsTabId } from './settingsState';
import { Callout, SettingsCard } from './SettingsUI';

const FOOTER_MAX = 300;

/** Artículos ficticios SOLO para la vista previa del ticket (no se guardan). */
const SAMPLE_ITEMS: Pick<SaleItem, 'name' | 'qty' | 'unitPrice' | 'unitCost'>[] = [
  { name: 'Artículo de ejemplo 1', qty: 2, unitPrice: 25, unitCost: 15 },
  { name: 'Artículo de ejemplo 2', qty: 1, unitPrice: 48.5, unitCost: 31 },
  { name: 'Artículo de ejemplo 3', qty: 3, unitPrice: 12.9, unitCost: 7.5 }
];

export function TaxReceiptTab({ onNavigate }: { onNavigate: (tab: SettingsTabId) => void }) {
  const { business, businessId, actor } = useActiveBusiness();
  const toast = useToast();
  const online = useOnline();

  const source = useMemo(
    () => ({
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

  const currencyOptions = useMemo(() => {
    const list = CURRENCIES.map((c) => ({ value: c.code, label: c.label }));
    if (!CURRENCIES.some((c) => c.code === v.currency)) list.unshift({ value: v.currency, label: v.currency });
    return list;
  }, [v.currency]);

  const preset = CURRENCIES.find((c) => c.code === v.currency);
  const currencyChanged = v.currency !== form.baseline.currency;
  // Al cambiar de moneda sugerimos el impuesto habitual de ese país (sin aplicarlo solo).
  const presetDiffers = currencyChanged && !!preset && (preset.taxName !== v.taxName.trim() || preset.taxRate !== v.taxRate);

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
    form.patch(clean);
    setSaving(true);
    try {
      const synced = await persist(updateBusiness(businessId, clean), online);
      logActivity(businessId, actor, {
        type: 'settings_update',
        message: `Actualizó impuestos y ticket (${clean.currency}, ${clean.taxName} ${clean.taxRate}%)`
      });
      if (synced) toast.success('Impuestos y ticket guardados');
      else toast.info('Guardado en este dispositivo. Se sincronizará al recuperar la conexión.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  usePendingChanges({ area: 'impuestos y ticket', dirty: form.dirty, saving, canSave: valid, onSave: save, onDiscard: form.reset });

  // Venta de ejemplo para la vista previa, calculada con los valores del formulario (aún sin guardar).
  const sampleSale = useMemo<Sale>(() => {
    const items: SaleItem[] = SAMPLE_ITEMS.map((i) => ({ ...i, productId: null, total: i.unitPrice * i.qty }));
    const totals = computeTotals({ items, discount: 0, taxRate: Number(v.taxRate) || 0, pricesIncludeTax: v.pricesIncludeTax });
    const cashReceived = Math.ceil(totals.total / 50) * 50 || totals.total;
    return {
      ...totals,
      id: 'ejemplo',
      folio: 'EJEMPLO',
      number: null,
      items,
      productIds: [],
      paymentMethod: 'cash',
      cashReceived,
      change: Math.round((cashReceived - totals.total) * 100) / 100,
      cashierId: actor.uid,
      cashierName: actor.name,
      status: 'completed',
      createdAt: Timestamp.now()
    };
  }, [v.taxRate, v.pricesIncludeTax, actor.uid, actor.name]);

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
    taxRate: Number(v.taxRate) || 0,
    receiptFooter: v.receiptFooter.trim()
  };

  const symbol = currencySymbol(v.currency, v.locale);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      <div className="flex flex-col gap-5 lg:col-span-7 lg:gap-6">
        <SettingsCard icon={Coins} title="Moneda e impuestos" subtitle="Cómo se cobran y desglosan los montos en el POS y en el ticket." badge={<Badge tone="info">Finanzas</Badge>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Moneda" htmlFor="tax-currency" hint={`Formato: ${formatMoney(1234.5, v.currency, v.locale)}`} className="sm:col-span-2">
              <Select
                id="tax-currency"
                value={v.currency}
                options={currencyOptions}
                onChange={(e) => {
                  const next = CURRENCIES.find((c) => c.code === e.target.value);
                  form.patch({ currency: e.target.value, locale: next?.locale ?? v.locale });
                }}
              />
            </Field>
            {currencyChanged ? (
              <Callout tone="warning" title="Cambiar la moneda no convierte tus precios" className="sm:col-span-2">
                Los productos, ventas y cortes conservan sus montos actuales; solo cambian el símbolo ({symbol}) y el formato de los números.
              </Callout>
            ) : (
              <p className="-mt-2 text-body-sm text-on-surface-variant sm:col-span-2">
                Cambiar la moneda no convierte los precios existentes, solo el símbolo y el formato.
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
                  Lo habitual para {preset.code} es {preset.taxName} {preset.taxRate}%.
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
                <span className="text-body-sm text-on-surface-variant">Logotipo, nombre, razón social, RFC/NIT, dirección y teléfono se toman de la pestaña Negocio.</span>
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
              Venta ficticia con artículos de ejemplo, solo para visualizar el formato. No se registra en tus ventas.
            </p>
          </SettingsCard>
        </div>
      </div>
    </div>
  );
}
