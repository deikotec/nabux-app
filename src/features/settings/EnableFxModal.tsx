import { useState } from 'react';
import { ArrowLeftRight, Check, CircleDollarSign, Percent, WalletCards } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useOnline } from '@/hooks/data';
import { RATE_SOURCE_LABELS, VE_PAYMENT_METHODS } from '@/config/app';
import { formatMoney } from '@/lib/format';
import { errorMessage } from '@/lib/utils';
import { logActivity } from '@/services/activity';
import { updateBusiness, type BusinessPatch } from '@/services/business';
import { Button, Checkbox, Modal, useToast } from '@/components/ui';
import { enableFxPatch, hasLocalMethods } from './fxHelpers';
import { persist } from './settingsState';
import { Callout } from './SettingsUI';

/**
 * Asistente para activar el modo bimonetario (USD + Bs).
 * Se monta solo mientras está abierto, así cada apertura empieza con las opciones sugeridas.
 */
export function EnableFxModal({ onClose, onDone }: { onClose: () => void; onDone?: () => void }) {
  const { business, businessId, actor } = useActiveBusiness();
  const toast = useToast();
  const online = useOnline();

  const needsUsd = business.currency !== 'USD';
  const needsIva = !(Number(business.taxRate) === 16 && (business.taxName ?? '').trim().toUpperCase() === 'IVA');
  const storedMethods = business.paymentMethods ?? [];
  const previous = business.fx;

  const [toUsd, setToUsd] = useState(true);
  const [iva16, setIva16] = useState(true);
  const [veMethods, setVeMethods] = useState(() => !hasLocalMethods(business));
  const [saving, setSaving] = useState(false);

  const veNames = VE_PAYMENT_METHODS.filter((m) => m.active).map((m) => m.label);

  const activate = async () => {
    const patch: BusinessPatch = { ...enableFxPatch(business, { useVeMethods: veMethods }) };
    if (needsUsd && toUsd) patch.currency = 'USD';
    if (needsIva && iva16) {
      patch.taxRate = 16;
      patch.taxName = 'IVA';
    }
    const details = [
      patch.currency ? `moneda base USD (antes ${business.currency})` : null,
      patch.taxRate !== undefined ? 'IVA 16%' : null,
      patch.paymentMethods ? 'formas de pago de Venezuela' : null
    ].filter(Boolean);
    setSaving(true);
    try {
      const synced = await persist(updateBusiness(businessId, patch), online);
      logActivity(businessId, actor, {
        type: 'settings_update',
        message: `Activó el modo bimonetario (USD + Bs)${details.length ? `: ${details.join(', ')}` : ''}`
      });
      if (synced) toast.success('Modo bimonetario activado. Revisa la tasa del día antes de cobrar.');
      else toast.info('Modo bimonetario activado en este dispositivo. Se sincronizará al recuperar la conexión.');
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      title="Activar modo bimonetario"
      subtitle="Dólares como moneda de referencia y cobro también en bolívares."
      icon={ArrowLeftRight}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button icon={Check} onClick={activate} loading={saving}>
            Activar modo bimonetario
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ul className="grid grid-cols-1 gap-2 text-body-md text-on-surface sm:grid-cols-2">
          {[
            'Tus precios se guardan en dólares ($).',
            'En el POS se cobra en $ y en Bs a la tasa del día.',
            'Pagos mixtos, vuelto en $ o Bs e IGTF sobre divisas.',
            'La caja lleva fondo y corte en ambas monedas.'
          ].map((t) => (
            <li key={t} className="flex items-start gap-2 rounded-xl bg-surface-container-low p-3">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{t}</span>
            </li>
          ))}
        </ul>

        {needsUsd && (
          <div className="flex flex-col gap-2">
            <Checkbox
              bordered
              checked={toUsd}
              onChange={setToUsd}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <CircleDollarSign className="size-4 text-primary" />
                  Cambiar la moneda base a dólares (USD)
                </span>
              }
              description={`Hoy tu moneda base es ${business.currency}. En Venezuela lo habitual es fijar precios en $.`}
            />
            {toUsd && (
              <Callout tone="warning" title="No se convierten los precios existentes">
                Un producto que hoy cuesta {formatMoney(25, business.currency, business.locale)} ({business.currency}) quedará en{' '}
                {formatMoney(25, 'USD', 'es-VE')} (USD). Si tus precios no estaban en dólares, actualízalos después desde Inventario.
              </Callout>
            )}
          </div>
        )}

        {needsIva && (
          <Checkbox
            bordered
            checked={iva16}
            onChange={setIva16}
            label={
              <span className="inline-flex items-center gap-1.5">
                <Percent className="size-4 text-primary" />
                Usar IVA 16 %
              </span>
            }
            description={`Alícuota general en Venezuela. Hoy tienes ${business.taxName || 'impuesto'} ${business.taxRate}%. Los productos exentos se marcan en su ficha.`}
          />
        )}

        {storedMethods.length === 0 ? (
          <Callout icon={WalletCards} title="Se cargan las formas de pago de Venezuela">
            {veNames.join(', ')}. Puedes ajustarlas en la pestaña Formas de pago.
          </Callout>
        ) : (
          <Checkbox
            bordered
            checked={veMethods}
            onChange={setVeMethods}
            label={
              <span className="inline-flex items-center gap-1.5">
                <WalletCards className="size-4 text-primary" />
                Usar las formas de pago de Venezuela
              </span>
            }
            description={`${veNames.join(', ')}. Tus ${storedMethods.length} formas de pago actuales se conservan desactivadas.`}
          />
        )}

        <p className="text-body-sm text-on-surface-variant">
          También se fija el país (Venezuela) y el formato de números de Venezuela (1.234,56).
          {previous
            ? ` Se recupera tu configuración anterior: tasa ${RATE_SOURCE_LABELS[previous.rateSource] ?? 'BCV'}, IGTF ${previous.igtfEnabled ? `${previous.igtfRate}%` : 'desactivado'}.`
            : ' La tasa del POS será la BCV (oficial) y el IGTF quedará en 3 %; puedes cambiarlo después.'}
        </p>
      </div>
    </Modal>
  );
}
