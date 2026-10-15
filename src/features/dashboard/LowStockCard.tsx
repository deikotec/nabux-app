import { Link } from 'react-router';
import { BellRing, CircleCheck, PackagePlus } from 'lucide-react';
import { Badge, Card, ProductThumb, ProgressBar, Skeleton } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { cn, stockStatus } from '@/lib/utils';
import type { Product } from '@/types';

/** Productos activos en o por debajo del mínimo (los 5 más urgentes). */
export function LowStockCard({ lowStock, loading, canRestock }: { lowStock: Product[]; loading: boolean; canRestock: boolean }) {
  const top = lowStock.slice(0, 5);
  const outCount = lowStock.filter((p) => stockStatus(p) === 'out').length;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-headline-sm text-on-surface">
          <BellRing className={cn('size-5', lowStock.length ? 'text-error' : 'text-primary')} aria-hidden />
          Productos por agotarse
        </h2>
        {!loading && lowStock.length > 0 && (
          <Badge tone={outCount > 0 ? 'danger' : 'warning'}>{outCount > 0 ? 'Crítico' : 'Atención'}</Badge>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-12 shrink-0" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-2 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : top.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900">
          <CircleCheck className="size-6 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <p className="text-label-lg">Todo en orden</p>
            <p className="text-body-sm text-emerald-800">Ningún producto activo está por debajo de su stock mínimo.</p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100">
          {top.map((p) => {
            const stock = Number(p.stock) || 0;
            const min = Number(p.minStock) || 0;
            const out = stock <= 0;
            const severe = out || stock <= min * 0.34;
            return (
              <li key={p.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <ProductThumb product={p} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-label-lg text-on-surface" title={p.name}>
                      {p.name}
                    </p>
                    <p className="text-body-sm text-on-surface-variant tnum">
                      <span className={cn('font-semibold', severe ? 'text-error' : 'text-tertiary-container')}>
                        {out ? 'Agotado' : `${formatNumber(stock)} disp.`}
                      </span>{' '}
                      / mínimo {formatNumber(min)}
                    </p>
                    {(p.supplierName || p.sku) && (
                      <p className="truncate text-body-sm text-on-surface-variant">{p.supplierName ? `Proveedor: ${p.supplierName}` : `SKU ${p.sku}`}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ProgressBar value={Math.max(0, stock)} max={Math.max(1, min)} tone={severe ? 'error' : 'tertiary'} className="min-w-0 flex-1" />
                  <Link
                    to={`/inventario?q=${encodeURIComponent(p.sku || p.name)}`}
                    aria-label={`${canRestock ? 'Reabastecer' : 'Ver'} ${p.name} en inventario`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-surface-container-low px-2 py-1 text-label-sm text-primary transition-colors hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                  >
                    <PackagePlus className="size-3.5" aria-hidden />
                    {canRestock ? 'Reabastecer' : 'Ver en inventario'}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && lowStock.length > top.length && (
        <Link
          to="/inventario?estado=bajo"
          className="rounded-lg py-1 text-center text-label-md text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          Ver los {formatNumber(lowStock.length)} productos con stock bajo
        </Link>
      )}
    </Card>
  );
}
