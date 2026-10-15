import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowLeftRight, ChevronDown, Download, Eye, EyeOff, FileDown, FileUp, Lock, Package, PackageSearch, Plus } from 'lucide-react';
import { Badge, Button, Card, EmptyState, MenuItem, PageHeader, Pagination, Popover, Select, Skeleton, useConfirm, useToast } from '@/components/ui';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useOnline } from '@/hooks/data';
import { formatNumber } from '@/lib/format';
import { downloadFile, errorMessage } from '@/lib/utils';
import { adjustStock, deleteProduct, setProductActive } from '@/services/products';
import type { Product } from '@/types';
import { FilterBar } from './FilterBar';
import {
  commitWrite,
  computeKpis,
  DEFAULT_FILTERS,
  fileStamp,
  filterProducts,
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
import { downloadImportTemplate, ImportModal } from './ImportModal';
import { InventoryKpis } from './InventoryKpis';
import { KardexModal } from './KardexModal';
import { ProductCardList } from './ProductCardList';
import { ProductFormModal } from './ProductFormModal';
import type { ProductHandlers, RowContext } from './ProductParts';
import { ProductTable } from './ProductTable';
import { StockAdjustModal } from './StockAdjustModal';

const PAGE_SIZE_KEY = 'nabux:inventory:pageSize';

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
  const toast = useToast();
  const { confirm } = useConfirm();
  const online = useOnline();
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

  // Consume los parámetros de la URL (también si la barra superior navega aquí estando ya en la página).
  useEffect(() => {
    const q = searchParams.get('q');
    const estado = searchParams.get('estado');
    if (q === null && estado === null) return;
    setFilters((f) => ({ ...DEFAULT_FILTERS, sort: f.sort, search: q ?? '', status: statusFromParam(estado) ?? 'all' }));
    setPage(1);
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    next.delete('estado');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const updateFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);

  const clearFilters = () => {
    setFilters((f) => ({ ...DEFAULT_FILTERS, sort: f.sort }));
    setPage(1);
  };

  /* ---------- Datos derivados ---------- */

  const suppliersById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const kpis = useMemo(() => computeKpis(products), [products]);

  // Un escaneo (código de barras / SKU exacto) muestra y resalta ese producto, sin importar los demás filtros.
  const exactMatch = useMemo(() => {
    const q = filters.search.trim();
    return q.length >= 3 ? (findByCode(q) ?? null) : null;
  }, [filters.search, findByCode]);

  const filtered = useMemo(
    () => (exactMatch ? [exactMatch] : sortProducts(filterProducts(products, filters), filters.sort)),
    [products, filters, exactMatch]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => filtered.slice((safePage - 1) * pageSize, safePage * pageSize), [filtered, safePage, pageSize]);

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

  /* ---------- Modales ---------- */

  const [form, setForm] = useState<{ product: Product | null } | null>(null);
  const [move, setMove] = useState<{ productId: string; type: MoveType } | null>(null);
  const [kardexId, setKardexId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const closeMove = useCallback(() => setMove(null), []);
  const kardexProduct = kardexId ? (productsById.get(kardexId) ?? null) : null;
  const anyModal = !!form || !!move || !!kardexId || importOpen;

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

  const openMatch = () => {
    if (!exactMatch) return;
    // Deja el texto seleccionado para que el siguiente escaneo lo reemplace.
    searchRef.current?.select();
    if (canEdit) setForm({ product: exactMatch });
    else setKardexId(exactMatch.id);
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
    supplierOf: (p) => supplierName(p, suppliersById)
  };

  /* ---------- CSV ---------- */

  const exportCsv = (list: Product[], suffix = '') => {
    if (!list.length) {
      toast.info('No hay productos para exportar.');
      return;
    }
    downloadFile(`inventario-${slug(business.name)}${suffix}-${fileStamp()}.csv`, productsToCsv(list, suppliersById));
    toast.success(`Exportaste ${formatNumber(list.length, business.locale)} ${list.length === 1 ? 'producto' : 'productos'}.`);
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

  /* ---------- Render ---------- */

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

  return (
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

      <InventoryKpis
        kpis={kpis}
        loading={loading}
        status={exactMatch ? 'all' : filters.status}
        onStatus={(s: StatusFilter) => updateFilters({ status: s, search: exactMatch ? '' : filters.search })}
        money={money}
        locale={business.locale}
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
            </div>
            <p className="text-body-sm text-on-surface-variant">Control de existencias, costeo, márgenes y reposición en un solo lugar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Popover
              align="right"
              trigger={({ open, toggle }) => (
                <Button variant="soft" icon={ArrowLeftRight} iconRight={ChevronDown} onClick={toggle} aria-expanded={open} aria-haspopup="menu" aria-label="Importar / Exportar">
                  <span className="sm:hidden">CSV</span>
                  <span className="hidden sm:inline">Importar / Exportar</span>
                </Button>
              )}
            >
              {(close) => (
                <div className="flex w-64 flex-col" role="menu">
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
                      >
                        Importar CSV
                      </MenuItem>
                      <div className="my-1 h-px bg-slate-100" role="separator" />
                      <MenuItem
                        icon={Download}
                        onClick={() => {
                          close();
                          downloadImportTemplate();
                        }}
                      >
                        Descargar plantilla
                      </MenuItem>
                    </>
                  )}
                </div>
              )}
            </Popover>
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
        />

        {/* Acciones masivas */}
        {selectedProducts.length > 0 && (
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
        )}

        {/* Listado */}
        {loading ? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando productos">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Aún no tienes productos"
            description={canEdit ? 'Registra tu primer producto o importa tu catálogo completo desde un archivo CSV.' : 'Cuando tu equipo registre productos, aparecerán aquí.'}
            action={
              canEdit ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="secondary" icon={FileUp} onClick={() => setImportOpen(true)}>
                    Importar CSV
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
        ) : (
          <>
            <div className="hidden lg:block">
              <ProductTable {...listProps} />
            </div>
            <div className="lg:hidden">
              <ProductCardList {...listProps} />
            </div>
          </>
        )}

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
    </>
  );
}
