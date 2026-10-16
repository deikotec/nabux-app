import type { KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react';
import {
  ArrowUpDown,
  ChevronDown,
  ClipboardCheck,
  CornerDownLeft,
  EllipsisVertical,
  Lock,
  MapPin,
  Minus,
  PackagePlus,
  Plus,
  ScanBarcode,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Truck,
  X
} from 'lucide-react';
import { useOnline } from '@/hooks/data';
import { formatNumber, formatPercent } from '@/lib/format';
import { cn, stockStatus } from '@/lib/utils';
import type { Product, Supplier } from '@/types';
import { Button, Popover, ProductThumb, Skeleton } from '@/components/ui';
import { MCard, Pill } from '@/components/mobile';
import { ActionMenu } from './ActionMenu';
import { MissingRateNotice } from './FxBits';
import { DEFAULT_FILTERS, hasActiveFilters, NO_SUPPLIER, SORT_OPTIONS, taxOptions, type Filters, type InventoryKpis, type MoveType, type StatusFilter, type TaxFilter } from './helpers';
import { menuItemsFor, type ProductHandlers, type RowContext } from './ProductParts';
import type { InventoryFx } from './useInventoryFx';

/** Modo de escaneo continuo: cada producto que se escanea o toca abre su entrada o su conteo. */
export type ScanMode = Extract<MoveType, 'in' | 'adjust'>;

const SCAN_COPY: Record<ScanMode, { icon: typeof PackagePlus; title: string; text: string }> = {
  in: { icon: PackagePlus, title: 'Ingreso de mercancía', text: 'escanea o toca un producto para registrar lo que llegó.' },
  adjust: { icon: ClipboardCheck, title: 'Conteo físico', text: 'escanea o toca un producto para registrar lo que contaste.' }
};

/** Unidad corta junto a la existencia ("24 disp.", "3,5 kg"). */
function stockText(p: Product, locale: string): string {
  const n = formatNumber(p.stock, locale);
  const unit = (p.unit || '').toLowerCase();
  const abbr: Record<string, string> = { kg: 'kg', gramo: 'g', litro: 'L', mililitro: 'ml', metro: 'm', docena: 'doc.' };
  return `${n} ${abbr[unit] ?? 'disp.'}`;
}

export interface InventoryMobileProps {
  products: Product[];
  /** Resultado de búsqueda y filtros (todas las páginas). */
  filtered: Product[];
  /** Lo que se muestra ahora (crece con "Ver más"). */
  visible: Product[];
  onMore: () => void;
  loading: boolean;
  kpis: InventoryKpis;
  categories: string[];
  suppliers: Supplier[];
  filters: Filters;
  onFilters: (patch: Partial<Filters>) => void;
  onClear: () => void;
  searchRef: Ref<HTMLInputElement>;
  exactMatch: Product | null;
  onOpenMatch: () => void;
  ctx: RowContext;
  handlers: ProductHandlers;
  money: (n: number) => string;
  ifx: InventoryFx;
  canEdit: boolean;
  onNew: () => void;
  scanMode: ScanMode | null;
  onScanMode: (m: ScanMode | null) => void;
  /** Tocar una tarjeta: editar, ver kardex o (en modo escaneo) registrar el movimiento. */
  onOpen: (p: Product) => void;
  /** Importar / exportar / IA (mismo menú que en escritorio). */
  tools: (close: () => void) => ReactNode;
  selecting: boolean;
  onSelecting: (on: boolean) => void;
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  /** Barra de acciones con los seleccionados. */
  bulkBar: ReactNode;
  /** Estado vacío o de carga (en lugar de la lista). */
  empty: ReactNode;
}

/** Inventario en el celular (ref/movil/inventario_stock_m_vil). */
export function InventoryMobile(props: InventoryMobileProps) {
  const { filters, onFilters, kpis, canEdit, scanMode, onScanMode, exactMatch, ifx } = props;
  const online = useOnline();
  const scan = scanMode ? SCAN_COPY[scanMode] : null;
  // Sin productos todavía: solo el encabezado y el estado vacío (importar / nuevo).
  const hasProducts = props.loading || props.products.length > 0;
  // Un código exacto manda sobre los filtros: al cambiar el estado se suelta la búsqueda.
  const setStatus = (s: StatusFilter) => onFilters(exactMatch ? { status: s, search: '' } : { status: s });

  return (
    <div className="flex flex-col gap-3 pt-2">
      {/* Encabezado con acciones */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-headline-lg-mobile tracking-tight text-on-surface">Control de stock</h1>
          <span className="flex items-center gap-1 text-label-sm text-on-surface-variant" role="status">
            <span className={cn('size-2 shrink-0 rounded-full', online ? 'animate-pulse bg-primary' : 'bg-amber-500')} aria-hidden />
            <span className="truncate">{online ? 'Sincronizado en tiempo real' : 'Sin conexión · se guarda al volver'}</span>
          </span>
        </div>
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onScanMode(scanMode === 'adjust' ? null : 'adjust')}
              aria-pressed={scanMode === 'adjust'}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-label-md shadow-card transition-all active:scale-95',
                scanMode === 'adjust' ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
              )}
            >
              <ClipboardCheck className={cn('size-[18px]', scanMode !== 'adjust' && 'text-primary')} aria-hidden />
              {/* En pantallas muy angostas (360 px) queda solo el ícono para que quepa el título. */}
              <span className="max-[380px]:sr-only">Conteo</span>
            </button>
            <button
              type="button"
              onClick={props.onNew}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-label-md font-bold text-on-primary shadow-card transition-all hover:bg-primary-container active:scale-95"
            >
              <Plus className="size-[18px]" aria-hidden />
              Nuevo
            </button>
          </div>
        ) : (
          <Pill tone="muted" icon={Lock}>
            Solo lectura
          </Pill>
        )}
      </div>

      {hasProducts && <SearchBar search={filters.search} onSearch={(v) => onFilters({ search: v })} searchRef={props.searchRef} exactMatch={exactMatch} onOpenMatch={props.onOpenMatch} />}

      {scan && (
        <div role="status" className="flex animate-fade-in items-center gap-2 rounded-xl bg-secondary-fixed px-3 py-2 text-body-sm text-on-secondary-fixed">
          <scan.icon className="size-5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <b className="font-semibold">{scan.title}:</b> {scan.text}
          </span>
          <button type="button" onClick={() => onScanMode(null)} className="shrink-0 rounded-lg bg-white/70 px-2.5 py-1 text-label-md text-on-surface">
            Terminar
          </button>
        </div>
      )}

      {exactMatch && (
        <div role="status" className="flex animate-fade-in items-center justify-between gap-2 rounded-xl bg-primary-fixed/40 px-3 py-2 text-body-sm text-on-primary-fixed-variant">
          <span className="min-w-0 truncate">
            Código encontrado: <b className="text-on-surface">{exactMatch.name}</b>
          </span>
          <button type="button" onClick={props.onOpenMatch} className="inline-flex shrink-0 items-center gap-1 text-label-md text-primary">
            {scanMode === 'in' ? 'Registrar entrada' : scanMode === 'adjust' ? 'Registrar conteo' : canEdit ? 'Abrir' : 'Ver'}
            <CornerDownLeft className="size-3.5" aria-hidden />
          </button>
        </div>
      )}

      {hasProducts && (
        <>
          <FilterChips filters={filters} onFilters={onFilters} onStatus={setStatus} kpis={kpis} total={props.products.length} categories={props.categories} />
          <MissingRateNotice ifx={ifx} />
          <ValuationCard
            kpis={kpis}
            loading={props.loading}
            money={props.money}
            local={ifx.local}
            status={exactMatch ? 'all' : filters.status}
            onStatus={setStatus}
            locale={props.ctx.locale}
          />
          <ListToolbar {...props} />
        </>
      )}

      {props.selecting && !props.bulkBar && (
        <div role="status" className="flex animate-fade-in items-center justify-between gap-2 rounded-xl bg-primary-fixed/25 px-3 py-2 text-body-sm text-on-primary-fixed-variant">
          <span>Toca los productos que quieras editar en grupo.</span>
          <button type="button" onClick={() => props.onSelecting(false)} className="shrink-0 rounded-lg bg-white/70 px-2.5 py-1 text-label-md text-on-surface">
            Cancelar
          </button>
        </div>
      )}

      {props.bulkBar}

      {props.empty ?? (
        <>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2" aria-label="Productos">
            {props.visible.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                ctx={props.ctx}
                handlers={props.handlers}
                money={props.money}
                selecting={props.selecting}
                selected={props.selected.has(p.id)}
                onToggle={props.onToggle}
                onOpen={props.onOpen}
                highlight={exactMatch?.id === p.id}
                scanMode={scanMode}
              />
            ))}
          </ul>
          {props.filtered.length > props.visible.length && (
            <Button variant="soft" fullWidth onClick={props.onMore} iconRight={ChevronDown}>
              Ver más ({formatNumber(props.filtered.length - props.visible.length, props.ctx.locale)} restantes)
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SearchBar({
  search,
  onSearch,
  searchRef,
  exactMatch,
  onOpenMatch
}: {
  search: string;
  onSearch: (v: string) => void;
  searchRef: Ref<HTMLInputElement>;
  exactMatch: Product | null;
  onOpenMatch: () => void;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (exactMatch) onOpenMatch();
    } else if (e.key === 'Escape' && search) {
      e.preventDefault();
      onSearch('');
    }
  };
  // El botón de escáner deja el campo listo (y el texto seleccionado) para un lector de código de barras.
  const focusScan = (e: MouseEvent<HTMLButtonElement>) => {
    const input = e.currentTarget.parentElement?.querySelector('input');
    input?.focus();
    input?.select();
  };

  return (
    <div className="flex w-full items-center gap-1 rounded-xl bg-surface-container-lowest p-1.5 shadow-card focus-within:ring-2 focus-within:ring-primary/30">
      <Search className="ml-2 size-5 shrink-0 text-outline" aria-hidden />
      <input
        ref={searchRef}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Escanear o buscar SKU, nombre…"
        aria-label="Buscar producto por nombre, SKU o código de barras"
        className="min-w-0 flex-1 bg-transparent px-1 py-1 text-body-md text-on-surface placeholder:text-outline focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {search && (
        <button type="button" onClick={() => onSearch('')} aria-label="Limpiar búsqueda" className="shrink-0 rounded-lg p-1.5 text-outline hover:text-on-surface">
          <X className="size-4" />
        </button>
      )}
      <button
        type="button"
        onClick={focusScan}
        title="Escanear con lector de código de barras"
        aria-label="Escanear código de barras"
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-on-primary shadow-card transition-all active:scale-95"
      >
        <ScanBarcode className="size-5" aria-hidden />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FilterChips({
  filters,
  onFilters,
  onStatus,
  kpis,
  total,
  categories
}: {
  filters: Filters;
  onFilters: (patch: Partial<Filters>) => void;
  onStatus: (s: StatusFilter) => void;
  kpis: InventoryKpis;
  total: number;
  categories: string[];
}) {
  const inactive = total - kpis.activeCount;
  const chip = (active: boolean) =>
    cn(
      'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-label-md transition-all',
      active ? 'bg-primary text-on-primary shadow-card' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
    );
  const count = (n: number, active: boolean, tone = 'text-on-surface-variant') => (
    <span className={cn('rounded-full px-1.5 text-[10px] leading-4 font-bold tnum', active ? 'bg-white/20' : cn('bg-surface-container-lowest', tone))}>
      {formatNumber(n)}
    </span>
  );
  const status = (s: StatusFilter) => onStatus(filters.status === s ? 'all' : s);
  const alerts = kpis.lowCount + kpis.outCount;

  return (
    <div className="no-scrollbar -mx-4 flex items-center gap-1 overflow-x-auto px-4 py-0.5" role="toolbar" aria-label="Filtros rápidos">
      <button type="button" aria-pressed={filters.status === 'all' && !filters.category} onClick={() => onFilters({ status: 'all', category: '' })} className={chip(filters.status === 'all' && !filters.category)}>
        Todos {count(total, filters.status === 'all' && !filters.category)}
      </button>
      {alerts > 0 && (
        <button type="button" aria-pressed={filters.status === 'alert'} onClick={() => status('alert')} className={chip(filters.status === 'alert')}>
          <span className={cn('size-2 rounded-full', filters.status === 'alert' ? 'bg-white' : 'bg-tertiary-fixed-dim')} aria-hidden />
          Por reponer {count(alerts, filters.status === 'alert', 'text-tertiary')}
        </button>
      )}
      {kpis.outCount > 0 && (
        <button type="button" aria-pressed={filters.status === 'out'} onClick={() => status('out')} className={chip(filters.status === 'out')}>
          <span className={cn('size-2 rounded-full', filters.status === 'out' ? 'bg-white' : 'bg-error')} aria-hidden />
          Agotados {count(kpis.outCount, filters.status === 'out', 'text-error')}
        </button>
      )}
      {inactive > 0 && (
        <button type="button" aria-pressed={filters.status === 'inactive'} onClick={() => status('inactive')} className={chip(filters.status === 'inactive')}>
          Inactivos {count(inactive, filters.status === 'inactive')}
        </button>
      )}
      {categories.map((c) => (
        <button key={c} type="button" aria-pressed={filters.category === c} onClick={() => onFilters({ category: filters.category === c ? '' : c })} className={chip(filters.category === c)}>
          {c}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ValuationCard({
  kpis,
  loading,
  money,
  local,
  status,
  onStatus,
  locale
}: {
  kpis: InventoryKpis;
  loading: boolean;
  money: (n: number) => string;
  local: InventoryFx['local'];
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  locale: string;
}) {
  const active = Math.max(1, kpis.activeCount);
  const pct = (n: number) => (n / active) * 100;
  const toggle = (s: StatusFilter) => onStatus(status === s ? 'all' : s);
  // Con un filtro de estado activo se atenúan los demás ("Por reponer" = por agotarse + agotados).
  const dimmed = (s: StatusFilter) => (status === 'alert' ? s === 'ok' : status !== 'all' && status !== s);
  const legend = (s: StatusFilter) => cn('flex items-center gap-1 rounded transition-opacity', dimmed(s) && 'opacity-50');

  return (
    <MCard className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-label-sm tracking-wider text-outline uppercase">Valorización de almacén</span>
        {kpis.avgMargin !== null && (
          <span className="flex shrink-0 items-center gap-0.5 text-label-sm text-primary tnum" title="Margen promedio de los productos activos">
            <TrendingUp className="size-3.5" aria-hidden /> Margen {formatPercent(kpis.avgMargin, 1)}
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-40" />
      ) : (
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-1">
            <span className="truncate text-headline-lg-mobile text-on-surface tnum">{money(kpis.costValue)}</span>
            <span className="shrink-0 text-body-sm text-outline">costo total</span>
          </div>
          <span className="shrink-0 text-label-md text-on-surface tnum">{formatNumber(kpis.activeCount, locale)} SKUs</span>
        </div>
      )}
      {!loading && (
        <span className="truncate text-label-sm text-on-surface-variant tnum">
          {local ? `${local(kpis.costValue)} · ` : ''}A precio de venta: {money(kpis.saleValue)}
        </span>
      )}
      <div className="flex flex-col gap-1 pt-1">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-container" aria-hidden>
          <div className="h-full bg-primary" style={{ width: `${pct(kpis.okCount)}%` }} />
          <div className="h-full bg-tertiary-fixed-dim" style={{ width: `${pct(kpis.lowCount)}%` }} />
          <div className="h-full bg-error" style={{ width: `${pct(kpis.outCount)}%` }} />
        </div>
        <div className="flex items-center justify-between pt-0.5 text-label-sm">
          <button type="button" onClick={() => toggle('ok')} aria-pressed={status === 'ok'} className={cn(legend('ok'), 'text-primary')}>
            <span className="size-1.5 rounded-full bg-primary" aria-hidden /> <span className="tnum">{formatPercent(kpis.okPct, 1)}</span> Óptimo
          </button>
          <button type="button" onClick={() => toggle('low')} aria-pressed={status === 'low'} className={cn(legend('low'), 'text-tertiary')}>
            <span className="size-1.5 rounded-full bg-tertiary-fixed-dim" aria-hidden /> <span className="tnum">{formatNumber(kpis.lowCount)}</span> Por agotarse
          </button>
          <button type="button" onClick={() => toggle('out')} aria-pressed={status === 'out'} className={cn(legend('out'), 'text-error')}>
            <span className="size-1.5 rounded-full bg-error" aria-hidden /> <span className="tnum">{formatNumber(kpis.outCount)}</span> Agotados
          </button>
        </div>
      </div>
    </MCard>
  );
}

/* ------------------------------------------------------------------ */

function ListToolbar({ filtered, filters, onFilters, onClear, suppliers, ifx, tools, selecting, onSelecting, ctx }: InventoryMobileProps) {
  const sortLabel = SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? '';
  const extra = (filters.supplier ? 1 : 0) + (ifx.exemptUi && filters.tax ? 1 : 0);
  const iconBtn = 'relative flex size-8 items-center justify-center rounded-lg bg-surface-container text-on-surface transition-colors hover:bg-surface-container-high';

  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <span className="truncate text-label-md font-bold tracking-wider text-outline uppercase">
        {formatNumber(filtered.length, ctx.locale)} {filtered.length === 1 ? 'producto' : 'productos'}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <label className="relative flex h-8 items-center gap-1 rounded-lg bg-surface-container px-2 text-label-md text-on-surface">
          <ArrowUpDown className="size-3.5 shrink-0 text-on-surface-variant" aria-hidden />
          <span className="max-w-24 truncate">{sortLabel}</span>
          <select
            value={filters.sort}
            onChange={(e) => onFilters({ sort: e.target.value as Filters['sort'] })}
            aria-label="Ordenar productos"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <Popover
          panelClassName="w-72"
          trigger={({ open, toggle }) => (
            <button type="button" onClick={toggle} aria-expanded={open} aria-label="Más filtros" title="Más filtros" className={iconBtn}>
              <SlidersHorizontal className="size-4" aria-hidden />
              {extra > 0 && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-primary ring-2 ring-surface" aria-hidden />}
            </button>
          )}
        >
          {(close) => (
            <div className="flex flex-col gap-3 p-1.5">
              <label className="flex flex-col gap-1 text-label-md text-on-surface-variant">
                Proveedor
                <select
                  value={filters.supplier}
                  onChange={(e) => onFilters({ supplier: e.target.value })}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-body-md text-on-surface focus:border-primary focus:outline-none"
                >
                  <option value="">Todos</option>
                  <option value={NO_SUPPLIER}>Sin proveedor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {ifx.exemptUi && (
                <label className="flex flex-col gap-1 text-label-md text-on-surface-variant">
                  {ifx.taxName}
                  <select
                    value={filters.tax}
                    onChange={(e) => onFilters({ tax: e.target.value as TaxFilter })}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-body-md text-on-surface focus:border-primary focus:outline-none"
                  >
                    {taxOptions(ifx.taxName).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasActiveFilters(filters) && filters.sort === DEFAULT_FILTERS.sort}
                onClick={() => {
                  onClear();
                  onFilters({ sort: DEFAULT_FILTERS.sort });
                  close();
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </Popover>

        <Popover
          trigger={({ open, toggle }) => (
            <button type="button" onClick={toggle} aria-expanded={open} aria-haspopup="menu" aria-label="Herramientas del inventario" title="Importar, exportar y más" className={iconBtn}>
              <EllipsisVertical className="size-4" aria-hidden />
            </button>
          )}
        >
          {(close) => (
            <>
              {tools(close)}
              <div className="my-1 h-px bg-slate-100" role="separator" />
              <button
                type="button"
                onClick={() => {
                  close();
                  onSelecting(!selecting);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-label-lg text-on-surface hover:bg-surface-container-low"
              >
                <span className={cn('flex size-4 items-center justify-center rounded border-2', selecting ? 'border-primary bg-primary' : 'border-outline')} aria-hidden />
                {selecting ? 'Terminar selección' : 'Seleccionar varios'}
              </button>
            </>
          )}
        </Popover>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ProductCard({
  product: p,
  ctx,
  handlers,
  money,
  selecting,
  selected,
  onToggle,
  onOpen,
  highlight,
  scanMode
}: {
  product: Product;
  ctx: RowContext;
  handlers: ProductHandlers;
  money: (n: number) => string;
  selecting: boolean;
  selected: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onOpen: (p: Product) => void;
  highlight: boolean;
  scanMode: ScanMode | null;
}) {
  const inactive = p.active === false;
  const s = stockStatus(p);
  const stock = Number(p.stock) || 0;
  const min = Number(p.minStock) || 0;
  const severe = s === 'out' || stock <= min * 0.34;
  const qty = stockText(p, ctx.locale);
  const square =
    'flex size-8 items-center justify-center rounded-lg bg-surface-container text-on-surface transition-all hover:bg-surface-container-high active:scale-95 disabled:cursor-not-allowed disabled:opacity-40';

  const pill = inactive ? (
    <Pill tone="muted" size="md">
      Inactivo
    </Pill>
  ) : s === 'out' ? (
    <Pill tone="error" size="md" dot>
      Agotado (Mín: {formatNumber(min, ctx.locale)})
    </Pill>
  ) : s === 'low' ? (
    <Pill tone={severe ? 'error' : 'tertiary'} size="md" dot>
      <span className="tnum">
        {qty} ({severe ? 'Crítico' : `Mín: ${formatNumber(min, ctx.locale)}`})
      </span>
    </Pill>
  ) : (
    <Pill tone="success" size="md" dot>
      <span className="tnum">{qty}</span>
    </Pill>
  );

  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-3 shadow-card transition-colors',
        highlight && 'ring-2 ring-primary',
        selected && !highlight && 'ring-2 ring-primary/50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {selecting && (
          <input
            type="checkbox"
            className="mt-4 size-5 shrink-0 cursor-pointer rounded accent-primary"
            aria-label={`Seleccionar ${p.name}`}
            checked={selected}
            onChange={(e) => onToggle(p.id, e.target.checked)}
          />
        )}
        <button
          type="button"
          onClick={() => (selecting ? onToggle(p.id, !selected) : onOpen(p))}
          className="-m-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left transition-colors active:bg-surface-container-low"
          aria-label={selecting ? `Seleccionar ${p.name}` : `${scanMode === 'in' ? 'Registrar entrada de' : scanMode === 'adjust' ? 'Registrar conteo de' : ctx.canEdit ? 'Editar' : 'Ver'} ${p.name}`}
        >
          <span className={cn('shrink-0', inactive && 'opacity-60 grayscale')}>
            <ProductThumb product={p} size="md" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className={cn('truncate text-headline-sm', inactive ? 'text-on-surface-variant' : 'text-on-surface')}>{p.name}</span>
            <span className="flex min-w-0 items-center gap-1.5 text-label-sm">
              <span className="shrink-0 text-outline tnum">SKU {p.sku}</span>
              {(p.location || p.category) && (
                <>
                  <span className="text-outline-variant" aria-hidden>
                    •
                  </span>
                  <span className="flex min-w-0 items-center gap-0.5 text-on-surface-variant">
                    {p.location && <MapPin className="size-3 shrink-0" aria-hidden />}
                    <span className="truncate">{p.location || p.category}</span>
                  </span>
                </>
              )}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-headline-sm font-bold text-on-surface tnum">{money(p.salePrice)}</span>
          <span className="text-body-sm text-outline tnum">{ctx.local ? ctx.local(p.salePrice) : 'PVP'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-1 pt-1">
        <span className="min-w-0 truncate">{pill}</span>
        <div className="flex shrink-0 items-center gap-1">
          {ctx.canEdit && !inactive && !selecting && (
            s === 'ok' ? (
              <>
                <button
                  type="button"
                  onClick={() => handlers.onQuickAdjust(p, -1)}
                  disabled={ctx.blockNegative && stock - 1 < 0}
                  aria-label={`Restar 1 a ${p.name}`}
                  title="Restar 1"
                  className={square}
                >
                  <Minus className="size-[18px]" />
                </button>
                <button type="button" onClick={() => handlers.onQuickAdjust(p, 1)} aria-label={`Sumar 1 a ${p.name}`} title="Sumar 1" className={square}>
                  <Plus className="size-[18px]" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handlers.onMove(p, 'in')}
                title="Registrar entrada de mercancía"
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-label-sm shadow-card transition-all active:scale-95',
                  severe ? 'bg-error text-on-error hover:bg-red-700' : 'bg-tertiary text-on-tertiary hover:bg-tertiary-container'
                )}
              >
                <Truck className="size-4" aria-hidden />
                Reponer
              </button>
            )
          )}
          <ActionMenu label={`Más acciones para ${p.name}`} items={menuItemsFor(p, ctx, handlers)} className="bg-surface-container" />
        </div>
      </div>
    </li>
  );
}
