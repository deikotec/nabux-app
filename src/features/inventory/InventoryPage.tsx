import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowLeftRight, ChevronDown, Download, Eye, EyeOff, FileDown, FileUp, Lock, Package, PackageSearch, Percent, Plus, Tags, WandSparkles } from 'lucide-react';
import { Badge, Button, Card, EmptyState, MenuItem, PageHeader, Pagination, Popover, Select, Skeleton, useConfirm, useToast } from '@/components/ui';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useOnline } from '@/hooks/data';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { aiConfigured } from '@/lib/ai';
import { formatNumber } from '@/lib/format';
import { downloadFile, errorMessage } from '@/lib/utils';
import { adjustStock, deleteProduct, setProductActive } from '@/services/products';
import type { Product } from '@/types';
import { BulkCategoryModal } from './BulkCategoryModal';
import { BulkPriceModal, type BulkScope } from './BulkPriceModal';
import { CategorizeModal, isUncategorized } from './CategorizeModal';
import { FilterBar } from './FilterBar';
import { MissingRateNotice, RateChip } from './FxBits';
import {
  commitWrite,
  computeKpis,
  DEFAULT_FILTERS,
  fileStamp,
  filterProducts,
  hasActiveFilters,
  NO_SUPPLIER,
  PAGE_SIZES,
  productsToCsv,
  slug,
  sortProducts,
  statusFromParam,
  supplierName,
  type Filters,
  type MoveType,
  type StatusFilter
} from './helpers';
import { downloadImportTemplate, ImportModal } from './import/ImportModal';
import { useInventoryFx } from './useInventoryFx';
import { InventoryKpis } from './InventoryKpis';
import { InventoryMobile, type ScanMode } from './InventoryMobile';
import { KardexModal } from './KardexModal';
import { ProductFormModal } from './ProductFormModal';
import type { ProductHandlers, RowContext } from './ProductParts';
import { ProductTable } from './ProductTable';
import { StockAdjustModal } from './StockAdjustModal';

const PAGE_SIZE_KEY = 'nabux:inventory:pageSize';
/** Productos que muestra el móvil de entrada (y cuántos más con "Ver más"). */
const MOBILE_STEP = 30;
/** Parámetros de la URL que se consumen al entrar (los usan el panel y la barra superior). */
const URL_PARAMS = ['q', 'estado', 'buscar', 'modo', 'nuevo'];

function readPageSize(): number {
  try {
    const v = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return PAGE_SIZES.includes(v) ? v : PAGE_SIZES[0];
  } catch {
    return PAGE_SIZES[0];
  }
}

export default function InventoryPage() {
  const { business, businessId, actor, can, money } = useActiveBusiness();
  const { products, suppliers, loading, productsById, findByCode, categories } = useCatalog();
  const ifx = useInventoryFx();
  const toast = useToast();
  const { confirm } = useConfirm();
  const online = useOnline();
  const desktop = useIsDesktop();
  const canEdit = can('inventory');
  const [searchParams, setSearchParams] = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  /* ---------- Filtros (inicializados desde ?q= y ?estado=) ---------- */

  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    search: searchParams.get('q') ?? '',
    status: statusFromParam(searchParams.get('estado')) ?? 'all'
  }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(readPageSize);
  const [mobileLimit, setMobileLimit] = useState(MOBILE_STEP);
  /** Escaneo continuo (móvil): cada producto abre su entrada o su conteo. */
  const [scanMode, setScanMode] = useState<ScanMode | null>(null);
  /** Selección múltiple en el móvil (en escritorio la tabla siempre tiene casillas). */
  const [selecting, setSelecting] = useState(false);

  /* ---------- Modales ---------- */

  const [form, setForm] = useState<{ product: Product | null } | null>(null);
  const [move, setMove] = useState<{ productId: string; type: MoveType } | null>(null);
  const [kardexId, setKardexId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [bulk, setBulk] = useState<{ scope: BulkScope } | null>(null);
  const [categorize, setCategorize] = useState<{ selected: boolean } | null>(null);
  const [bulkCategory, setBulkCategory] = useState(false);
  const closeMove = useCallback(() => setMove(null), []);
  const kardexProduct = kardexId ? (productsById.get(kardexId) ?? null) : null;
  const anyModal = !!form || !!move || !!kardexId || importOpen || !!bulk || !!categorize || bulkCategory;
  const uncategorizedCount = useMemo(() => products.filter(isUncategorized).length, [products]);

  // Consume los parámetros de la URL (también si se navega aquí estando ya en la página):
  // ?q= y ?estado= filtran; ?buscar=1 enfoca el buscador; ?modo=entrada|conteo activa el escaneo continuo;
  // ?nuevo=1 abre el alta de producto.
  useEffect(() => {
    if (!URL_PARAMS.some((k) => searchParams.has(k))) return;
    const q = searchParams.get('q');
    const estado = searchParams.get('estado');
    const modo = searchParams.get('modo');
    if (q !== null || estado !== null) {
      setFilters((f) => ({ ...DEFAULT_FILTERS, sort: f.sort, search: q ?? '', status: statusFromParam(estado) ?? 'all' }));
      setPage(1);
      setMobileLimit(MOBILE_STEP);
    }
    if (canEdit && (modo === 'entrada' || modo === 'conteo')) setScanMode(modo === 'entrada' ? 'in' : 'adjust');
    if (canEdit && searchParams.has('nuevo')) setForm({ product: null });
    if (searchParams.has('buscar') || modo) setTimeout(() => searchRef.current?.focus(), 60);
    const next = new URLSearchParams(searchParams);
    URL_PARAMS.forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, canEdit]);

  const updateFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
    setMobileLimit(MOBILE_STEP);
  }, []);

  const clearFilters = () => {
    setFilters((f) => ({ ...DEFAULT_FILTERS, sort: f.sort }));
    setPage(1);
    setMobileLimit(MOBILE_STEP);
  };

  /* ---------- Datos derivados ---------- */

  const suppliersById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const kpis = useMemo(() => computeKpis(products, ifx.tax), [products, ifx.tax]);

  // Un escaneo (código de barras / SKU exacto) muestra y resalta ese producto, sin importar los demás filtros.
  const exactMatch = useMemo(() => {
    const q = filters.search.trim();
    return q.length >= 3 ? (findByCode(q) ?? null) : null;
  }, [filters.search, findByCode]);

  // Si el filtro de IVA deja de aplicar (negocio fuera de VE), no debe esconder productos.
  const effectiveFilters = useMemo(() => (ifx.exemptUi || !filters.tax ? filters : { ...filters, tax: DEFAULT_FILTERS.tax }), [filters, ifx.exemptUi]);
  const filtered = useMemo(
    () => (exactMatch ? [exactMatch] : sortProducts(filterProducts(products, effectiveFilters), effectiveFilters.sort, ifx.tax)),
    [products, effectiveFilters, exactMatch, ifx.tax]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => filtered.slice((safePage - 1) * pageSize, safePage * pageSize), [filtered, safePage, pageSize]);
  const mobileRows = useMemo(() => filtered.slice(0, mobileLimit), [filtered, mobileLimit]);

  /* ---------- Selección múltiple ---------- */

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectedProducts = useMemo(() => products.filter((p) => selected.has(p.id)), [products, selected]);

  const toggleOne = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const togglePage = (checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of pageRows) {
        if (checked) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  const setMobileSelecting = (on: boolean) => {
    setSelecting(on);
    if (!on) clearSelection();
  };

  // Atajo: F3 o Ctrl+B enfoca el buscador/escáner.
  useEffect(() => {
    if (anyModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F3' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [anyModal]);

  /** Abre un producto: en modo escaneo, su entrada o conteo; si no, el formulario (o el kardex sin permiso). */
  const openProduct = (p: Product) => {
    if (scanMode && !desktop && canEdit) setMove({ productId: p.id, type: scanMode });
    else if (canEdit) setForm({ product: p });
    else setKardexId(p.id);
  };

  const openMatch = () => {
    if (!exactMatch) return;
    // Deja el texto seleccionado para que el siguiente escaneo lo reemplace.
    searchRef.current?.select();
    openProduct(exactMatch);
  };

  /* ---------- Acciones ---------- */

  const onLateError = (e: unknown) => toast.error(errorMessage(e));

  const handlers: ProductHandlers = {
    onEdit: (p) => setForm({ product: p }),
    onMove: (p, type) => setMove({ productId: p.id, type }),
    onKardex: (p) => setKardexId(p.id),
    onQuickAdjust: (p, delta) => {
      const live = productsById.get(p.id) ?? p;
      if (delta < 0 && (Number(live.stock) || 0) + delta < 0 && !business.settings.allowNegativeStock) {
        toast.warning('El stock no puede quedar en negativo.');
        return;
      }
      adjustStock(businessId, actor, live, { delta, type: 'adjust', reason: 'Ajuste rápido' }).catch(onLateError);
    },
    onToggleActive: (p) => {
      const next = p.active === false;
      commitWrite(setProductActive(businessId, p, next), online, onLateError)
        .then(() => toast.success(next ? `"${p.name}" está activo de nuevo.` : `"${p.name}" se desactivó y ya no aparece en el POS.`))
        .catch(onLateError);
    },
    onDelete: async (p) => {
      const ok = await confirm({
        title: 'Eliminar producto',
        message: (
          <>
            Se eliminará <b className="text-on-surface">{p.name}</b> ({p.sku}) del catálogo. El historial de ventas y movimientos se conserva. Si solo quieres
            dejar de venderlo, mejor desactívalo.
          </>
        ),
        confirmLabel: 'Eliminar',
        tone: 'danger'
      });
      if (!ok) return;
      try {
        await commitWrite(deleteProduct(businessId, actor, p), online, onLateError);
        toast.success(`"${p.name}" se eliminó del catálogo.`);
        toggleOne(p.id, false);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    }
  };

  const rowCtx: RowContext = {
    canEdit,
    blockNegative: !business.settings.allowNegativeStock,
    minMarginPct: business.settings.minMarginPct,
    locale: business.locale,
    supplierOf: (p) => supplierName(p, suppliersById),
    local: ifx.local,
    tax: ifx.tax
  };

  /* ---------- CSV ---------- */

  const csvOptions = { dual: ifx.dual, exempt: ifx.exemptUi };

  const exportCsv = (list: Product[], suffix = '') => {
    if (!list.length) {
      toast.info('No hay productos para exportar.');
      return;
    }
    downloadFile(
      `inventario-${slug(business.name)}${suffix}-${fileStamp()}.csv`,
      productsToCsv(list, suppliersById, { ...csvOptions, toLocal: ifx.toLocal })
    );
    const count = `${formatNumber(list.length, business.locale)} ${list.length === 1 ? 'producto' : 'productos'}`;
    if (ifx.dual && !ifx.rate) toast.warning(`Exportaste ${count}. Sin tasa de cambio, la columna precio_bs quedó vacía.`);
    else toast.success(`Exportaste ${count}.`);
  };

  const bulkSetActive = async (active: boolean) => {
    const targets = selectedProducts.filter((p) => (p.active !== false) !== active);
    if (!targets.length) {
      toast.info(active ? 'Los productos seleccionados ya están activos.' : 'Los productos seleccionados ya están inactivos.');
      return;
    }
    if (!active) {
      const ok = await confirm({
        title: targets.length === 1 ? `Desactivar "${targets[0].name}"` : `Desactivar ${targets.length} productos`,
        message: 'Dejarán de aparecer en el punto de venta. Su stock e historial se conservan y puedes reactivarlos cuando quieras.',
        confirmLabel: 'Desactivar',
        tone: 'danger'
      });
      if (!ok) return;
    }
    try {
      await commitWrite(Promise.all(targets.map((p) => setProductActive(businessId, p, active))), online, onLateError);
      toast.success(targets.length === 1 ? `"${targets[0].name}" se ${active ? 'activó' : 'desactivó'}.` : `${formatNumber(targets.length, business.locale)} productos ${active ? 'activados' : 'desactivados'}.`);
      clearSelection();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const formDefaults = {
    category: filters.category || undefined,
    supplierId: filters.supplier && filters.supplier !== NO_SUPPLIER ? filters.supplier : undefined
  };

  /* ---------- Piezas compartidas (escritorio y móvil) ---------- */

  /** Importar / exportar / IA. En el móvil incluye también "Ajustar precios". */
  const toolsMenu = (close: () => void) => (
    <div className="flex w-72 max-w-full flex-col" role="menu">
      <MenuItem
        icon={FileDown}
        onClick={() => {
          close();
          exportCsv(filtered);
        }}
        hint={<span className="text-body-sm text-on-surface-variant tnum">{formatNumber(filtered.length, business.locale)}</span>}
      >
        Exportar CSV (filtrado)
      </MenuItem>
      {canEdit && (
        <>
          <MenuItem
            icon={FileUp}
            onClick={() => {
              close();
              setImportOpen(true);
            }}
            hint={<span className="hidden text-body-sm text-on-surface-variant sm:inline">Excel, CSV o fotos</span>}
          >
            Importar productos
          </MenuItem>
          {!desktop && products.length > 0 && (
            <MenuItem
              icon={Percent}
              onClick={() => {
                close();
                setBulk({ scope: selectedProducts.length ? 'selected' : 'filtered' });
              }}
            >
              Ajustar precios
            </MenuItem>
          )}
          {aiConfigured && products.length > 0 && (
            <MenuItem
              icon={WandSparkles}
              onClick={() => {
                close();
                setCategorize({ selected: false });
              }}
              hint={
                uncategorizedCount > 0 ? (
                  <span className="text-body-sm text-on-surface-variant tnum">{formatNumber(uncategorizedCount, business.locale)} sin categoría</span>
                ) : undefined
              }
            >
              Organizar categorías con IA
            </MenuItem>
          )}
          <div className="my-1 h-px bg-slate-100" role="separator" />
          <MenuItem
            icon={Download}
            onClick={() => {
              close();
              downloadImportTemplate(csvOptions);
            }}
          >
            Descargar plantilla
          </MenuItem>
        </>
      )}
    </div>
  );

  const bulkBar =
    selectedProducts.length > 0 ? (
      <div
        className="flex animate-fade-in flex-col gap-2 rounded-xl border border-primary/30 bg-primary-fixed/15 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
        role="region"
        aria-label="Acciones con los productos seleccionados"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label-md">
          <span className="text-on-surface">
            <b className="tnum">{formatNumber(selectedProducts.length, business.locale)}</b> {selectedProducts.length === 1 ? 'seleccionado' : 'seleccionados'}
          </span>
          {filtered.length > selectedProducts.length && (
            <button type="button" className="text-primary hover:underline" onClick={() => setSelected(new Set(filtered.map((p) => p.id)))}>
              Seleccionar los {formatNumber(filtered.length, business.locale)} resultados
            </button>
          )}
          <button type="button" className="text-on-surface-variant hover:text-on-surface hover:underline" onClick={clearSelection}>
            Quitar selección
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={FileDown} onClick={() => exportCsv(selectedProducts, '-seleccion')}>
            Exportar CSV
          </Button>
          {canEdit && (
            <>
              <Button size="sm" variant="secondary" icon={Percent} onClick={() => setBulk({ scope: 'selected' })}>
                Ajustar precios
              </Button>
              <Button size="sm" variant="secondary" icon={Tags} onClick={() => setBulkCategory(true)}>
                Categoría
              </Button>
              {aiConfigured && (
                <Button size="sm" variant="secondary" icon={WandSparkles} onClick={() => setCategorize({ selected: true })}>
                  Clasificar con IA
                </Button>
              )}
              <Button size="sm" variant="secondary" icon={Eye} onClick={() => bulkSetActive(true)}>
                Activar
              </Button>
              <Button size="sm" variant="danger" icon={EyeOff} onClick={() => bulkSetActive(false)}>
                Desactivar
              </Button>
            </>
          )}
        </div>
      </div>
    ) : null;

  /** Carga o lista vacía (null = hay productos que mostrar). */
  const emptyState = loading ? (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando productos">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  ) : products.length === 0 ? (
    <EmptyState
      icon={Package}
      title="Aún no tienes productos"
      description={canEdit ? 'Registra tu primer producto o importa tu catálogo completo desde Excel, CSV o fotos de tu lista de precios.' : 'Cuando tu equipo registre productos, aparecerán aquí.'}
      action={
        canEdit ? (
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" icon={FileUp} onClick={() => setImportOpen(true)}>
              Importar productos
            </Button>
            <Button icon={Plus} onClick={() => setForm({ product: null })}>
              Nuevo producto
            </Button>
          </div>
        ) : undefined
      }
    />
  ) : filtered.length === 0 ? (
    <EmptyState
      icon={PackageSearch}
      title="Sin resultados"
      description="Ningún producto coincide con tu búsqueda o filtros."
      action={
        <Button variant="secondary" onClick={clearFilters}>
          Limpiar filtros
        </Button>
      }
    />
  ) : null;

  const modals = (
    <>
      {form && <ProductFormModal product={form.product} defaults={formDefaults} onClose={() => setForm(null)} />}
      {move && <StockAdjustModal productId={move.productId} initialType={move.type} onClose={closeMove} />}
      {kardexProduct && (
        <KardexModal
          product={kardexProduct}
          onClose={() => setKardexId(null)}
          onRegister={
            canEdit
              ? () => {
                  setKardexId(null);
                  setMove({ productId: kardexProduct.id, type: 'in' });
                }
              : undefined
          }
        />
      )}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
      {categorize && canEdit && (
        <CategorizeModal
          selected={categorize.selected ? selectedProducts : []}
          initialScope={categorize.selected ? 'selected' : undefined}
          onClose={() => setCategorize(null)}
        />
      )}
      {bulkCategory && canEdit && selectedProducts.length > 0 && (
        <BulkCategoryModal products={selectedProducts} onClose={() => setBulkCategory(false)} onDone={clearSelection} />
      )}
      {bulk && canEdit && (
        <BulkPriceModal
          selected={selectedProducts}
          filtered={filtered}
          all={products}
          categories={categories}
          filtersActive={!!exactMatch || hasActiveFilters(effectiveFilters)}
          initialScope={bulk.scope}
          initialCategory={filters.category || undefined}
          onClose={() => setBulk(null)}
          onDone={(scope) => {
            if (scope === 'selected') clearSelection();
          }}
        />
      )}
    </>
  );

  /* ---------- Móvil ---------- */

  const mobile = desktop ? null : (
    <InventoryMobile
      products={products}
      filtered={filtered}
      visible={mobileRows}
      onMore={() => setMobileLimit((n) => n + MOBILE_STEP)}
      loading={loading}
      kpis={kpis}
      categories={categories}
      suppliers={suppliers}
      filters={filters}
      onFilters={updateFilters}
      onClear={clearFilters}
      searchRef={searchRef}
      exactMatch={exactMatch}
      onOpenMatch={openMatch}
      ctx={rowCtx}
      handlers={handlers}
      money={money}
      ifx={ifx}
      canEdit={canEdit}
      onNew={() => setForm({ product: null })}
      scanMode={scanMode}
      onScanMode={(m) => {
        setScanMode(m);
        if (m) setTimeout(() => searchRef.current?.focus(), 30);
      }}
      onOpen={openProduct}
      tools={toolsMenu}
      selecting={selecting || selectedProducts.length > 0}
      onSelecting={setMobileSelecting}
      selected={selected}
      onToggle={toggleOne}
      bulkBar={bulkBar}
      empty={emptyState}
    />
  );

  /* ---------- Escritorio ---------- */

  const listProps = {
    products: pageRows,
    ctx: rowCtx,
    handlers,
    selected,
    onToggle: toggleOne,
    onTogglePage: togglePage,
    highlightId: exactMatch?.id ?? null,
    money
  };

  // Los modales quedan siempre en la misma posición: al cruzar 1024 px (girar una tableta) no se pierde lo escrito en ellos.
  return (
    <>
      {mobile ?? (
        <>
          <PageHeader
            title="Inventario & Stock"
            description="Existencias en tiempo real, costos, márgenes y reposición de tu catálogo."
            actions={
              !canEdit ? (
                <Badge tone="neutral" icon={Lock} size="md">
                  Solo lectura
                </Badge>
              ) : undefined
            }
          />

          <MissingRateNotice ifx={ifx} className="mb-4" />

          <InventoryKpis
            kpis={kpis}
            loading={loading}
            status={exactMatch ? 'all' : filters.status}
            onStatus={(s: StatusFilter) => updateFilters({ status: s, search: exactMatch ? '' : filters.search })}
            money={money}
            local={ifx.local}
            locale={business.locale}
            netMargin={!!ifx.tax?.included}
          />

          <Card padded={false} className="mt-6 flex flex-col gap-5 p-3 sm:p-5">
            {/* Encabezado del catálogo */}
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-headline-md text-on-surface">Catálogo e inventario de productos</h2>
                  <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-label-sm text-on-surface-variant tnum">
                    {formatNumber(products.length, business.locale)} {products.length === 1 ? 'registro' : 'registros'}
                  </span>
                  <RateChip ifx={ifx} />
                </div>
                <p className="text-body-sm text-on-surface-variant">Control de existencias, costeo, márgenes y reposición en un solo lugar.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Popover
                  align="right"
                  trigger={({ open, toggle }) => (
                    <Button variant="soft" icon={ArrowLeftRight} iconRight={ChevronDown} onClick={toggle} aria-expanded={open} aria-haspopup="menu" aria-label="Importar / Exportar">
                      <span className="sm:hidden">Importar</span>
                      <span className="hidden sm:inline">Importar / Exportar</span>
                    </Button>
                  )}
                >
                  {toolsMenu}
                </Popover>
                {canEdit && products.length > 0 && (
                  <Button
                    variant="soft"
                    icon={Percent}
                    onClick={() => setBulk({ scope: selectedProducts.length ? 'selected' : 'filtered' })}
                    aria-label="Ajustar precios"
                    title="Subir o bajar precios por porcentaje"
                  >
                    <span className="sm:hidden">Precios</span>
                    <span className="hidden sm:inline">Ajustar precios</span>
                  </Button>
                )}
                {canEdit && (
                  <Button icon={Plus} onClick={() => setForm({ product: null })}>
                    Nuevo producto
                  </Button>
                )}
              </div>
            </div>

            <FilterBar
              filters={filters}
              onChange={updateFilters}
              onClear={clearFilters}
              categories={categories}
              suppliers={suppliers}
              searchRef={searchRef}
              exactMatch={exactMatch}
              onOpenMatch={openMatch}
              showTax={ifx.exemptUi}
              taxName={ifx.taxName}
            />

            {/* Acciones masivas */}
            {bulkBar}

            {/* Listado */}
            {emptyState ?? <ProductTable {...listProps} />}

            {/* Paginación */}
            {!loading && filtered.length > 0 && (
              <div className="flex flex-col-reverse items-center gap-1 border-t border-slate-100 pt-2 sm:flex-row">
                <label className="flex shrink-0 items-center gap-2 text-body-sm text-on-surface-variant">
                  Filas:
                  <Select
                    inputSize="sm"
                    value={String(pageSize)}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setPageSize(v);
                      setPage(1);
                      try {
                        localStorage.setItem(PAGE_SIZE_KEY, String(v));
                      } catch {
                        /* sin almacenamiento local */
                      }
                    }}
                    options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
                    className="w-20"
                  />
                </label>
                <Pagination page={safePage} pageSize={pageSize} total={filtered.length} onChange={setPage} label="productos" className="w-full flex-1" />
              </div>
            )}
          </Card>
        </>
      )}
      {modals}
    </>
  );
}
