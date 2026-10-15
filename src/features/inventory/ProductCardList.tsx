import { formatNumber } from '@/lib/format';
import { cn, stockStatus } from '@/lib/utils';
import { MarginChip, PriceStack, ProductIdentity, RowActions, StockLevel } from './ProductParts';
import type { ProductListProps } from './ProductTable';

export const cardDomId = (id: string) => `inv-card-${id}`;

/** Lista compacta de tarjetas para móvil / tableta (mismas acciones que la tabla). */
export function ProductCardList({ products, ctx, handlers, selected, onToggle, onTogglePage, highlightId, money }: ProductListProps) {
  const selectedOnPage = products.filter((p) => selected.has(p.id)).length;
  const all = products.length > 0 && selectedOnPage === products.length;

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 self-start rounded-lg px-1 py-1 text-label-md text-on-surface-variant">
        <input
          type="checkbox"
          className="size-4 cursor-pointer rounded accent-primary"
          checked={all}
          ref={(el) => {
            if (el) el.indeterminate = selectedOnPage > 0 && !all;
          }}
          onChange={(e) => onTogglePage(e.target.checked)}
        />
        Seleccionar página
      </label>
      <ul className="flex flex-col gap-2.5">
        {products.map((p) => {
          const inactive = p.active === false;
          const out = !inactive && stockStatus(p) === 'out';
          const isSelected = selected.has(p.id);
          const supplier = ctx.supplierOf(p);
          return (
            <li
              key={p.id}
              className={cn(
                'rounded-xl border bg-white p-3 shadow-card transition-colors',
                out ? 'border-red-200 bg-red-50/40' : 'border-slate-200/80',
                isSelected && 'border-primary/40 bg-primary-fixed/10',
                highlightId === p.id && 'ring-2 ring-primary'
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  id={cardDomId(p.id)}
                  type="checkbox"
                  className="mt-4 size-4 shrink-0 cursor-pointer rounded accent-primary"
                  aria-label={`Seleccionar ${p.name}`}
                  checked={isSelected}
                  onChange={(e) => onToggle(p.id, e.target.checked)}
                />
                <ProductIdentity product={p} className="flex-1" />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <PriceStack product={p} money={money} local={ctx.local} align="start" className="gap-0.5" />
                  <MarginChip product={p} minMarginPct={ctx.minMarginPct} tax={ctx.tax} className="mt-1 self-start" />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <StockLevel product={p} locale={ctx.locale} />
                  <span className={cn('text-body-sm tnum', out ? 'font-semibold text-error' : 'text-on-surface-variant')}>
                    Mín. {formatNumber(p.minStock, ctx.locale)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-label-sm text-on-surface">{p.category || 'General'}</span>
                  <span className="truncate text-body-sm text-on-surface-variant">{supplier || 'Sin proveedor'}</span>
                </div>
                <RowActions product={p} ctx={ctx} handlers={handlers} compact />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
