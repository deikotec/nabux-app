import { useEffect, useState } from 'react';
import { Banknote, Check, Percent } from 'lucide-react';
import { Button, Field, Modal, NumberInput, Segmented } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { cn, round2 } from '@/lib/utils';
import type { DiscountMode, TicketDiscount } from './types';

interface DiscountModalProps {
  open: boolean;
  onClose: () => void;
  /** Importe bruto del ticket (antes de descuento). */
  gross: number;
  current: TicketDiscount | null;
  maxPct: number;
  money: (n: number) => string;
  currencySymbol: string;
  /** Total resultante para un descuento dado (vista previa). */
  previewTotal: (discountAmount: number) => number;
  onApply: (d: TicketDiscount | null) => void;
}

/** Descuento al ticket en % o monto, con tope configurable por negocio. */
export function DiscountModal({ open, onClose, gross, current, maxPct, money, currencySymbol, previewTotal, onApply }: DiscountModalProps) {
  const [mode, setMode] = useState<DiscountMode>('pct');
  const [value, setValue] = useState<number | ''>('');

  useEffect(() => {
    if (open) {
      setMode(current?.mode ?? 'pct');
      setValue(current?.value ?? '');
    }
  }, [open, current]);

  const num = Number(value) || 0;
  const amount = round2(mode === 'pct' ? (gross * num) / 100 : num);
  const maxAmount = round2((gross * maxPct) / 100);
  const pct = gross > 0 ? (amount / gross) * 100 : 0;
  const exceeds = amount > maxAmount + 0.004;
  const valid = num > 0 && !exceeds;
  const presets = Array.from(new Set([5, 10, 15, 20, 25, 50].filter((p) => p < maxPct).concat(maxPct))).sort((a, b) => a - b);

  const apply = () => {
    if (!valid) return;
    onApply({ mode, value: round2(num) });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Aplicar descuento"
      subtitle={`Máximo permitido: ${formatNumber(maxPct)}% del ticket (${money(maxAmount)}).`}
      icon={Percent}
      size="sm"
      footer={
        <>
          {current && (
            <Button variant="danger" className="sm:mr-auto" onClick={() => onApply(null)}>
              Quitar descuento
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button icon={Check} onClick={apply} disabled={!valid}>
            Aplicar
          </Button>
        </>
      }
    >
      <div
        className="flex flex-col gap-4"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault();
            apply();
          }
        }}
      >
        <Segmented<DiscountMode>
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setValue('');
          }}
          options={[
            { value: 'pct', label: 'Porcentaje', icon: Percent },
            { value: 'amount', label: 'Monto fijo', icon: Banknote }
          ]}
        />

        <Field
          label={mode === 'pct' ? 'Porcentaje de descuento' : 'Monto a descontar'}
          error={exceeds ? `Supera el máximo permitido de ${formatNumber(maxPct)}% (${money(maxAmount)}).` : undefined}
        >
          <NumberInput
            autoFocus
            data-autofocus
            inputSize="lg"
            value={value}
            onValueChange={setValue}
            prefix={mode === 'amount' ? currencySymbol : undefined}
            suffix={mode === 'pct' ? '%' : undefined}
            placeholder={mode === 'pct' ? '10' : '0.00'}
            invalid={exceeds}
            aria-label={mode === 'pct' ? 'Porcentaje de descuento' : 'Monto a descontar'}
          />
        </Field>

        {mode === 'pct' && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Porcentajes rápidos">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setValue(p)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-label-md tnum transition-colors',
                  value === p ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white hover:bg-slate-50'
                )}
              >
                {formatNumber(p)}%
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5 rounded-xl bg-surface-container-low px-4 py-3">
          <div className="flex justify-between text-body-md text-on-surface-variant">
            <span>Importe del ticket</span>
            <span className="tnum">{money(gross)}</span>
          </div>
          <div className="flex justify-between text-body-md text-on-surface-variant">
            <span>Descuento{amount > 0 ? ` (${formatNumber(pct, undefined, 1)}%)` : ''}</span>
            <span className={cn('tnum', exceeds ? 'text-error' : 'text-primary')}>−{money(Math.min(amount, gross))}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between border-t border-slate-200 pt-2">
            <span className="text-label-lg text-on-surface">Nuevo total</span>
            <span className="text-headline-md text-primary tnum">{money(previewTotal(exceeds ? maxAmount : amount))}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
