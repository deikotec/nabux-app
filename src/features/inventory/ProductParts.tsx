import {
  Ban,
  Barcode,
  ClipboardCheck,
  Eye,
  EyeOff,
  History,
  Minus,
  PackageMinus,
  PackagePlus,
  Pencil,
  Plus,
  Trash,
  Truck
} from 'lucide-react';
import { Badge, ProductThumb, StockBadge, StockBar } from '@/components/ui';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';
import { cn, marginPct, stockStatus } from '@/lib/utils';
import type { Product } from '@/types';
import { ActionMenu, type ActionMenuItem } from './ActionMenu';
import { MARGIN_CHIP, marginTone, type MoveType } from './helpers';

/** Acciones disponibles sobre un producto (las implementa la página). */
export interface ProductHandlers {
  onEdit: (p: Product) => void;
  onMove: (p: Product, type: MoveType) => void;
  onKardex: (p: Product) => void;
  onQuickAdjust: (p: Product, delta: number) => void;
  onToggleActive: (p: Product) => void;
  onDelete: (p: Product) => void;
}

export interface RowContext {
  /** El usuario puede modificar inventario (`can('inventory')`). */
  canEdit: boolean;
  /** No permitir bajar de 0 con el ajuste rápido. */
  blockNegative: boolean;
  minMarginPct: number;
  locale: string;
  supplierOf: (p: Product) => string;
}

export function MarginChip({ product, minMarginPct, className }: { product: Product; minMarginPct: number; className?: string }) {
  const price = Number(product.salePrice) || 0;
  if (price <= 0) {
    return <span className={cn('inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-label-sm text-slate-500', className)}>Sin precio</span>;
  }
  const pct = marginPct(Number(product.costPrice) || 0, price);
  const tone = marginTone(pct, minMarginPct);
  return (
    <span
      className={cn('inline-flex rounded-md px-1.5 py-0.5 text-label-sm tnum', MARGIN_CHIP[tone], className)}
      title={tone === 'good' ? 'Margen saludable' : tone === 'warn' ? `Por debajo del mínimo recomendado (${minMarginPct}%)` : 'Sin ganancia: el costo iguala o supera el precio'}
    >
      {formatPercent(pct, 1, true)}
    </span>
  );
}

const stockText = { ok: 'text-on-surface', low: 'text-amber-700', out: 'text-error' } as const;

/** Cantidad + unidad + estado + barra de nivel (columna "Nivel de stock"). */
export function StockLevel({ product, locale, className }: { product: Product; locale: string; className?: string }) {
  const s = stockStatus(product);
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className={cn('text-label-lg whitespace-nowrap tnum', stockText[s])}>
          {formatNumber(product.stock, locale)} <span className="text-label-sm font-medium text-on-surface-variant">{product.unit || 'u'}</span>
        </span>
        <StockBadge product={product} />
      </div>
      <StockBar product={product} />
    </div>
  );
}

/** Miniatura + nombre + marca • SKU + código de barras. */
export function ProductIdentity({ product, className }: { product: Product; className?: string }) {
  const inactive = product.active === false;
  const out = !inactive && stockStatus(product) === 'out';
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <div className={cn('relative shrink-0', inactive && 'opacity-60 grayscale')}>
        <ProductThumb product={product} size="md" />
        {out && (
          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-error/15" aria-hidden>
            <Ban className="size-4 text-error" />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('truncate text-label-lg', inactive ? 'text-on-surface-variant' : 'text-on-surface')} title={product.name}>
            {product.name}
          </span>
          {inactive && (
            <Badge size="xs" tone="neutral">
              Inactivo
            </Badge>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-body-sm text-on-surface-variant">
          {product.brand && (
            <>
              <span className="truncate font-semibold text-on-surface/80">{product.brand}</span>
              <span aria-hidden>•</span>
            </>
          )}
          <span className="shrink-0 font-medium tnum">{product.sku}</span>
        </div>
        {product.barcode && (
          <span className="inline-flex items-center gap-1 text-body-sm text-slate-500 tnum">
            <Barcode className="size-3.5 shrink-0" aria-hidden />
            <span className="sr-only">Código de barras:</span>
            {product.barcode}
          </span>
        )}
      </div>
    </div>
  );
}

/** Proveedor + fecha de última entrada. */
export function LastRestock({ product, supplier }: { product: Product; supplier: string }) {
  const out = stockStatus(product) === 'out' && product.active !== false;
  return (
    <div className="flex min-w-0 flex-col">
      <span className={cn('truncate text-label-md', supplier ? 'text-on-surface' : 'font-normal text-slate-400')}>{supplier || 'Sin proveedor'}</span>
      <span className={cn('text-body-sm tnum', out ? 'font-semibold text-error' : 'text-on-surface-variant')}>
        {product.lastRestockAt ? formatDate(product.lastRestockAt) : 'Sin entradas'}
        {out && ' · Reordenar'}
      </span>
    </div>
  );
}

/** Stepper −/+ de ajuste rápido de stock. */
export function QuickStepper({ product, ctx, handlers }: { product: Product; ctx: RowContext; handlers: ProductHandlers }) {
  const stock = Number(product.stock) || 0;
  const minusDisabled = ctx.blockNegative && stock - 1 < 0;
  return (
    <div className="inline-flex items-center rounded-lg bg-surface-container-low p-0.5" role="group" aria-label={`Ajuste rápido de ${product.name}`}>
      <button
        type="button"
        onClick={() => handlers.onQuickAdjust(product, -1)}
        disabled={minusDisabled}
        aria-label={`Restar 1 a ${product.name}`}
        title="Restar 1"
        className="flex size-7 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-white hover:text-error disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="min-w-8 px-1 text-center text-label-md text-on-surface tnum" aria-live="polite">
        {formatNumber(stock, ctx.locale)}
      </span>
      <button
        type="button"
        onClick={() => handlers.onQuickAdjust(product, 1)}
        aria-label={`Sumar 1 a ${product.name}`}
        title="Sumar 1"
        className="flex size-7 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-white hover:text-primary"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export function menuItemsFor(product: Product, ctx: RowContext, handlers: ProductHandlers): ActionMenuItem[] {
  const kardex: ActionMenuItem = { label: 'Ver movimientos (kardex)', icon: History, onSelect: () => handlers.onKardex(product) };
  if (!ctx.canEdit) return [kardex];
  const active = product.active !== false;
  return [
    { label: 'Entrada de mercancía', icon: PackagePlus, onSelect: () => handlers.onMove(product, 'in') },
    { label: 'Salida / merma', icon: PackageMinus, onSelect: () => handlers.onMove(product, 'out') },
    { label: 'Ajuste por conteo', icon: ClipboardCheck, onSelect: () => handlers.onMove(product, 'adjust') },
    { ...kardex, separated: true },
    { label: 'Editar producto', icon: Pencil, onSelect: () => handlers.onEdit(product) },
    { label: active ? 'Desactivar' : 'Activar', icon: active ? EyeOff : Eye, onSelect: () => handlers.onToggleActive(product) },
    { label: 'Eliminar', icon: Trash, danger: true, separated: true, onSelect: () => handlers.onDelete(product) }
  ];
}

/** Botones de acción de una fila/tarjeta: stepper (o "Pedir" si está agotado), editar y menú. */
export function RowActions({ product, ctx, handlers, compact }: { product: Product; ctx: RowContext; handlers: ProductHandlers; compact?: boolean }) {
  const out = stockStatus(product) === 'out' && product.active !== false;
  return (
    <div className="flex items-center justify-end gap-1">
      {ctx.canEdit &&
        (out ? (
          <button
            type="button"
            onClick={() => handlers.onMove(product, 'in')}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-error-container px-2.5 text-label-md text-on-error-container transition-colors hover:bg-error hover:text-white"
            title="Registrar entrada de mercancía"
          >
            <Truck className="size-4" />
            Pedir
          </button>
        ) : (
          <QuickStepper product={product} ctx={ctx} handlers={handlers} />
        ))}
      {ctx.canEdit && !compact && (
        <button
          type="button"
          onClick={() => handlers.onEdit(product)}
          aria-label={`Editar ${product.name}`}
          title="Editar"
          className="inline-flex size-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
        >
          <Pencil className="size-4" />
        </button>
      )}
      <ActionMenu label={`Más acciones para ${product.name}`} items={menuItemsFor(product, ctx, handlers)} />
    </div>
  );
}
