import { Table, TD, TH, THead, TR } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { cn, stockStatus } from '@/lib/utils';
import type { Product } from '@/types';
import { LastRestock, MarginChip, PriceStack, ProductIdentity, RowActions, StockLevel, type ProductHandlers, type RowContext } from './ProductParts';

export interface ProductListProps {
  products: Product[];
  ctx: RowContext;
  handlers: ProductHandlers;
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  onTogglePage: (checked: boolean) => void;
  highlightId: string | null;
  money: (n: number) => string;
}

export const rowDomId = (id: string) => `inv-row-${id}`;

export function ProductTable({ products, ctx, handlers, selected, onToggle, onTogglePage, highlightId, money }: ProductListProps) {
  const selectedOnPage = products.filter((p) => selected.has(p.id)).length;
  const all = products.length > 0 && selectedOnPage === products.length;
  const some = selectedOnPage > 0 && !all;

  return (
    <Table className="rounded-xl border border-slate-200/80">
      <THead>
        <TH className="w-12 pr-0">
          <input
            type="checkbox"
            className="size-4 cursor-pointer rounded accent-primary"
            aria-label="Seleccionar todos los productos de esta página"
            checked={all}
            ref={(el) => {
              if (el) el.indeterminate = some;
            }}
            onChange={(e) => onTogglePage(e.target.checked)}
          />
        </TH>
        <TH>Producto e identificador</TH>
        <TH>Categoría</TH>
        <TH align="right">Venta / costo</TH>
        <TH align="right">Margen</TH>
        <TH>Nivel de stock</TH>
        <TH align="center" className="hidden xl:table-cell">
          Mín.
        </TH>
        <TH className="hidden xl:table-cell">Últ. reposición</TH>
        <TH align="right">Acciones</TH>
      </THead>
      <tbody>
        {products.map((p) => {
          const inactive = p.active === false;
          const out = !inactive && stockStatus(p) === 'out';
          const isSelected = selected.has(p.id);
          return (
            <TR
              key={p.id}
              highlight={out ? 'danger' : undefined}
              className={cn(
                isSelected && 'bg-primary-fixed/15 hover:bg-primary-fixed/20',
                highlightId === p.id && 'bg-primary-fixed/25 outline-2 -outline-offset-2 outline-primary'
              )}
            >
              <TD className="w-12 pr-0">
                <input
                  id={rowDomId(p.id)}
                  type="checkbox"
                  className="size-4 cursor-pointer rounded accent-primary"
                  aria-label={`Seleccionar ${p.name}`}
                  checked={isSelected}
                  onChange={(e) => onToggle(p.id, e.target.checked)}
                />
              </TD>
              <TD className="max-w-[320px] min-w-[240px]">
                <ProductIdentity product={p} />
              </TD>
              <TD>
                <span className="inline-flex max-w-40 truncate rounded-full bg-surface-container px-2.5 py-0.5 text-label-sm text-on-surface" title={p.category}>
                  {p.category || 'General'}
                </span>
              </TD>
              <TD align="right">
                <PriceStack product={p} money={money} local={ctx.local} />
              </TD>
              <TD align="right">
                <MarginChip product={p} minMarginPct={ctx.minMarginPct} tax={ctx.tax} />
              </TD>
              <TD>
                <StockLevel product={p} locale={ctx.locale} className="min-w-40" />
              </TD>
              <TD align="center" className={cn('hidden text-data-mono tnum xl:table-cell', out ? 'font-bold text-error' : 'text-on-surface-variant')}>
                {formatNumber(p.minStock, ctx.locale)}
              </TD>
              <TD className="hidden max-w-48 xl:table-cell">
                <LastRestock product={p} supplier={ctx.supplierOf(p)} />
              </TD>
              <TD align="right" className="pl-2">
                <RowActions product={p} ctx={ctx} handlers={handlers} />
              </TD>
            </TR>
          );
        })}
      </tbody>
    </Table>
  );
}
