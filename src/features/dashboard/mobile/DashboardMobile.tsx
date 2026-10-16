import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { errorMessage } from '@/lib/utils';
import type { Product, Sale } from '@/types';
import type { DashboardMetrics, DashPreset } from '../useDashboardMetrics';
import { FxStrip } from './FxStrip';
import { HomeHeader } from './HomeHeader';
import { HomeKpis } from './HomeKpis';
import { LiveLog } from './LiveLog';
import { QuickAccess } from './QuickAccess';
import { SalesPulse } from './SalesPulse';
import { StockAlerts } from './StockAlerts';

/** Panel principal en el celular (ref/movil/dashboard_general_m_vil). */
export function DashboardMobile({
  preset,
  onPreset,
  metrics,
  catalog,
  mine,
  recent,
  recentLoading,
  onOpenSale,
  onDownload,
  onboarding,
  loadError,
  onEditRate,
  onRestock
}: {
  preset: DashPreset;
  onPreset: (p: DashPreset) => void;
  metrics: DashboardMetrics;
  catalog: { loading: boolean; activeCount: number; categoryCount: number; lowCount: number; outCount: number };
  mine: boolean;
  recent: Sale[];
  recentLoading: boolean;
  onOpenSale: (s: Sale) => void;
  onDownload: () => void;
  /** Checklist de arranque (negocios nuevos). */
  onboarding: ReactNode;
  loadError: Error | null;
  onEditRate: () => void;
  /** Registrar la entrada de mercancía de un producto con stock bajo. */
  onRestock: (p: Product) => void;
}) {
  const { can, money } = useActiveBusiness();
  const { lowStock, loading: catalogLoading } = useCatalog();

  return (
    <div className="flex flex-col gap-5 pt-2">
      <HomeHeader preset={preset} onPreset={onPreset} onDownload={onDownload} />

      {onboarding}

      {loadError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl bg-error-container/60 px-3 py-2.5 text-body-sm text-on-error-container">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            No pudimos cargar las ventas: <span className="font-semibold">{errorMessage(loadError)}</span>
          </p>
        </div>
      )}

      <FxStrip onEdit={onEditRate} />
      <HomeKpis preset={preset} metrics={metrics} catalog={catalog} mine={mine} money={money} />
      <QuickAccess />
      <SalesPulse preset={preset} metrics={metrics} money={money} />
      <StockAlerts lowStock={lowStock} loading={catalogLoading} canRestock={can('inventory')} onRestock={onRestock} />
      <LiveLog sales={recent} loading={recentLoading} mine={mine} canSell={can('pos')} money={money} onOpen={onOpenSale} />
    </div>
  );
}
