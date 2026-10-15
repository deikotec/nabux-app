import { useEffect, useMemo, useState } from 'react';
import { Download, Info, ReceiptText, SearchX, TriangleAlert } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useFx } from '@/contexts/FxContext';
import { useSalesRange } from '@/hooks/data';
import { addDays, dayKey, eachDay, endOfDay, fromInputDate, rangeFromPreset, startOfDay, toInputDate, type DateRange } from '@/lib/dates';
import { formatDate, formatNumber } from '@/lib/format';
import { errorMessage } from '@/lib/utils';
import { Badge, Button, Card, EmptyState, PageHeader, Pagination, useToast } from '@/components/ui';
import type { Sale } from '@/types';
import { PaymentBreakdownCard } from './PaymentBreakdownCard';
import { SaleDetailModal } from './SaleDetailModal';
import { FilterBar, RangeBar, type MethodFilter, type RangeOption, type StatusFilter } from './SalesFilters';
import { SalesList } from './SalesList';
import { SalesSummary } from './SalesSummary';
import { exportSalesCsv, methodFilterOptions, MIXED_FILTER, saleMatches, saleMatchesMethod, salesStats } from './saleUtils';

const PAGE_SIZE = 20;

function resolveRange(preset: RangeOption, customFrom: string, customTo: string): DateRange {
  if (preset !== 'custom') return rangeFromPreset(preset);
  if (!customFrom || !customTo) return rangeFromPreset('today');
  let a = fromInputDate(customFrom);
  let b = fromInputDate(customTo);
  if (a > b) [a, b] = [b, a];
  return { from: startOfDay(a), to: endOfDay(b) };
}

function rangeText(r: DateRange) {
  const full: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  if (dayKey(r.from) === dayKey(r.to)) return formatDate(r.from, { weekday: 'long', ...full });
  const sameYear = r.from.getFullYear() === r.to.getFullYear();
  return `${formatDate(r.from, sameYear ? { day: 'numeric', month: 'short' } : full)} – ${formatDate(r.to, full)}`;
}

export default function SalesPage() {
  const { business, can, money } = useActiveBusiness();
  const fx = useFx();
  const toast = useToast();
  const canReports = can('reports');

  const [preset, setPreset] = useState<RangeOption>('today');
  const [customFrom, setCustomFrom] = useState(() => toInputDate(addDays(new Date(), -6)));
  const [customTo, setCustomTo] = useState(() => toInputDate(new Date()));
  const [method, setMethod] = useState<MethodFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [cashier, setCashier] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Sale | null>(null);

  const range = useMemo(() => resolveRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const { data: sales, loading, error } = useSalesRange(range);

  // Volver a la primera página al cambiar cualquier filtro.
  useEffect(() => setPage(1), [range, method, status, cashier, search]);

  const cashiers = useMemo(() => {
    const map = new Map<string, string>();
    sales.forEach((s) => s.cashierId && map.set(s.cashierId, s.cashierName || 'Sin nombre'));
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [sales]);

  // Si el cajero elegido ya no aparece en el período, se ignora el filtro.
  const cashierFilter = canReports && cashier !== 'all' && cashiers.some((c) => c.id === cashier) ? cashier : 'all';

  // Formas de pago del negocio + las que aparecen en las ventas cargadas (incluye métodos de ventas antiguas).
  const methodOptions = useMemo(() => methodFilterOptions(sales, fx.allMethods, fx.enabled), [sales, fx.allMethods, fx.enabled]);
  const methodFilter =
    method === 'all' || method === MIXED_FILTER || [...methodOptions.configured, ...methodOptions.legacy].some((o) => o.value === method) ? method : 'all';

  // Filtros excepto el estado: así el resumen muestra a la vez lo vendido y lo anulado.
  const base = useMemo(
    () =>
      sales.filter(
        (s) => saleMatchesMethod(s, methodFilter) && (cashierFilter === 'all' || s.cashierId === cashierFilter) && saleMatches(s, search)
      ),
    [sales, methodFilter, cashierFilter, search]
  );
  const rows = useMemo(() => (status === 'all' ? base : base.filter((s) => s.status === status)), [base, status]);
  const stats = useMemo(() => salesStats(base), [base]);

  const days = useMemo(() => {
    const end = Math.min(range.to.getTime(), Date.now());
    return end < range.from.getTime() ? 1 : eachDay(range.from, new Date(end)).length;
  }, [range]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // La venta seleccionada se toma de la lista en tiempo real (refleja la anulación al instante).
  const selectedSale = selected ? (sales.find((s) => s.id === selected.id) ?? selected) : null;

  const hasFilters = methodFilter !== 'all' || status !== 'all' || cashierFilter !== 'all' || search.trim() !== '';
  const clearFilters = () => {
    setMethod('all');
    setStatus('all');
    setCashier('all');
    setSearch('');
  };

  const handleExport = () => {
    if (!rows.length) {
      toast.info('No hay ventas que exportar con los filtros actuales.');
      return;
    }
    const name = `ventas-${business.name.replace(/[^\w-]+/g, '-').toLowerCase()}-${dayKey(range.from)}_${dayKey(range.to)}.csv`;
    exportSalesCsv(name, rows, {
      includeProfit: canReports,
      dual: fx.enabled,
      methods: fx.allMethods,
      baseCurrency: fx.baseCurrency,
      localCurrency: fx.localCurrency
    });
    toast.success(`Se exportaron ${formatNumber(rows.length)} ventas.`);
  };

  return (
    <>
      <PageHeader
        eyebrow={business.name}
        title="Historial de ventas"
        description={
          canReports
            ? 'Consulta, filtra y exporta los tickets de todo el equipo. Abre cualquier venta para ver o reimprimir el ticket.'
            : 'Consulta y reimprime los tickets que has cobrado.'
        }
        actions={
          <Button variant="secondary" icon={Download} onClick={handleExport} disabled={loading}>
            Exportar CSV
          </Button>
        }
      />

      <div className="flex flex-col gap-5">
        {!canReports && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-body-md text-blue-900" role="note">
            <Info className="mt-0.5 size-5 shrink-0 text-blue-600" aria-hidden />
            <p>
              Estás viendo <b>solo tus ventas</b>. Para consultar las del resto del equipo necesitas el permiso «Ver reportes y finanzas».
            </p>
          </div>
        )}

        <RangeBar
          preset={preset}
          onPreset={setPreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFrom={setCustomFrom}
          onCustomTo={setCustomTo}
          rangeLabel={rangeText(range)}
        />

        <SalesSummary
          stats={stats}
          days={days}
          loading={loading}
          showProfit={canReports}
          money={money}
          formatLocal={fx.enabled ? (n) => fx.moneyIn(n, fx.localCurrency) : undefined}
        />

        {fx.enabled && <PaymentBreakdownCard sales={base} loading={loading} />}

        <Card padded={false} className="overflow-hidden">
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-headline-md text-on-surface">Tickets del período</h2>
              {!loading && (
                <Badge tone="neutral" className="tnum">
                  {formatNumber(rows.length)} {rows.length === 1 ? 'registro' : 'registros'}
                </Badge>
              )}
            </div>
            <FilterBar
              search={search}
              onSearch={setSearch}
              method={methodFilter}
              onMethod={setMethod}
              methodOptions={methodOptions}
              status={status}
              onStatus={setStatus}
              cashier={cashierFilter}
              onCashier={setCashier}
              cashiers={cashiers}
              showCashier={canReports}
              hasFilters={hasFilters}
              onClear={clearFilters}
            />
          </div>

          {error ? (
            <EmptyState icon={TriangleAlert} title="No pudimos cargar las ventas" description={errorMessage(error)} />
          ) : !loading && rows.length === 0 ? (
            sales.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="Sin ventas en este período"
                description={canReports ? 'Prueba con otro rango de fechas.' : 'Aún no has cobrado tickets en este período. Prueba con otro rango de fechas.'}
              />
            ) : (
              <EmptyState
                icon={SearchX}
                title="Ningún ticket coincide"
                description="Ajusta la búsqueda o los filtros para ver más resultados."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                }
              />
            )
          ) : (
            <div className="border-t border-slate-100">
              <SalesList rows={pageRows} loading={loading} showCashier={canReports} money={money} onOpen={setSelected} />
              {!loading && (
                <Pagination
                  page={currentPage}
                  pageSize={PAGE_SIZE}
                  total={rows.length}
                  onChange={setPage}
                  label={rows.length === 1 ? 'venta' : 'ventas'}
                  className="border-t border-slate-100"
                />
              )}
            </div>
          )}
        </Card>
      </div>

      <SaleDetailModal sale={selectedSale} onClose={() => setSelected(null)} />
    </>
  );
}
