import { useMemo, useState } from 'react';
import { Download, TriangleAlert } from 'lucide-react';
import { ROLE_LABELS } from '@/config/app';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useFx } from '@/contexts/FxContext';
import { useRecentSales } from '@/hooks/data';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { dayKey } from '@/lib/dates';
import { firstName, formatNumber, greeting } from '@/lib/format';
import { errorMessage } from '@/lib/utils';
import { Button, PageHeader, Segmented, useToast, type TabOption } from '@/components/ui';
import type { Sale } from '@/types';
import { StockAdjustModal } from '@/features/inventory/StockAdjustModal';
import { SaleDetailModal } from '@/features/sales/SaleDetailModal';
import { exportSalesCsv } from '@/features/sales/saleUtils';
import { FxRateCard } from './FxRateCard';
import { GettingStartedCard } from './GettingStartedCard';
import { KpiGrid } from './KpiGrid';
import { DashboardMobile } from './mobile/DashboardMobile';
import { LowStockCard } from './LowStockCard';
import { QuickActionsCard } from './QuickActionsCard';
import { RateEditorModal } from './RateEditorModal';
import { RecentSalesCard } from './RecentSalesCard';
import { RevenueCard } from './RevenueCard';
import { TopCategoriesCard } from './TopCategoriesCard';
import { PRESET_COPY, useDashboardMetrics, type DashPreset } from './useDashboardMetrics';

const PRESET_OPTIONS: TabOption<DashPreset>[] = (Object.keys(PRESET_COPY) as DashPreset[]).map((value) => ({
  value,
  label: PRESET_COPY[value].label
}));

export default function DashboardPage() {
  const { business, member, role, can, money, moneyCompact } = useActiveBusiness();
  const { products, lowStock, outOfStock, loading: catalogLoading } = useCatalog();
  const fx = useFx();
  const toast = useToast();
  const desktop = useIsDesktop();
  const [preset, setPreset] = useState<DashPreset>('today');
  const [selected, setSelected] = useState<Sale | null>(null);
  const [rateEditor, setRateEditor] = useState(false);
  /** Producto al que se le registra la entrada desde las alertas del móvil. */
  const [restockId, setRestockId] = useState<string | null>(null);

  // Sin permiso de reportes los hooks ya devuelven solo las ventas del usuario.
  const mine = !can('reports');
  const metrics = useDashboardMetrics(preset);
  const recent = useRecentSales(6);
  const copy = PRESET_COPY[preset];

  const catalog = useMemo(() => {
    const active = products.filter((p) => p.active !== false);
    return {
      loading: catalogLoading,
      activeCount: active.length,
      categoryCount: new Set(active.map((p) => p.category).filter(Boolean)).size,
      valuation: active.reduce((a, p) => a + Math.max(0, Number(p.stock) || 0) * (Number(p.costPrice) || 0), 0),
      lowCount: lowStock.length,
      outCount: outOfStock.length
    };
  }, [products, lowStock.length, outOfStock.length, catalogLoading]);

  // En modo bimonetario se espera a conocer la tasa para no marcar ese paso como pendiente por un instante.
  const showOnboarding =
    !catalogLoading && !recent.loading && !recent.error && !(fx.enabled && fx.loading) && (products.length === 0 || recent.data.length === 0);

  // Venta abierta tomada de las listas en tiempo real (refleja anulaciones al instante).
  const selectedSale = selected
    ? (recent.data.find((s) => s.id === selected.id) ?? metrics.periodSales.find((s) => s.id === selected.id) ?? selected)
    : null;

  const downloadSummary = () => {
    if (!metrics.periodSales.length) {
      toast.info(`No hay ventas ${copy.period} para descargar.`);
      return;
    }
    exportSalesCsv(`resumen-ventas-${copy.file}-${dayKey(new Date())}.csv`, metrics.periodSales, {
      includeProfit: !mine,
      dual: fx.enabled,
      methods: fx.allMethods,
      baseCurrency: fx.baseCurrency,
      localCurrency: fx.localCurrency
    });
    toast.success(`Resumen descargado (${formatNumber(metrics.periodSales.length)} ventas).`);
  };

  // Paso "Configura la tasa de cambio": primero intenta traerla de internet; si no se puede, se carga a mano.
  const setupRates = async () => {
    try {
      const r = await fx.refreshFromInternet();
      if (r.bcv || r.parallel) toast.success('Tasa del día cargada desde internet.');
      else setRateEditor(true);
    } catch (e) {
      toast.error(`${errorMessage(e)} Cárgala a mano.`);
      setRateEditor(true);
    }
  };

  const loadError = metrics.error ?? recent.error;
  const onboarding = showOnboarding ? <GettingStartedCard productCount={products.length} recentSales={recent.data} onSetupRates={setupRates} /> : null;
  const modals = (
    <>
      <SaleDetailModal sale={selectedSale} onClose={() => setSelected(null)} />
      {fx.enabled && fx.canEditRates && <RateEditorModal open={rateEditor} onClose={() => setRateEditor(false)} />}
      {restockId && <StockAdjustModal productId={restockId} initialType="in" onClose={() => setRestockId(null)} />}
    </>
  );

  const mobile = desktop ? null : (
    <DashboardMobile
      preset={preset}
      onPreset={setPreset}
      metrics={metrics}
      catalog={catalog}
      mine={mine}
      recent={recent.data}
      recentLoading={recent.loading}
      onOpenSale={setSelected}
      onDownload={downloadSummary}
      onboarding={onboarding}
      loadError={loadError}
      onEditRate={() => setRateEditor(true)}
      onRestock={(p) => setRestockId(p.id)}
    />
  );

  // Los modales quedan siempre en la misma posición: al cruzar 1024 px (girar una tableta) no se pierde lo escrito en ellos.
  return (
    <>
      {mobile ?? (
        <>
          <PageHeader
            eyebrow={`${business.name} • ${role ? ROLE_LABELS[role] : 'Equipo'}`}
            title={`${greeting()}, ${firstName(member.displayName) || 'bienvenido'}`}
            description={
              mine
                ? 'Aquí tienes tus ventas y el estado del inventario en tiempo real.'
                : 'Aquí tienes la actividad operativa en tiempo real y el rendimiento de stock de tu negocio.'
            }
            actions={
              <>
                <Segmented options={PRESET_OPTIONS} value={preset} onChange={setPreset} />
                <Button variant="secondary" icon={Download} onClick={downloadSummary} disabled={metrics.loading}>
                  Descargar resumen
                </Button>
              </>
            }
          />

          <div className="flex flex-col gap-6">
            {onboarding}

            {loadError && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-md text-red-900">
                <TriangleAlert className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
                <p>
                  No pudimos cargar las ventas: <span className="font-semibold">{errorMessage(loadError)}</span>
                </p>
              </div>
            )}

            {fx.enabled && <FxRateCard onEdit={() => setRateEditor(true)} />}

            <KpiGrid preset={preset} metrics={metrics} mine={mine} catalog={catalog} money={money} />

            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
              <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
                <RevenueCard preset={preset} metrics={metrics} money={money} moneyCompact={moneyCompact} />
                <RecentSalesCard sales={recent.data} loading={recent.loading} mine={mine} canSell={can('pos')} money={money} onOpen={setSelected} />
              </div>

              <div className="grid min-w-0 grid-cols-1 items-start gap-6 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
                <QuickActionsCard />
                <LowStockCard lowStock={lowStock} loading={catalogLoading} canRestock={can('inventory')} />
                <TopCategoriesCard categories={metrics.categories} loading={metrics.loading} preset={preset} mine={mine} money={money} />
              </div>
            </div>
          </div>
        </>
      )}
      {modals}
    </>
  );
}
