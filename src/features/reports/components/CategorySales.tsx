import { Tags } from 'lucide-react';
import { BarList, CHART_COLORS } from '@/components/charts';
import { formatNumber } from '@/lib/format';
import type { CategoryStat } from '../analytics';
import { InlineEmpty, ListSkeleton, SectionCard, SectionHeader } from './Section';

export function CategorySales({ stats, loading, money, className }: { stats: CategoryStat[]; loading: boolean; money: (n: number) => string; className?: string }) {
  return (
    <SectionCard className={className}>
      <SectionHeader title="Ventas por categoría" subtitle="Participación en ingresos y margen por familia de productos" icon={Tags} />
      {loading ? (
        <ListSkeleton rows={5} />
      ) : stats.length === 0 ? (
        <InlineEmpty icon={Tags}>Sin ventas por categoría en este período.</InlineEmpty>
      ) : (
        <BarList
          items={stats.map((c, i) => ({
            label: c.category,
            value: c.revenue,
            display: money(c.revenue),
            color: CHART_COLORS[i % CHART_COLORS.length],
            sub: (
              <span className="tnum">
                {c.share.toFixed(1)}% del total · {formatNumber(c.units)} uds · margen{' '}
                <span className={c.marginPct < 0 ? 'text-error' : 'text-primary'}>{c.marginPct.toFixed(0)}%</span>
              </span>
            )
          }))}
        />
      )}
    </SectionCard>
  );
}
