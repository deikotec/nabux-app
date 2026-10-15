import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, CircleCheck, CircleDollarSign, Coins, Hourglass, TrendingUp, Warehouse, type LucideIcon } from 'lucide-react';
import { Badge, ProductThumb, Skeleton } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { InventoryHealth } from '../analytics';
import { plural } from '../format';
import { InlineEmpty, SectionCard, SectionHeader } from './Section';

function Metric({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: string; sub: ReactNode; tone: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-surface-container-low/70 p-3.5">
      <span className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
        <Icon className={cn('size-4 shrink-0', tone)} />
        <span className="truncate">{label}</span>
      </span>
      <span className="truncate text-headline-sm text-on-surface tnum sm:text-headline-md" title={value}>
        {value}
      </span>
      <span className="truncate text-body-sm text-on-surface-variant">{sub}</span>
    </div>
  );
}

export function InventoryHealthSection({
  health,
  loading,
  salesLoading,
  money,
  rangeLabel
}: {
  health: InventoryHealth;
  /** Catálogo cargando. */
  loading: boolean;
  /** Ventas del período cargando (necesarias para saber qué no rotó). */
  salesLoading: boolean;
  money: (n: number) => string;
  rangeLabel: string;
}) {
  return (
    <SectionCard>
      <SectionHeader
        size="lg"
        title="Salud del inventario"
        subtitle="Valorización actual del stock y productos que no se vendieron en el período"
        icon={Warehouse}
        actions={
          !loading && (
            <div className="flex flex-wrap items-center gap-1.5">
              {health.outCount > 0 && (
                <Badge tone="danger" dot>
                  {plural(health.outCount, 'agotado')}
                </Badge>
              )}
              {health.lowCount > 0 && (
                <Badge tone="warning" dot>
                  {health.lowCount} bajo mínimo
                </Badge>
              )}
              {health.outCount === 0 && health.lowCount === 0 && health.activeCount > 0 && (
                <Badge tone="success" dot>
                  Stock en niveles óptimos
                </Badge>
              )}
            </div>
          )
        }
      />

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />)
        ) : (
          <>
            <Metric
              icon={Coins}
              tone="text-primary"
              label="Valor a costo"
              value={money(health.costValue)}
              sub={
                <span className="tnum">
                  {formatNumber(health.unitsInStock)} uds · {health.activeCount} productos activos
                </span>
              }
            />
            <Metric icon={CircleDollarSign} tone="text-secondary" label="Valor a precio de venta" value={money(health.retailValue)} sub="Si se vende todo el stock actual" />
            <Metric
              icon={TrendingUp}
              tone="text-primary"
              label="Utilidad potencial"
              value={money(health.potentialProfit)}
              sub={<span className="tnum">Margen bruto {health.potentialMarginPct.toFixed(1)}%</span>}
            />
            <Metric
              icon={Hourglass}
              tone="text-tertiary"
              label="Sin rotación en el período"
              value={salesLoading ? '—' : money(health.idleValue)}
              sub={
                salesLoading ? (
                  'Calculando…'
                ) : (
                  <span className="tnum">
                    {health.idleCount} productos · {health.idleShare.toFixed(0)}% del valor
                  </span>
                )
              }
            />
          </>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col">
            <h3 className="text-headline-sm text-on-surface">Productos sin ventas en el período</h3>
            <p className="text-body-sm text-on-surface-variant">Top 8 por valor inmovilizado a costo · {rangeLabel}</p>
          </div>
          <Link to="/inventario" className="inline-flex items-center gap-1 text-label-md text-primary hover:underline">
            Ir a inventario <ArrowRight className="size-4" />
          </Link>
        </div>

        {loading || salesLoading ? (
          <div className="grid gap-2 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : health.idle.length === 0 ? (
          <InlineEmpty icon={CircleCheck}>
            {health.activeCount ? 'Todos los productos con existencias tuvieron al menos una venta en el período.' : 'Aún no hay productos en tu catálogo.'}
          </InlineEmpty>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {health.idle.map(({ product, value }) => (
              <li key={product.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 px-3 py-2.5 transition-colors hover:bg-slate-50/80">
                <div className="flex min-w-0 items-center gap-3">
                  <ProductThumb product={product} size="sm" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-label-lg text-on-surface" title={product.name}>
                      {product.name}
                    </span>
                    <span className="truncate text-body-sm text-on-surface-variant tnum">
                      {[product.sku, product.category].filter(Boolean).join(' · ') || 'Sin SKU'}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="text-label-lg text-on-surface tnum">{money(value)}</span>
                  <span className="text-body-sm text-on-surface-variant tnum">
                    {formatNumber(product.stock)} en stock
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
