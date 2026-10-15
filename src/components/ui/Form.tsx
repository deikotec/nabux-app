import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const fieldBase =
  'w-full rounded-lg border border-slate-300 bg-white text-body-md text-slate-900 placeholder:text-slate-400 transition-colors ' +
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:bg-slate-50 disabled:text-slate-500';

export interface FieldProps {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  htmlFor?: string;
  /** Contenido a la derecha de la etiqueta (ej. botón "Generar"). */
  aside?: ReactNode;
  children: ReactNode;
}

export function Field({ label, required, hint, error, className, htmlFor, aside, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || aside) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="text-label-md text-slate-700">
              {label}
              {required && <span className="ml-0.5 text-error">*</span>}
            </label>
          )}
          {aside}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-body-sm text-error">{error}</p>
      ) : hint ? (
        <p className="text-body-sm text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  icon?: LucideIcon;
  /** Texto o nodo fijo al inicio (ej. "$"). */
  prefix?: ReactNode;
  /** Texto o nodo fijo al final (ej. "unidades"). */
  suffix?: ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ icon: Icon, prefix, suffix, inputSize = 'md', invalid, className, ref, ...rest }: InputProps) {
  const h = inputSize === 'sm' ? 'h-8 text-body-sm' : inputSize === 'lg' ? 'h-12 text-body-lg' : 'h-10';
  if (!Icon && !prefix && !suffix) {
    return <input ref={ref} className={cn(fieldBase, h, 'px-3', invalid && 'border-error focus:ring-error/25', className)} {...rest} />;
  }
  return (
    <div className={cn('relative flex items-center', className)}>
      {Icon && <Icon className="pointer-events-none absolute left-3 size-[18px] text-slate-400" />}
      {prefix && !Icon && <span className="pointer-events-none absolute left-3 text-body-md font-semibold text-slate-500">{prefix}</span>}
      <input
        ref={ref}
        className={cn(fieldBase, h, Icon || prefix ? 'pl-9' : 'pl-3', suffix ? 'pr-20' : 'pr-3', invalid && 'border-error focus:ring-error/25')}
        {...rest}
      />
      {suffix && <span className="absolute right-3 flex items-center text-body-sm text-slate-500">{suffix}</span>}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar…',
  className,
  autoFocus,
  ref,
  onKeyDown,
  icon = Search,
  inputSize = 'md'
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  ref?: Ref<HTMLInputElement>;
  onKeyDown?: InputHTMLAttributes<HTMLInputElement>['onKeyDown'];
  icon?: LucideIcon;
  inputSize?: 'sm' | 'md' | 'lg';
}) {
  return (
    <Input
      ref={ref}
      icon={icon}
      inputSize={inputSize}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={className}
      suffix={
        value ? (
          <button type="button" onClick={() => onChange('')} className="rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Limpiar búsqueda">
            <X className="size-4" />
          </button>
        ) : undefined
      }
    />
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options?: { value: string; label: string }[];
  placeholder?: string;
  inputSize?: 'sm' | 'md' | 'lg';
  ref?: Ref<HTMLSelectElement>;
}

export function Select({ options, placeholder, inputSize = 'md', className, children, ref, ...rest }: SelectProps) {
  const h = inputSize === 'sm' ? 'h-8 text-body-sm' : inputSize === 'lg' ? 'h-12' : 'h-10';
  return (
    <div className={cn('relative', className)}>
      <select ref={ref} className={cn(fieldBase, h, 'appearance-none pr-9 pl-3')} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

export function Textarea({ className, ref, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-20 px-3 py-2', className)} {...rest} />;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
  ariaLabel
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
  /** Etiqueta accesible cuando no hay label visible. */
  ariaLabel?: string;
}) {
  const id = useId();
  const sw = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-slate-300'
      )}
    >
      <span className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
  if (!label) return sw;
  return (
    <div className={cn('flex items-center justify-between gap-4 rounded-xl bg-surface-container-low p-4', className)}>
      <label htmlFor={id} className="flex min-w-0 flex-col">
        <span className="text-label-lg text-on-surface">{label}</span>
        {description && <span className="text-body-sm text-on-surface-variant">{description}</span>}
      </label>
      {sw}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
  bordered
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
  /** Muestra la opción como tarjeta con borde. */
  bordered?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3',
        bordered && 'rounded-xl border p-3 transition-colors',
        bordered && (checked ? 'border-primary/40 bg-primary-fixed/15' : 'border-slate-200 bg-white hover:border-slate-300'),
        disabled && 'cursor-not-allowed opacity-60',
        className
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded border transition-colors',
          checked ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white'
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {(label || description) && (
        <span className="flex min-w-0 flex-col">
          {label && <span className="text-label-md text-on-surface">{label}</span>}
          {description && <span className="text-body-sm text-on-surface-variant">{description}</span>}
        </span>
      )}
    </label>
  );
}

/** Campo numérico que acepta coma o punto y devuelve número (o '' mientras está vacío). */
export function NumberInput({
  value,
  onValueChange,
  allowDecimals = true,
  allowNegative = false,
  min,
  onBlur,
  ...rest
}: Omit<InputProps, 'value' | 'onChange' | 'type' | 'min'> & {
  value: number | '';
  onValueChange: (v: number | '') => void;
  allowDecimals?: boolean;
  allowNegative?: boolean;
  /** Se aplica al salir del campo. */
  min?: number;
}) {
  const [text, setText] = useState(value === '' ? '' : String(value));

  // Sincroniza cuando el valor cambia desde fuera (sin pisar lo que el usuario está escribiendo).
  useEffect(() => {
    setText((current) => {
      const parsed = current === '' || current === '-' || current === '.' ? '' : Number(current);
      return parsed === value ? current : value === '' ? '' : String(value);
    });
  }, [value]);

  const pattern = allowDecimals ? (allowNegative ? /^-?\d*\.?\d{0,4}$/ : /^\d*\.?\d{0,4}$/) : allowNegative ? /^-?\d*$/ : /^\d*$/;

  return (
    <Input
      {...rest}
      type="text"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.');
        if (!pattern.test(raw)) return;
        setText(raw);
        if (raw === '' || raw === '-' || raw === '.') onValueChange('');
        else onValueChange(Number(raw));
      }}
      onBlur={(e) => {
        if (min !== undefined && value !== '' && value < min) onValueChange(min);
        onBlur?.(e);
      }}
      className={cn('tnum', rest.className)}
    />
  );
}
