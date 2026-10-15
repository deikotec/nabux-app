import { useId, useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Banknote, CircleAlert, CreditCard, HandCoins, Info, QrCode } from 'lucide-react';
import { NumberInput } from '@/components/ui';
import { PAYMENT_METHODS } from '@/config/app';
import { cn } from '@/lib/utils';
import type { PaymentMethod } from '@/types';
import { formatBill, quickCashOptions } from './posUtils';

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  transfer: QrCode
};

const METHOD_SHORT: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transf. / QR'
};

interface PaymentSectionProps {
  method: PaymentMethod;
  onMethodChange: (m: PaymentMethod) => void;
  total: number;
  cashReceived: number | '';
  onCashReceivedChange: (v: number | '') => void;
  received: number;
  change: number;
  money: (n: number) => string;
  currency: string;
  locale: string;
  currencySymbol: string;
  disabled?: boolean;
  /** Enter en el campo de monto recibido → cobrar. */
  onSubmit: () => void;
  className?: string;
}

/** Forma de pago, billetes rápidos, monto recibido y vuelto. */
export function PaymentSection({
  method,
  onMethodChange,
  total,
  cashReceived,
  onCashReceivedChange,
  received,
  change,
  money,
  currency,
  locale,
  currencySymbol,
  disabled,
  onSubmit,
  className
}: PaymentSectionProps) {
  const id = useId();
  const options = useMemo(() => quickCashOptions(total), [total]);
  const exactActive = cashReceived === '' || cashReceived === total;

  return (
    <section aria-labelledby={`${id}-title`} className={cn('flex flex-col gap-3', className)}>
      <h3 id={`${id}-title`} className="text-label-sm tracking-wider text-on-surface-variant uppercase">
        Forma de pago
      </h3>
      <div role="radiogroup" aria-labelledby={`${id}-title`} className="grid grid-cols-3 gap-2">
        {PAYMENT_METHODS.map((m) => {
          const Icon = METHOD_ICONS[m.id];
          const active = method === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={m.label}
              disabled={disabled}
              onClick={() => onMethodChange(m.id)}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-label-md transition-all disabled:opacity-55',
                active
                  ? 'bg-primary text-on-primary shadow-lift'
                  : 'border border-slate-200/80 bg-surface-container-low text-on-surface hover:border-primary/30 hover:bg-surface-container'
              )}
            >
              <Icon className="size-5" />
              <span className="text-center leading-tight">{METHOD_SHORT[m.id]}</span>
            </button>
          );
        })}
      </div>

      {method === 'cash' ? (
        <div className="flex flex-col gap-2.5 rounded-2xl bg-surface-container-low p-3">
          <div className="flex items-center justify-between gap-2 text-label-md">
            <span className="text-on-surface-variant">Billetes recibidos rápidos</span>
            <span className="text-primary tnum">Total: {money(total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 @xs:grid-cols-4" role="group" aria-label="Billetes recibidos rápidos">
            <button
              type="button"
              disabled={disabled}
              aria-pressed={exactActive}
              onClick={() => onCashReceivedChange('')}
              className={billClass(exactActive)}
            >
              Exacto
            </button>
            {options.map((v) => {
              const active = cashReceived === v;
              return (
                <button
                  key={v}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => onCashReceivedChange(v)}
                  className={billClass(active)}
                >
                  {formatBill(v, currency, locale)}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-received`} className="text-label-md text-slate-700">
              Monto recibido
            </label>
            <NumberInput
              id={`${id}-received`}
              prefix={currencySymbol}
              value={cashReceived}
              onValueChange={onCashReceivedChange}
              placeholder={`${total.toFixed(2)} (exacto)`}
              disabled={disabled}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSubmit();
                }
              }}
            />
          </div>
          <div
            aria-live="polite"
            className={cn(
              'flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl px-3 py-2.5',
              change >= 0 ? 'bg-primary-fixed/60 text-on-primary-fixed-variant' : 'bg-error-container text-on-error-container'
            )}
          >
            <span className="flex items-center gap-2 text-label-md">
              {change >= 0 ? <HandCoins className="size-[18px]" /> : <CircleAlert className="size-[18px]" />}
              {cashReceived === '' ? 'Paga con el monto exacto' : `Paga con ${money(received)}`}
            </span>
            <span className="ml-auto text-headline-sm font-bold tnum">
              {change >= 0 ? `Vuelto: ${money(change)}` : `Faltan: ${money(-change)}`}
            </span>
          </div>
        </div>
      ) : (
        <p className="flex items-start gap-2 rounded-xl bg-secondary-fixed/50 px-3 py-2.5 text-body-sm text-on-secondary-fixed-variant">
          <Info className="mt-px size-4 shrink-0" />
          {method === 'card'
            ? `Cobra ${money(total)} en la terminal bancaria y confirma cuando el pago sea aprobado.`
            : `Verifica que la transferencia o pago QR por ${money(total)} se haya acreditado antes de confirmar.`}
        </p>
      )}
    </section>
  );
}

function billClass(active: boolean) {
  return cn(
    'h-10 truncate rounded-lg px-1.5 text-label-lg tnum transition-colors disabled:opacity-55',
    active ? 'bg-primary text-on-primary shadow-card' : 'border border-slate-200 bg-white text-on-surface hover:border-primary/40 hover:bg-primary-fixed/10'
  );
}
