import { useId } from 'react';
import { CalendarDays, CalendarRange, FunnelX } from 'lucide-react';
import { PAYMENT_METHODS } from '@/config/app';
import { toInputDate } from '@/lib/dates';
import { Button, Input, SearchInput, Segmented, Select, type TabOption } from '@/components/ui';
import type { PaymentMethod } from '@/types';

export type RangeOption = 'today' | 'yesterday' | '7d' | 'month' | '30d' | 'custom';
export type StatusFilter = 'all' | 'completed' | 'voided';
export type MethodFilter = 'all' | PaymentMethod;

export const RANGE_OPTIONS: TabOption<RangeOption>[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: '7d', label: '7 días' },
  { value: 'month', label: 'Este mes' },
  { value: '30d', label: '30 días' },
  { value: 'custom', label: 'Personalizado', icon: CalendarRange }
];

/** Selector de período + fechas personalizadas. */
export function RangeBar({
  preset,
  onPreset,
  customFrom,
  customTo,
  onCustomFrom,
  onCustomTo,
  rangeLabel
}: {
  preset: RangeOption;
  onPreset: (v: RangeOption) => void;
  customFrom: string;
  customTo: string;
  onCustomFrom: (v: string) => void;
  onCustomTo: (v: string) => void;
  rangeLabel: string;
}) {
  const fromId = useId();
  const toId = useId();
  const today = toInputDate(new Date());
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmented options={RANGE_OPTIONS} value={preset} onChange={onPreset} />
      </div>
      {preset === 'custom' && (
        <div className="grid animate-fade-in grid-cols-2 gap-2 sm:flex sm:items-center">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label htmlFor={fromId} className="text-label-md text-on-surface-variant">
              Desde
            </label>
            <div className="sm:w-40">
              <Input id={fromId} type="date" inputSize="sm" max={customTo || today} value={customFrom} onChange={(e) => onCustomFrom(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label htmlFor={toId} className="text-label-md text-on-surface-variant">
              Hasta
            </label>
            <div className="sm:w-40">
              <Input id={toId} type="date" inputSize="sm" min={customFrom} max={today} value={customTo} onChange={(e) => onCustomTo(e.target.value)} />
            </div>
          </div>
        </div>
      )}
      <span className="inline-flex items-center gap-1.5 text-body-sm text-on-surface-variant lg:ml-auto">
        <CalendarDays className="size-4" aria-hidden />
        <span className="tnum">{rangeLabel}</span>
      </span>
    </div>
  );
}

/** Búsqueda + filtros (método, estado y cajero). */
export function FilterBar({
  search,
  onSearch,
  method,
  onMethod,
  status,
  onStatus,
  cashier,
  onCashier,
  cashiers,
  showCashier,
  hasFilters,
  onClear
}: {
  search: string;
  onSearch: (v: string) => void;
  method: MethodFilter;
  onMethod: (v: MethodFilter) => void;
  status: StatusFilter;
  onStatus: (v: StatusFilter) => void;
  cashier: string;
  onCashier: (v: string) => void;
  cashiers: { id: string; name: string }[];
  showCashier: boolean;
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-2 xl:flex-row xl:items-center">
      <SearchInput value={search} onChange={onSearch} placeholder="Buscar por folio, cliente o producto…" className="min-w-0 xl:flex-1" />
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center">
        <Select
          aria-label="Método de pago"
          value={method}
          onChange={(e) => onMethod(e.target.value as MethodFilter)}
          options={[{ value: 'all', label: 'Método: Todos' }, ...PAYMENT_METHODS.map((m) => ({ value: m.id, label: m.label }))]}
          className="sm:w-48"
        />
        <Select
          aria-label="Estado"
          value={status}
          onChange={(e) => onStatus(e.target.value as StatusFilter)}
          options={[
            { value: 'all', label: 'Estado: Todas' },
            { value: 'completed', label: 'Completadas' },
            { value: 'voided', label: 'Anuladas' }
          ]}
          className="sm:w-44"
        />
        {showCashier && (
          <Select
            aria-label="Cajero"
            value={cashier}
            onChange={(e) => onCashier(e.target.value)}
            options={[{ value: 'all', label: 'Cajero: Todos' }, ...cashiers.map((c) => ({ value: c.id, label: c.name }))]}
            className="min-[420px]:col-span-2 sm:col-span-1 sm:w-48"
          />
        )}
        {hasFilters && (
          <Button variant="ghost" icon={FunnelX} onClick={onClear} className="min-[420px]:col-span-2 sm:col-span-1">
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}
