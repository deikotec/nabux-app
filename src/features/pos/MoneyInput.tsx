import { useEffect, useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { cn } from '@/lib/utils';
import { formatAmountInput, parseAmount } from './posUtils';

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'size' | 'prefix'> {
  value: number | '';
  onValueChange: (v: number | '') => void;
  /** Idioma con el que se escribe y muestra el monto (es-VE: "1.234,56"). */
  locale: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  maxDecimals?: number;
  /** Interpretar "1.234" como miles (montos). En tasas conviene false. */
  thousands?: boolean;
  invalid?: boolean;
  size?: 'md' | 'lg' | 'xl';
  ref?: Ref<HTMLInputElement>;
}

const SIZES = {
  md: 'h-10 rounded-lg text-body-lg',
  lg: 'h-12 rounded-xl text-headline-sm',
  xl: 'h-14 rounded-xl text-headline-md'
};

/**
 * Campo de monto que acepta el formato del idioma (punto o coma) y devuelve un número.
 * Al salir del campo muestra el monto formateado ("11.753,84").
 */
export function MoneyInput({
  value,
  onValueChange,
  locale,
  prefix,
  suffix,
  maxDecimals = 2,
  thousands = true,
  invalid,
  size = 'lg',
  className,
  onBlur,
  ref,
  ...rest
}: MoneyInputProps) {
  const [text, setText] = useState(() => formatAmountInput(value, locale, maxDecimals));

  // Sincroniza cuando el valor cambia desde fuera (monto sugerido, billetes) sin pisar lo que se escribe.
  useEffect(() => {
    setText((current) => {
      const parsed = parseAmount(current, locale, { maxDecimals, thousands });
      if ((parsed ?? '') === value) return current;
      return formatAmountInput(value, locale, maxDecimals);
    });
  }, [value, locale, maxDecimals, thousands]);

  const wide = typeof prefix === 'string' && prefix.length > 1;

  return (
    <div className={cn('relative flex min-w-0 items-center', className)}>
      {prefix && (
        <span className="pointer-events-none absolute left-3 text-label-lg text-on-surface-variant" aria-hidden>
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        {...rest}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          if (!/^[\d.,\s]*$/.test(raw) || raw.length > 20) return;
          setText(raw);
          const n = parseAmount(raw, locale, { maxDecimals, thousands });
          onValueChange(n === null ? '' : n);
        }}
        onBlur={(e) => {
          if (value !== '') setText(formatAmountInput(value, locale, maxDecimals));
          onBlur?.(e);
        }}
        className={cn(
          'w-full min-w-0 border border-slate-300 bg-white font-bold text-on-surface tnum transition-colors placeholder:font-medium placeholder:text-slate-400',
          'focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500',
          SIZES[size],
          prefix ? (wide ? 'pl-11' : 'pl-8') : 'pl-3',
          suffix ? 'pr-16' : 'pr-3',
          invalid && 'border-error focus:ring-error/25'
        )}
      />
      {suffix && <span className="pointer-events-none absolute right-3 text-body-sm text-on-surface-variant">{suffix}</span>}
    </div>
  );
}
