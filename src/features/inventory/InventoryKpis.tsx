import type { ReactNode } from 'react';
import { CircleCheck, DollarSign, PackageX, TriangleAlert } from 'lucide-react';
import { KpiCard } from '@/components/ui';
import { formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { InventoryKpis as Kpis, StatusFilter } from './helpers';

interface Props {
  kpis: Kpis;
  loading: boolean;
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  money: (n: number) => string;
  locale: string;
}

function Chip({ className, children }: { className: string; children: ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-label-sm tracking-normal', className)}>{children}</span>;
}

function Label({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('text-label-sm tracking-wider uppercase', className)}>{children}</span>;
}

/** Envuelve una KPI en un botón accesible que aplica (o quita) el filtro de estado. */
function KpiButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-pressed={active}
      title={active ? 'Quitar filtro' : `Filtrar: ${label}`}
      className="h-full rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {children}
    </div>
  );
}

export function InventoryKpis({ kpis, loading, status, onStatus, money, locale }: Props) {
  const toggle = (s: StatusFilter) => onStatus(status === s ? 'all' : s);
  const card = (active: boolean) => cn('h-full cursor-pointer hover:shadow-lift', active && 'border-primary/50 ring-2 ring-primary/40');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiButton active={status === 'ok'} onClick={() => toggle('ok')} label="stock óptimo">
        <KpiCard
          className={card(status === 'ok')}
          loading={loading}
          icon={CircleCheck}
          tone="primary"
          label={<Label>Stock óptimo</Label>}
          value={
            <span className="flex items-baseline gap-2">
              {formatNumber(kpis.okCount, locale)}
              <Chip className="bg-primary-fixed/70 text-on-primary-fixed">
                <span className="size-1.5 rounded-full bg-primary" />
                {formatPercent(kpis.okPct, 1)}
              </Chip>
            </span>
          }
          footer={`Sin riesgo de desabasto · de ${formatNumber(kpis.activeCount, locale)} activos`}
        />
      </KpiButton>

      <KpiButton active={status === 'low'} onClick={() => toggle('low')} label="por agotarse">
        <KpiCard
          className={card(status === 'low')}
          loading={loading}
          icon={TriangleAlert}
          tone="tertiary"
          label={<Label className="text-tertiary">Por agotarse</Label>}
          value={
            <span className={cn('flex items-baseline gap-2', kpis.lowCount > 0 && 'text-tertiary-container')}>
              {formatNumber(kpis.lowCount, locale)}
              {kpis.lowCount > 0 && <Chip className="bg-tertiary-fixed text-on-tertiary-fixed-variant">Atención</Chip>}
            </span>
          }
          footer="En o debajo del mínimo, aún con existencias"
        />
      </KpiButton>

      <KpiButton active={status === 'out'} onClick={() => toggle('out')} label="agotados">
        <KpiCard
          className={card(status === 'out')}
          loading={loading}
          icon={PackageX}
          tone="error"
          label={<Label className="text-error">Quiebre / agotados</Label>}
          value={
            <span className={cn('flex items-baseline gap-2', kpis.outCount > 0 && 'text-error')}>
              {formatNumber(kpis.outCount, locale)}
              {kpis.outCount > 0 && <Chip className="bg-error-container text-on-error-container">Crítico</Chip>}
            </span>
          }
          footer={kpis.outCount > 0 ? 'Sin existencias para vender: hay que reponer' : 'Ningún producto activo agotado'}
        />
      </KpiButton>

      <KpiCard
        className="h-full"
        loading={loading}
        icon={DollarSign}
        tone="secondary"
        label={<Label>Valorización de stock</Label>}
        value={<span title="Valor del inventario a precio de costo">{money(kpis.costValue)}</span>}
        footer={
          <span className="flex flex-wrap gap-x-2">
            <span>
              A precio de venta: <b className="text-on-surface tnum">{money(kpis.saleValue)}</b>
            </span>
            <span>
              Margen prom.:{' '}
              <b className="text-primary tnum">{kpis.avgMargin === null ? '—' : formatPercent(kpis.avgMargin, 1, true)}</b>
            </span>
          </span>
        }
      />
    </div>
  );
}
