import type { KeyboardEvent, Ref } from 'react';
import { ChevronDown, CornerDownLeft, FunnelX, ScanBarcode } from 'lucide-react';
import { Button, Kbd, SearchInput } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Product, Supplier } from '@/types';
import { DEFAULT_FILTERS, hasActiveFilters, NO_SUPPLIER, SORT_OPTIONS, STATUS_OPTIONS, taxOptions, type Filters, type TaxFilter } from './helpers';

interface Option {
  value: string;
  label: string;
}

/** Selector compacto tipo "Categoría: Todas ▾" (select nativo invisible encima, accesible). */
function FilterSelect({
  label,
  value,
  options,
  onChange,
  defaultValue,
  className
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  defaultValue: string;
  className?: string;
}) {
  const current = options.find((o) => o.value === value)?.label ?? options[0]?.label ?? '';
  return (
    <label
      className={cn(
        // Móvil: etiqueta arriba y valor abajo; desde sm: "Etiqueta: valor" en una línea.
        'relative flex h-12 min-w-0 cursor-pointer flex-col justify-center rounded-lg border border-slate-200 bg-white pr-8 pl-3 text-label-md shadow-card transition-colors',
        'sm:inline-flex sm:h-10 sm:flex-row sm:items-center sm:justify-start sm:gap-1.5',
        'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 hover:bg-slate-50',
        className
      )}
    >
      <span className="shrink-0 text-[11px] leading-tight font-normal text-on-surface-variant sm:text-label-md">
        {label}
        <span className="hidden sm:inline">:</span>
      </span>
      <span className={cn('min-w-0 truncate font-semibold', value === defaultValue ? 'text-on-surface' : 'text-primary')}>{current}</span>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  categories: string[];
  suppliers: Supplier[];
  searchRef?: Ref<HTMLInputElement>;
  /** Producto cuyo código de barras / SKU coincide exacto con la búsqueda (escaneo). */
  exactMatch: Product | null;
  onOpenMatch: () => void;
  /** Muestra el filtro "Exentos de IVA / Gravados" (negocios en Venezuela). */
  showTax?: boolean;
  taxName?: string;
}

export function FilterBar({ filters, onChange, onClear, categories, suppliers, searchRef, exactMatch, onOpenMatch, showTax, taxName = 'IVA' }: Props) {
  const active = hasActiveFilters(filters);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (exactMatch) onOpenMatch();
    } else if (e.key === 'Escape' && filters.search) {
      e.preventDefault();
      onChange({ search: '' });
    }
  };

  const selectClass = 'w-full sm:w-auto sm:max-w-60';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-2 2xl:flex-row 2xl:items-center">
        <div className="min-w-0 flex-1 2xl:max-w-xl">
          <SearchInput
            ref={searchRef}
            value={filters.search}
            onChange={(v) => onChange({ search: v })}
            onKeyDown={onKeyDown}
            icon={ScanBarcode}
            placeholder="Escanea EAN-13, SKU o escribe un nombre…"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center 2xl:flex-nowrap 2xl:justify-end">
          <FilterSelect
            label="Categoría"
            value={filters.category}
            defaultValue={DEFAULT_FILTERS.category}
            onChange={(v) => onChange({ category: v })}
            options={[{ value: '', label: 'Todas' }, ...categories.map((c) => ({ value: c, label: c }))]}
            className={selectClass}
          />
          <FilterSelect
            label="Estado"
            value={filters.status}
            defaultValue={DEFAULT_FILTERS.status}
            onChange={(v) => onChange({ status: v as Filters['status'] })}
            options={STATUS_OPTIONS}
            className={selectClass}
          />
          <FilterSelect
            label="Proveedor"
            value={filters.supplier}
            defaultValue={DEFAULT_FILTERS.supplier}
            onChange={(v) => onChange({ supplier: v })}
            options={[{ value: '', label: 'Todos' }, { value: NO_SUPPLIER, label: 'Sin proveedor' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
            className={selectClass}
          />
          {showTax && (
            <FilterSelect
              label={taxName}
              value={filters.tax}
              defaultValue={DEFAULT_FILTERS.tax}
              onChange={(v) => onChange({ tax: v as TaxFilter })}
              options={taxOptions(taxName)}
              className={selectClass}
            />
          )}
          <FilterSelect
            label="Ordenar"
            value={filters.sort}
            defaultValue={DEFAULT_FILTERS.sort}
            onChange={(v) => onChange({ sort: v as Filters['sort'] })}
            options={SORT_OPTIONS}
            className={selectClass}
          />
          <Button
            variant="secondary"
            icon={FunnelX}
            onClick={onClear}
            disabled={!active}
            aria-label="Limpiar filtros"
            title="Limpiar filtros"
            className={cn(!showTax && 'col-span-2', 'sm:w-10 sm:px-0')}
          >
            <span className="sm:hidden">Limpiar filtros</span>
          </Button>
        </div>
      </div>

      {exactMatch && (
        <div className="flex animate-fade-in flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary-fixed/20 px-3 py-2 text-body-sm text-on-primary-fixed-variant" role="status">
          <span className="min-w-0">
            Coincidencia exacta de código: <b className="text-on-surface">{exactMatch.name}</b>
            <span className="tnum"> · {exactMatch.sku}</span>
          </span>
          <button type="button" onClick={onOpenMatch} className="inline-flex items-center gap-1.5 text-label-md text-primary hover:underline">
            Abrir producto
            <Kbd className="inline-flex items-center gap-1">
              <CornerDownLeft className="size-3" /> Enter
            </Kbd>
          </button>
        </div>
      )}
    </div>
  );
}
