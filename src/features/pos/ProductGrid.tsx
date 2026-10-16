import { memo } from 'react';
import { Calculator, ChevronDown, PenLine, Plus, SearchX } from 'lucide-react';
import { Button } from '@/components/ui';
import { formatNumber, initials } from '@/lib/format';
import { cn, stockStatus } from '@/lib/utils';
import type { Product } from '@/types';

interface ProductGridProps {
  products: Product[];
  /** Total de productos que coinciden con el filtro (antes de paginar). */
  matchCount: number;
  loading: boolean;
  cartQty: Map<string, number>;
  allowNegative: boolean;
  money: (n: number) => string;
  /** Equivalente en moneda local (Bs) bajo el precio; solo en modo bimonetario con tasa. */
  moneyLocal?: (n: number) => string;
  onAdd: (p: Product) => void;
  onFreeAmount: () => void;
  onShowMore: () => void;
  /** Texto de búsqueda activo (para el estado sin resultados). */
  query: string;
  category: string | null;
}

/** Mosaico de selección rápida: tarjeta de monto libre + productos activos. */
export function ProductGrid({
  products,
  matchCount,
  loading,
  cartQty,
  allowNegative,
  money,
  moneyLocal,
  onAdd,
  onFreeAmount,
  onShowMore,
  query,
  category
}: ProductGridProps) {
  const remaining = matchCount - products.length;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 @lg:grid-cols-3 @2xl:grid-cols-4 @5xl:grid-cols-5 sm:gap-3">
        <FreeAmountCard onClick={onFreeAmount} />
        {loading
          ? Array.from({ length: 7 }, (_, i) => <div key={i} className="h-[228px] animate-pulse rounded-2xl border border-slate-200/60 bg-white/70" />)
          : products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                inCart={cartQty.get(p.id) ?? 0}
                allowNegative={allowNegative}
                money={money}
                moneyLocal={moneyLocal}
                onAdd={onAdd}
              />
            ))}
      </div>

      {!loading && matchCount === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-8 text-center">
          <SearchX className="size-7 text-on-surface-variant" />
          <p className="text-label-lg text-on-surface">Sin resultados{query.trim() ? ` para “${query.trim()}”` : ''}</p>
          <p className="max-w-sm text-body-sm text-on-surface-variant">
            {category ? `Estás filtrando por “${category}”. Prueba con “Todos” o ` : 'Prueba '}
            con otro nombre, SKU o código de barras. También puedes cobrar un monto libre<span className="pointer-coarse:hidden"> (F3)</span>.
          </p>
        </div>
      )}

      {!loading && remaining > 0 && (
        <div className="flex flex-col items-center gap-1.5">
          <Button variant="secondary" icon={ChevronDown} onClick={onShowMore}>
            Mostrar más productos
          </Button>
          <span className="text-body-sm text-on-surface-variant tnum">
            Mostrando {formatNumber(products.length)} de {formatNumber(matchCount)} · escribe para filtrar más rápido
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const STOCK_PILL = {
  ok: { pill: 'bg-primary-fixed text-on-primary-fixed', dot: 'bg-primary' },
  low: { pill: 'bg-tertiary-fixed text-on-tertiary-fixed-variant', dot: 'bg-tertiary' },
  out: { pill: 'bg-error-container text-on-error-container', dot: 'bg-error' }
} as const;

const PLACEHOLDER_TONES = ['text-secondary', 'text-primary', 'text-tertiary', 'text-violet-600', 'text-rose-600'];

function toneFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_TONES[h % PLACEHOLDER_TONES.length];
}

/** Iniciales de las dos primeras palabras con letras ("Agua Natural 1.5L" → "AN"). */
function productInitials(name: string) {
  const words = name.split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  const letters = words.slice(0, 2).map((w) => w[0]);
  return letters.length ? letters.join('').toUpperCase() : initials(name);
}

const ProductCard = memo(function ProductCard({
  product: p,
  inCart,
  allowNegative,
  money,
  moneyLocal,
  onAdd
}: {
  product: Product;
  inCart: number;
  allowNegative: boolean;
  money: (n: number) => string;
  moneyLocal?: (n: number) => string;
  onAdd: (p: Product) => void;
}) {
  const status = stockStatus(p);
  const stock = Number(p.stock) || 0;
  const blocked = !allowNegative && stock - inCart <= 0;
  const tone = STOCK_PILL[status];
  const price = money(p.salePrice);
  const local = moneyLocal ? moneyLocal(Number(p.salePrice) || 0) : null;
  return (
    <button
      type="button"
      onClick={() => onAdd(p)}
      aria-label={`Agregar ${p.name}, ${price}${local ? ` (${local})` : ''}${p.taxExempt ? ', exento de IVA' : ''}${status === 'out' ? ', agotado' : `, ${formatNumber(stock)} disponibles`}`}
      aria-disabled={blocked || undefined}
      className={cn(
        'group relative flex min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-2 text-left shadow-card transition-all',
        'hover:-translate-y-px hover:border-slate-300 hover:shadow-lift active:translate-y-0 active:scale-[0.985]',
        blocked && 'opacity-60 hover:translate-y-0'
      )}
    >
      <div className="relative h-28 w-full overflow-hidden rounded-xl bg-surface-container-high">
        {p.imageUrl ? (
          <img src={p.imageUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className={cn('flex size-full items-center justify-center', toneFor(p.category || p.name))}>
            <span className="text-headline-lg tracking-tight">{productInitials(p.name)}</span>
          </div>
        )}
        <span
          className={cn(
            'absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-card tnum',
            tone.pill
          )}
        >
          <span className={cn('size-1.5 rounded-full', tone.dot)} />
          {status === 'out' ? 'Agotado' : `${formatNumber(stock)} disp.`}
        </span>
        {inCart > 0 && (
          <span className="absolute top-1.5 right-1.5 rounded-full bg-inverse-surface px-2 py-0.5 text-[10px] font-bold text-white shadow-card tnum">
            ×{formatNumber(inCart)}
          </span>
        )}
      </div>
      <div className="mt-2 flex min-w-0 flex-col px-0.5">
        <span className="truncate text-[11px] font-medium text-on-surface-variant tnum">
          {p.sku ? `SKU: ${p.sku}` : p.category || '—'}
          {p.taxExempt && <span className="font-bold text-on-tertiary-fixed-variant" title="Exento de IVA"> · (E)</span>}
        </span>
        <span className="line-clamp-2 min-h-[2.5em] text-[13px] leading-tight font-semibold text-on-surface" title={p.name}>
          {p.name}
        </span>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 px-0.5 pt-2">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-headline-md font-bold text-on-surface tnum" title={price}>
            {price}
          </span>
          {local && (
            <span className="truncate text-[11px] leading-tight font-semibold text-secondary tnum" title={local}>
              {local}
            </span>
          )}
        </span>
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface shadow-card transition-colors group-hover:bg-primary group-hover:text-white"
        >
          <Plus className="size-5" />
        </span>
      </div>
    </button>
  );
});

function FreeAmountCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Agregar monto libre: venta no catalogada (F3)"
      className="group flex min-w-0 flex-col rounded-2xl border border-dashed border-primary/30 bg-surface-container p-2 text-left shadow-card transition-colors hover:bg-surface-container-high"
    >
      <div className="flex h-28 flex-col items-center justify-center gap-1 rounded-xl bg-white/80 text-primary">
        <Calculator className="size-9 transition-transform group-hover:scale-110" />
        <span className="text-label-sm text-on-surface-variant uppercase">Monto libre</span>
      </div>
      <div className="mt-2 flex flex-col items-center px-0.5 text-center">
        <span className="text-[13px] leading-tight font-semibold text-on-surface">Venta no catalogada</span>
        <span className="text-[11px] text-on-surface-variant">Digita el precio directo</span>
      </div>
      <span className="mt-auto pt-2">
        <span className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-container py-1.5 text-label-md text-on-primary-container transition-colors group-hover:bg-primary">
          <PenLine className="size-4" />
          Monto<span className="pointer-coarse:hidden"> (F3)</span>
        </span>
      </span>
    </button>
  );
}
