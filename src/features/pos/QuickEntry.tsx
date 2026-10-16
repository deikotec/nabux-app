import { useId, type Ref } from 'react';
import { Delete, ScanBarcode, Search } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

interface QuickEntryProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onFocusChange: (focused: boolean) => void;
  autoFocus?: boolean;
  /** Versión de una línea para el celular (más espacio para el catálogo). */
  compact?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** Campo jumbo de escáner / búsqueda. El escáner tipo teclado escribe aquí y envía Enter. */
export function QuickEntry({ value, onChange, onSubmit, onClear, onFocusChange, autoFocus, compact, ref }: QuickEntryProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const wide = useMediaQuery('(min-width: 640px)');

  const input = (className: string, placeholder: string) => (
    <input
      ref={ref}
      id={id}
      type="text"
      value={value}
      autoFocus={autoFocus}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      enterKeyHint="enter"
      aria-label={compact ? 'Entrada rápida: escanea o busca un producto' : undefined}
      aria-describedby={compact ? undefined : hintId}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => onFocusChange(true)}
      onBlur={() => onFocusChange(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSubmit();
        }
      }}
      placeholder={placeholder}
      className={className}
    />
  );

  if (compact) {
    return (
      <div
        className={cn(
          'flex h-12 items-center gap-2 rounded-2xl border border-slate-200/80 bg-white pr-1.5 pl-3.5 shadow-card transition-shadow',
          'focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15'
        )}
      >
        <Search className="size-5 shrink-0 text-on-surface-variant" aria-hidden />
        {input(
          'h-full min-w-0 flex-1 bg-transparent text-body-lg text-on-surface outline-none placeholder:text-on-surface-variant/70',
          'Escanea o busca (nombre, SKU)…'
        )}
        {value ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Borrar entrada"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-surface transition-colors active:bg-surface-container-high"
          >
            <Delete className="size-[18px]" />
          </button>
        ) : (
          <ScanBarcode className="mr-2 size-5 shrink-0 text-primary" aria-hidden />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-card transition-shadow',
        'focus-within:border-primary/40 focus-within:shadow-lift focus-within:ring-2 focus-within:ring-primary/15'
      )}
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
        <ScanBarcode className="size-7" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="truncate text-label-sm tracking-wider text-on-surface-variant uppercase">
            Entrada rápida / búsqueda
          </label>
          <span id={hintId} className="hidden truncate text-body-sm text-on-surface-variant 2xl:inline">
            Enter agrega · <span className="font-semibold tnum">3*código</span> = 3 unidades
          </span>
        </div>
        {input(
          'h-8 w-full bg-transparent text-headline-sm text-on-surface outline-none placeholder:font-normal placeholder:text-on-surface-variant/60',
          wide ? 'Escanea el código de barras o escribe el nombre del producto…' : 'Escanea o escribe un producto…'
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 pr-1">
        <kbd className="hidden rounded bg-surface-container px-2 py-1 font-sans text-data-mono text-on-surface-variant sm:inline pointer-coarse:hidden!">F2</kbd>
        <button
          type="button"
          onClick={onClear}
          disabled={!value}
          aria-label="Borrar entrada"
          title="Borrar entrada (Esc)"
          className="flex size-10 items-center justify-center rounded-lg bg-surface-container text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-40"
        >
          <Delete className="size-5" />
        </button>
      </div>
    </div>
  );
}
