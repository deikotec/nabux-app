import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChartColumn, ShoppingCart, TriangleAlert } from 'lucide-react';
import { Button, Card, EmptyState, useToast } from '@/components/ui';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useClosedCashSessions, useSalesRange } from '@/hooks/data';
import { addDays, dayKey, endOfDay, fromInputDate, previousRange, rangeFromPreset, startOfDay, toInputDate, type DateRange } from '@/lib/dates';
import { errorMessage } from '@/lib/utils';
import {
  buildTimeSeries,
  compareLabel,
  formatRangeLabel,
  groupByDay,
  inventoryHealth,
  pickGranularity,
  productPerformance,
  rangeDayCount,
  salesByCashier,
  salesByCategory,
  salesByPaymentMethod,
  shrinkFromMovements,
  soldProductIds,
  summarizeSales,
  weeklyHeatmap
} from './analytics';
import { cashSessionsCsv, dailySummaryCsv, downloadCsv, productPerformanceCsv, rangeSlug, salesDetailCsv } from './exporters';
import { useDailyGoal, useNow, useRangeMovements } from './hooks';
import { CashClosings } from './components/CashClosings';
import { CashierPerformance } from './components/CashierPerformance';
import { CategorySales } from './components/CategorySales';
import { InventoryHealthSection } from './components/InventoryHealthSection';
import { KpiGrid } from './components/KpiGrid';
import { PaymentMethods } from './components/PaymentMethods';
import { PerformanceChart } from './components/PerformanceChart';
import { ReportsHeader, type CustomRangeInput, type ExportKind, type ReportPreset } from './components/ReportsHeader';
import { TopProducts } from './components/TopProducts';
import { TrafficHeatmap } from './components/TrafficHeatmap';

/** Convierte el rango personalizado (yyyy-mm-dd) en fechas, ordenándolas y sin pasar de hoy. */
function customToRange(c: CustomRangeInput): DateRange {
  let a = startOfDay(fromInputDate(c.from));
  let b = endOfDay(fromInputDate(c.to));
  if (a > b) [a, b] = [startOfDay(b), endOfDay(a)];
  const limit = endOfDay(new Date());
  if (b > limit) b = limit;
  if (a > b) a = startOfDay(b);
  return { from: a, to: b };
}

export default function ReportsPage() {
  const { business, businessId, money, moneyCompact, currencySymbol, can } = useActiveBusiness();
  const { products, productsById, loading: catalogLoading } = useCatalog();
  const toast = useToast();
  const navigate = useNavigate();
  const now = useNow();
  const todayKey = dayKey(now);
  const hourKey = `${todayKey}-${now.getHours()}`;

  const [preset, setPreset] = useState<ReportPreset>('month');
  const [custom, setCustom] = useState<CustomRangeInput>(() => ({ from: toInputDate(addDays(new Date(), -13)), to: toInputDate(new Date()) }));
  const [compare, setCompare] = useState(true);
  const [goal, setGoal] = useDailyGoal(businessId);

  // `todayKey` hace que los rangos relativos ("Hoy", "Este mes"…) avancen solos al cambiar el día.
  const range = useMemo<DateRange>(
    () => (preset === 'custom' ? customToRange(custom) : rangeFromPreset(preset)),
    [preset, custom, todayKey]
  );
  const prevRange = useMemo(() => previousRange(range), [range]);

  /* ---------- Datos ---------- */
  const salesQ = useSalesRange(range);
  const prevQ = useSalesRange(compare ? prevRange : null);
  const shrinkQ = useRangeMovements(businessId, range);
  const sessionsQ = useClosedCashSessions(30);

  /* ---------- Agregaciones (memoizadas) ---------- */
  const summary = useMemo(() => summarizeSales(salesQ.data), [salesQ.data]);
  const prevSummary = useMemo(() => (compare ? summarizeSales(prevQ.data) : null), [compare, prevQ.data]);
  const granularity = useMemo(() => pickGranularity(preset, range), [preset, range]);
  const series = useMemo(
    () => buildTimeSeries(salesQ.data, range, granularity, new Date()),
    [salesQ.data, range, granularity, hourKey]
  );
  const productStats = useMemo(() => productPerformance(salesQ.data, productsById), [salesQ.data, productsById]);
  const categoryStats = useMemo(() => salesByCategory(productStats), [productStats]);
  const paymentStats = useMemo(() => salesByPaymentMethod(salesQ.data), [salesQ.data]);
  const cashierStats = useMemo(() => salesByCashier(salesQ.data), [salesQ.data]);
  const heatmap = useMemo(() => weeklyHeatmap(salesQ.data), [salesQ.data]);
  const shrink = useMemo(() => shrinkFromMovements(shrinkQ.data, productsById), [shrinkQ.data, productsById]);
  const soldIds = useMemo(() => soldProductIds(salesQ.data), [salesQ.data]);
  const health = useMemo(() => inventoryHealth(products, soldIds, 8), [products, soldIds]);

  const rangeLabel = useMemo(() => formatRangeLabel(range), [range]);
  const periodGoal = goal ? goal * rangeDayCount(range) : null;
  const loading = salesQ.loading;
  const hasSales = summary.count > 0;

  /* ---------- Exportaciones ---------- */
  const handleExport = (kind: ExportKind) => {
    const slug = rangeSlug(range);
    try {
      switch (kind) {
        case 'sales':
          if (!salesQ.data.length) return toast.info('No hay ventas en el período para exportar.');
          downloadCsv(`ventas-detalladas_${slug}`, salesDetailCsv(salesQ.data));
          break;
        case 'products':
          if (!productStats.length) return toast.info('No hay productos vendidos en el período.');
          downloadCsv(`rendimiento-productos_${slug}`, productPerformanceCsv(productStats));
          break;
        case 'cash':
          if (!sessionsQ.data.length) return toast.info('Aún no hay cortes de caja cerrados.');
          downloadCsv(`cortes-de-caja_${dayKey(new Date())}`, cashSessionsCsv(sessionsQ.data));
          break;
        case 'daily':
          if (!salesQ.data.length) return toast.info('No hay ventas en el período para resumir.');
          downloadCsv(`resumen-por-dia_${slug}`, dailySummaryCsv(groupByDay(salesQ.data, range), goal));
          break;
      }
      toast.success('Reporte descargado');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <ReportsHeader
        preset={preset}
        onPresetChange={setPreset}
        custom={custom}
        onCustomChange={setCustom}
        maxDate={toInputDate(now)}
        compare={compare}
        onCompareChange={setCompare}
        now={now}
        rangeLabel={rangeLabel}
        onExport={handleExport}
      />

      <KpiGrid
        summary={summary}
        prev={prevSummary}
        compare={compare}
        prevLoading={compare && prevQ.loading}
        loading={loading}
        shrink={shrink}
        shrinkLoading={shrinkQ.loading || catalogLoading}
        periodGoal={periodGoal}
        compareText={compareLabel(preset)}
        money={money}
      />

      {salesQ.error ? (
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="No pudimos cargar las ventas del período"
            description={errorMessage(salesQ.error)}
            action={
              <Button variant="secondary" onClick={() => setPreset('30d')}>
                Probar con los últimos 30 días
              </Button>
            }
          />
        </Card>
      ) : !loading && !hasSales ? (
        <Card>
          <EmptyState
            icon={ChartColumn}
            title="Sin ventas en este período"
            description={
              summary.voidedCount
                ? `Solo hay ${summary.voidedCount} ${summary.voidedCount === 1 ? 'venta anulada' : 'ventas anuladas'} en ${rangeLabel}. Cuando se completen ventas verás aquí la curva de rendimiento, productos estrella, métodos de pago y horarios pico.`
                : `No se registraron ventas en ${rangeLabel}. Cuando cobres en el punto de venta verás aquí la curva de rendimiento, productos estrella, métodos de pago y horarios pico.`
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {preset !== '30d' && (
                  <Button variant="secondary" onClick={() => setPreset('30d')}>
                    Ver últimos 30 días
                  </Button>
                )}
                {can('pos') && (
                  <Button icon={ShoppingCart} onClick={() => navigate('/pos')}>
                    Ir al punto de venta
                  </Button>
                )}
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <PerformanceChart
            buckets={series}
            granularity={granularity}
            goal={goal}
            onGoalChange={setGoal}
            loading={loading}
            money={money}
            moneyCompact={moneyCompact}
            currencySymbol={currencySymbol}
            rangeLabel={rangeLabel}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            <TopProducts stats={productStats} loading={loading} money={money} minMarginPct={business.settings?.minMarginPct ?? 0} />
            <PaymentMethods stats={paymentStats} loading={loading} money={money} moneyCompact={moneyCompact} />
            <TrafficHeatmap data={heatmap} loading={loading} className="md:col-span-2 2xl:col-span-1" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <CategorySales stats={categoryStats} loading={loading} money={money} className="xl:col-span-2" />
            <CashierPerformance stats={cashierStats} loading={loading} money={money} className="xl:col-span-3" />
          </div>
        </>
      )}

      <CashClosings sessions={sessionsQ.data} loading={sessionsQ.loading} money={money} onExport={() => handleExport('cash')} />

      <InventoryHealthSection health={health} loading={catalogLoading} salesLoading={loading} money={money} rangeLabel={rangeLabel} />
    </div>
  );
}
