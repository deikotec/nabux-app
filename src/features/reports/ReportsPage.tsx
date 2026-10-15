import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChartColumn, ShoppingCart, TriangleAlert } from 'lucide-react';
import { RATE_SOURCE_LABELS } from '@/config/app';
import { Button, Card, EmptyState, useToast } from '@/components/ui';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useFx } from '@/contexts/FxContext';
import { useClosedCashSessions, useSalesRange } from '@/hooks/data';
import { addDays, dayKey, endOfDay, fromInputDate, previousRange, rangeFromPreset, startOfDay, toInputDate, type DateRange } from '@/lib/dates';
import { currencySymbol as symbolOf } from '@/lib/format';
import { formatRate } from '@/lib/fx';
import { errorMessage } from '@/lib/utils';
import {
  buildTimeSeries,
  compareLabel,
  dailyRateSeries,
  formatRangeLabel,
  groupByDay,
  hasActivity,
  intradayRateSeries,
  inventoryHealth,
  paymentsByCurrency,
  pickGranularity,
  productPerformance,
  rangeDayCount,
  rateResolver,
  salesByCashier,
  salesByCategory,
  salesByPaymentMethod,
  shrinkFromMovements,
  soldProductIds,
  summarizeRates,
  summarizeSales,
  weeklyHeatmap
} from './analytics';
import { buildMethodColors } from './colors';
import {
  cashSessionsCsv,
  dailySummaryCsv,
  downloadCsv,
  fxHistoryCsv,
  paymentMethodsCsv,
  productPerformanceCsv,
  rangeSlug,
  salesDetailCsv,
  type CurrencyCsvOptions
} from './exporters';
import { compactAmount, type ReportFx } from './format';
import { useDailyGoal, useFxHistory, useNow, useRangeMovements } from './hooks';
import { CashClosings } from './components/CashClosings';
import { CashierPerformance } from './components/CashierPerformance';
import { CategorySales } from './components/CategorySales';
import { InventoryHealthSection } from './components/InventoryHealthSection';
import { KpiGrid } from './components/KpiGrid';
import { PaymentMethods } from './components/PaymentMethods';
import { PerformanceChart } from './components/PerformanceChart';
import { RateEvolution } from './components/RateEvolution';
import { ReportsHeader, type CustomRangeInput, type ExportKind, type HeaderRate, type ReportPreset } from './components/ReportsHeader';
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
  const fx = useFx();
  const toast = useToast();
  const navigate = useNavigate();
  const now = useNow();
  const todayKey = dayKey(now);
  const hourKey = `${todayKey}-${now.getHours()}`;
  const dual = fx.enabled;

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
  const singleDay = dayKey(range.from) === dayKey(range.to);

  /* ---------- Formato bimonetario ---------- */
  const localSymbol = fx.localCurrency === 'VES' ? 'Bs' : fx.localCurrency;
  const reportFx = useMemo<ReportFx>(() => {
    const localSign = symbolOf(fx.localCurrency, fx.settings.localLocale);
    return {
      dual,
      baseCurrency: business.currency,
      localCurrency: fx.localCurrency,
      formatLocal: fx.formatLocal,
      compactLocal: (n: number) => compactAmount(n, localSign, fx.settings.localLocale),
      moneyIn: fx.moneyIn,
      formatRate: (r) => formatRate(r, localSymbol, currencySymbol),
      baseSymbol: currencySymbol,
      localSymbol,
      igtfEnabled: !!fx.settings.igtfEnabled,
      igtfRate: Number(fx.settings.igtfRate) || 0
    };
  }, [dual, business.currency, fx.localCurrency, fx.settings, fx.formatLocal, fx.moneyIn, localSymbol, currencySymbol]);
  const csvOpts = useMemo<CurrencyCsvOptions>(
    () => ({ dual, baseCurrency: business.currency, localCurrency: fx.localCurrency }),
    [dual, business.currency, fx.localCurrency]
  );

  /* ---------- Datos ---------- */
  const salesQ = useSalesRange(range);
  const prevQ = useSalesRange(compare ? prevRange : null);
  const shrinkQ = useRangeMovements(businessId, range);
  const sessionsQ = useClosedCashSessions(30);
  const fxHist = useFxHistory(businessId, range, dual);

  /* ---------- Tasas del período ---------- */
  const dailyRates = useMemo(
    () => (dual ? dailyRateSeries(fxHist.entries, range, fxHist.baseline, new Date()) : []),
    [dual, fxHist.entries, fxHist.baseline, range, hourKey]
  );
  const ratePoints = useMemo(
    () => (dual && singleDay ? intradayRateSeries(fxHist.entries, fxHist.baseline) : dailyRates),
    [dual, singleDay, fxHist.entries, fxHist.baseline, dailyRates]
  );
  const rateSummary = useMemo(() => summarizeRates(ratePoints), [ratePoints]);
  /** $ → Bs a la tasa del día (historial) o, si no hay registro, a la actual. Para valorizar mermas. */
  const shrinkToLocal = useMemo(() => {
    if (!dual) return undefined;
    const rateOn = rateResolver(dailyRates, fx.rateSource);
    return (amountBase: number, date: Date | null) => {
      const r = rateOn(date) ?? fx.rate;
      return r ? amountBase * r : null;
    };
  }, [dual, dailyRates, fx.rateSource, fx.rate]);

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
  const paymentStats = useMemo(
    () => salesByPaymentMethod(salesQ.data, { methods: fx.allMethods, baseCurrency: business.currency, localCurrency: fx.localCurrency, dual }),
    [salesQ.data, fx.allMethods, business.currency, fx.localCurrency, dual]
  );
  const currencyGroups = useMemo(
    () => paymentsByCurrency(paymentStats, { base: business.currency, local: fx.localCurrency }),
    [paymentStats, business.currency, fx.localCurrency]
  );
  const colorOf = useMemo(() => buildMethodColors(fx.allMethods.map((m) => m.id)), [fx.allMethods]);
  const cashierStats = useMemo(() => salesByCashier(salesQ.data), [salesQ.data]);
  const heatmap = useMemo(() => weeklyHeatmap(salesQ.data), [salesQ.data]);
  const shrink = useMemo(() => shrinkFromMovements(shrinkQ.data, productsById, shrinkToLocal), [shrinkQ.data, productsById, shrinkToLocal]);
  const soldIds = useMemo(() => soldProductIds(salesQ.data), [salesQ.data]);
  const health = useMemo(() => inventoryHealth(products, soldIds, 8), [products, soldIds]);

  const rangeLabel = useMemo(() => formatRangeLabel(range), [range]);
  const periodGoal = goal ? goal * rangeDayCount(range) : null;
  const loading = salesQ.loading;
  const hasSales = summary.count > 0;

  const headerRate = useMemo<HeaderRate | null>(() => {
    if (!dual) return null;
    if (!fx.rate) return { text: null, stale: fx.stale };
    const own = fx.rates?.[fx.rateSource];
    const source = own && own > 0 ? fx.rateSource : 'bcv';
    return { text: `${RATE_SOURCE_LABELS[source]} · ${formatRate(fx.rate, localSymbol, currencySymbol)}`, stale: fx.stale };
  }, [dual, fx.rate, fx.rates, fx.rateSource, fx.stale, localSymbol, currencySymbol]);

  const { refreshFromInternet } = fx;
  const refreshRates = useCallback(async () => {
    try {
      const r = await refreshFromInternet();
      toast.success(r.bcv ? `Tasa BCV actualizada: ${formatRate(r.bcv, localSymbol, currencySymbol)}` : 'Tasas consultadas');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [refreshFromInternet, toast, localSymbol, currencySymbol]);

  /* ---------- Exportaciones ---------- */
  const handleExport = (kind: ExportKind) => {
    const slug = rangeSlug(range);
    try {
      switch (kind) {
        case 'sales':
          if (!salesQ.data.length) return toast.info('No hay ventas en el período para exportar.');
          downloadCsv(`ventas-detalladas_${slug}`, salesDetailCsv(salesQ.data, csvOpts));
          break;
        case 'products':
          if (!productStats.length) return toast.info('No hay productos vendidos en el período.');
          downloadCsv(`rendimiento-productos_${slug}`, productPerformanceCsv(productStats));
          break;
        case 'payments':
          if (!paymentStats.some(hasActivity)) return toast.info('No hay cobros en el período para exportar.');
          downloadCsv(`formas-de-pago_${slug}`, paymentMethodsCsv(paymentStats, currencyGroups, csvOpts));
          break;
        case 'cash':
          if (!sessionsQ.data.length) return toast.info('Aún no hay cortes de caja cerrados.');
          downloadCsv(`cortes-de-caja_${dayKey(new Date())}`, cashSessionsCsv(sessionsQ.data, csvOpts));
          break;
        case 'daily':
          if (!salesQ.data.length) return toast.info('No hay ventas en el período para resumir.');
          downloadCsv(`resumen-por-dia_${slug}`, dailySummaryCsv(groupByDay(salesQ.data, range), goal, csvOpts));
          break;
        case 'rates':
          if (!fxHist.entries.length && !fxHist.baseline) return toast.info('No hay tasas registradas en el período.');
          downloadCsv(`historial-tasas_${slug}`, fxHistoryCsv(fxHist.entries, fxHist.baseline, { localCurrency: fx.localCurrency, baseCurrency: business.currency }));
          break;
      }
      toast.success('Reporte descargado');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const rateSection = dual ? (
    <RateEvolution
      points={ratePoints}
      summary={rateSummary}
      loading={fxHist.loading || fx.loading}
      error={fxHist.error}
      rates={fx.rates}
      rateSource={fx.rateSource}
      stale={fx.stale}
      fx={reportFx}
      canEditRates={fx.canEditRates}
      canOpenSettings={can('settings')}
      onRefresh={refreshRates}
      refreshing={fx.refreshing}
      onExport={() => handleExport('rates')}
      rangeLabel={rangeLabel}
      intraday={singleDay}
    />
  ) : null;

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
        rate={headerRate}
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
        fx={reportFx}
      />

      {salesQ.error ? (
        <>
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
          {rateSection}
        </>
      ) : !loading && !hasSales ? (
        <>
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
          {rateSection}
        </>
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
            fx={reportFx}
          />

          {rateSection}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            <TopProducts stats={productStats} loading={loading} money={money} minMarginPct={business.settings?.minMarginPct ?? 0} />
            <PaymentMethods
              stats={paymentStats}
              groups={currencyGroups}
              loading={loading}
              money={money}
              moneyCompact={moneyCompact}
              fx={reportFx}
              colorOf={colorOf}
            />
            <TrafficHeatmap data={heatmap} loading={loading} className="md:col-span-2 2xl:col-span-1" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <CategorySales stats={categoryStats} loading={loading} money={money} className="xl:col-span-2" />
            <CashierPerformance stats={cashierStats} loading={loading} money={money} className="xl:col-span-3" />
          </div>
        </>
      )}

      <CashClosings sessions={sessionsQ.data} loading={sessionsQ.loading} money={money} onExport={() => handleExport('cash')} fx={reportFx} />

      <InventoryHealthSection health={health} loading={catalogLoading} salesLoading={loading} money={money} rangeLabel={rangeLabel} />
    </div>
  );
}
