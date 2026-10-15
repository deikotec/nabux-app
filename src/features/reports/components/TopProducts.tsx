import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, PackageSearch, Trophy } from 'lucide-react';
import { Segmented, type TabOption } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { topProducts, type ProductSort, type ProductStat } from '../analytics';
import { InlineEmpty, ListSkeleton, SectionCard, SectionHeader } from './Section';

const SORT_OPTIONS: TabOption<ProductSort>[] = [
  { value: 'revenue', label: 'Ingresos' },
  { value: 'units', label: 'Unidades' },
  { value: 'profit', label: 'Utilidad' }
];

export function TopProducts({
  stats,
  loading,
  money,
  minMarginPct
}: {
  stats: ProductStat[];
  loading: boolean;
  money: (n: number) => string;
  /** Margen mínimo recomendado del negocio (para colorear el margen). */
  minMarginPct: number;
}) {
  const [sort, setSort] = useState<ProductSort>('revenue');
  const top = useMemo(() => topProducts(stats, sort, 5), [stats, sort]);

  const marginTone = (m: number) => (m < 0 ? 'text-error' : m < minMarginPct ? 'text-tertiary-container' : 'text-primary');

  return (
    <SectionCard>
      <SectionHeader title="Top 5 productos" subtitle="Volumen vendido vs utilidad neta" icon={Trophy} />
      <Segmented options={SORT_OPTIONS} value={sort} onChange={setSort} size="sm" className="mb-3 self-start" />

      {loading ? (
        <ListSkeleton />
      ) : top.length === 0 ? (
        <InlineEmpty icon={PackageSearch}>Aún no hay productos vendidos en este período.</InlineEmpty>
      ) : (
        <ol className="flex flex-col gap-1">
          {top.map((p, i) => {
            const primary = sort === 'units' ? `${formatNumber(p.units)} uds` : money(sort === 'profit' ? p.profit : p.revenue);
            const sub = sort === 'units' ? `${money(p.revenue)} en ventas` : `${formatNumber(p.units)} uds vendidas`;
            return (
              <li key={p.key} className="flex items-center justify-between gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-surface-container-low">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full text-label-sm tnum',
                      i === 0 ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-surface-container-high text-on-surface'
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-label-lg text-on-surface" title={p.name}>
                      {p.name}
                    </span>
                    <span className="truncate text-body-sm text-on-surface-variant tnum">
                      {sub}
                      {p.category ? ` · ${p.category}` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="text-label-lg text-on-surface tnum">{primary}</span>
                  <span className={cn('text-label-sm tnum', marginTone(p.marginPct))}>{p.marginPct.toFixed(0)}% margen</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-auto pt-3">
        <Link
          to="/inventario"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-surface-container py-2 text-label-md text-primary transition-colors hover:bg-surface-container-high"
        >
          Ver catálogo completo <ArrowRight className="size-4" />
        </Link>
      </div>
    </SectionCard>
  );
}
