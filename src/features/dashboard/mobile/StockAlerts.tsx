import { Link } from 'react-router';
import { ArrowRight, BellRing, CircleCheck, PackagePlus } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { cn, stockStatus } from '@/lib/utils';
import type { Product } from '@/types';
import { ProductThumb, Skeleton } from '@/components/ui';
import { MCard, MSectionHeader, Pill } from '@/components/mobile';

/** Los productos más urgentes por reponer; "Reponer" registra la entrada de mercancía ahí mismo. */
export function StockAlerts({
  lowStock,
  loading,
  canRestock,
  onRestock
}: {
  lowStock: Product[];
  loading: boolean;
  canRestock: boolean;
  onRestock: (p: Product) => void;
}) {
  const top = lowStock.slice(0, 3);
  const outCount = lowStock.filter((p) => stockStatus(p) === 'out').length;

  return (
    <section className="flex flex-col gap-2" aria-label="Alertas de stock bajo">
      <MSectionHeader
        icon={BellRing}
        iconClassName={lowStock.length ? 'text-error' : 'text-primary'}
        title="Alertas de stock bajo"
        aside={
          !loading && lowStock.length > 0 ? <Pill tone={outCount > 0 ? 'error' : 'tertiary'}>{outCount > 0 ? 'Acción inmediata' : 'Revisar pronto'}</Pill> : undefined
        }
      />

      {loading ? (
        <div className="flex flex-col gap-1">
          {[0, 1].map((i) => (
            <MCard key={i} className="flex items-center gap-3">
              <Skeleton className="size-12 shrink-0" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </MCard>
          ))}
        </div>
      ) : top.length === 0 ? (
        <MCard className="flex items-center gap-3">
          <CircleCheck className="size-6 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-label-lg text-on-surface">Todo en orden</p>
            <p className="text-body-sm text-on-surface-variant">Ningún producto activo está por debajo de su mínimo.</p>
          </div>
        </MCard>
      ) : (
        <div className="flex flex-col gap-1">
          {top.map((p) => {
            const stock = Number(p.stock) || 0;
            const min = Number(p.minStock) || 0;
            const out = stock <= 0;
            const severe = out || stock <= min * 0.34;
            return (
              <MCard key={p.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ProductThumb product={p} size="md" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-headline-sm text-on-surface" title={p.name}>
                      {p.name}
                    </span>
                    <div className="mt-0.5 flex min-w-0 items-center gap-2">
                      <Pill tone={severe ? 'error' : 'tertiary'} dot>
                        <span className="tnum">{out ? 'Agotado' : `${formatNumber(stock)} disp.${severe ? ' (Crítico)' : ''}`}</span>
                      </Pill>
                      <span className="truncate text-label-sm text-outline tnum">
                        Mín. {formatNumber(min)}
                        {p.location ? ` · ${p.location}` : ''}
                      </span>
                    </div>
                  </div>
                </div>
                {canRestock ? (
                  <button
                    type="button"
                    onClick={() => onRestock(p)}
                    aria-label={`Registrar entrada de ${p.name}`}
                    className={cn(
                      'flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-label-md font-bold transition-all active:scale-95',
                      severe ? 'bg-primary text-on-primary shadow-card hover:bg-primary-container' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                    )}
                  >
                    <PackagePlus className="size-4" aria-hidden />
                    Reponer
                  </button>
                ) : (
                  <Link
                    to={`/inventario?q=${encodeURIComponent(p.sku || p.name)}`}
                    className="shrink-0 rounded-lg bg-surface-container-high px-3 py-1.5 text-label-md font-bold text-on-surface active:scale-95"
                  >
                    Ver
                  </Link>
                )}
              </MCard>
            );
          })}
          {lowStock.length > top.length && (
            <Link to="/inventario?estado=reponer" className="flex items-center justify-center gap-1 rounded-lg py-2 text-label-md text-primary hover:underline">
              Ver los {formatNumber(lowStock.length)} productos por reponer <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
