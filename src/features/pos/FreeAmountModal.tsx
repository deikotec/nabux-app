import { useEffect, useState } from 'react';
import { Calculator, Plus } from 'lucide-react';
import { Button, Checkbox, Field, Input, Modal, Segmented } from '@/components/ui';
import { FREE_AMOUNT_ITEM_NAME } from '@/config/app';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useFx } from '@/contexts/FxContext';
import { currencySymbol as currencySymbolOf } from '@/lib/format';
import { round2 } from '@/lib/utils';
import { MoneyInput } from './MoneyInput';
import { numberSeparators } from './posUtils';

interface FreeAmountModalProps {
  open: boolean;
  onClose: () => void;
  /** Monto siempre en moneda base ($). */
  onAdd: (name: string, amount: number, taxExempt: boolean) => void;
}

type EntryCurrency = 'base' | 'local';

/** Captura de un artículo no catalogado (monto libre), en $ o en Bs (se guarda en $). */
export function FreeAmountModal({ open, onClose, onAdd }: FreeAmountModalProps) {
  const { business, money, currencySymbol } = useActiveBusiness();
  const fx = useFx();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [currency, setCurrency] = useState<EntryCurrency>('base');
  const [exempt, setExempt] = useState(false);
  const [touched, setTouched] = useState(false);

  const canLocal = fx.enabled && !!fx.rate;
  const isLocal = currency === 'local' && canLocal;
  const localSymbol = currencySymbolOf(fx.localCurrency, fx.settings.localLocale);

  useEffect(() => {
    if (open) {
      setName('');
      setAmount('');
      setExempt(false);
      setTouched(false);
    }
  }, [open]);

  const num = typeof amount === 'number' ? amount : 0;
  // Se guarda en moneda base (los precios del ticket van en $ con 2 decimales).
  const base = isLocal ? round2(num / (fx.rate as number)) : round2(num);
  const valid = base > 0;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onAdd(name.trim() || FREE_AMOUNT_ITEM_NAME, base, exempt);
    onClose();
  };

  const error = touched && !valid ? (num > 0 ? 'El monto es demasiado pequeño.' : 'Ingresa un monto mayor a cero.') : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Monto libre"
      subtitle="Cobra un artículo o servicio que no está en el catálogo. No descuenta inventario."
      icon={Calculator}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button icon={Plus} onClick={submit} disabled={touched && !valid}>
            Agregar al ticket
          </Button>
        </>
      }
    >
      <div
        className="flex flex-col gap-4"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault();
            submit();
          }
        }}
      >
        {fx.enabled && (
          <div className="flex flex-col gap-1.5">
            <Segmented<EntryCurrency>
              className="w-full [&>button]:flex-1 [&>button]:justify-center"
              value={isLocal ? 'local' : 'base'}
              onChange={(c) => {
                if (c === 'local' && !canLocal) return;
                // Convierte lo escrito para no perderlo al cambiar de moneda.
                if (typeof amount === 'number' && fx.rate) {
                  setAmount(c === 'local' ? round2(amount * fx.rate) : round2(amount / fx.rate));
                }
                setCurrency(c);
              }}
              options={[
                { value: 'base', label: `Dólares (${currencySymbol})` },
                { value: 'local', label: `Bolívares (${localSymbol})` }
              ]}
            />
            {!canLocal && <p className="text-body-sm text-on-surface-variant">Sin tasa de cambio solo puedes capturar el monto en dólares.</p>}
          </div>
        )}

        <Field
          label={isLocal ? 'Monto en bolívares' : 'Monto'}
          required
          error={error}
          hint={
            fx.enabled && fx.rate && num > 0
              ? isLocal
                ? `Se registra como ${money(base)} (${fx.moneyLocal(base)}) a la tasa del día.`
                : `Equivale a ${fx.moneyLocal(base)}.`
              : undefined
          }
        >
          <MoneyInput
            key={isLocal ? 'local' : 'base'}
            autoFocus
            data-autofocus
            size="xl"
            locale={isLocal ? fx.settings.localLocale : business.locale}
            prefix={isLocal ? localSymbol : currencySymbol}
            value={amount}
            onValueChange={setAmount}
            placeholder={`0${numberSeparators(isLocal ? fx.settings.localLocale : business.locale).decimal}00`}
            invalid={!!error}
            aria-label="Monto a cobrar"
          />
        </Field>
        <Field label="Descripción" hint={`Si la dejas vacía se registra como “${FREE_AMOUNT_ITEM_NAME}”.`}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={FREE_AMOUNT_ITEM_NAME} maxLength={80} />
        </Field>
        {business.taxRate > 0 && (
          <Checkbox
            bordered
            checked={exempt}
            onChange={setExempt}
            label={`Exento de ${business.taxName || 'impuesto'}`}
            description="Se marca con (E) en el ticket y no suma impuesto."
          />
        )}
      </div>
    </Modal>
  );
}
