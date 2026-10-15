import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Calculator, CirclePause, PackagePlus, PackageSearch, Plus, ReceiptText, Wallet } from 'lucide-react';
import { Button, Card, EmptyState, Modal, PageHeader, useConfirm, useToast } from '@/components/ui';
import { ReceiptModal } from '@/components/receipt/Receipt';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCash } from '@/contexts/CashContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useOnline } from '@/hooks/data';
import { formatNumber } from '@/lib/format';
import { beep, cn, errorMessage, productMatches, round2 } from '@/lib/utils';
import { checkout } from '@/services/sales';
import type { Product, Sale } from '@/types';
import { CashNotice } from './CashNotice';
import { CategoryChips } from './CategoryChips';
import { DiscountModal } from './DiscountModal';
import { FreeAmountModal } from './FreeAmountModal';
import { HeldTicketsModal } from './HeldTickets';
import { MobileTicketBar } from './MobileTicketBar';
import { PaymentSection } from './PaymentSection';
import { PosKpis } from './PosKpis';
import { ProductGrid } from './ProductGrid';
import { QuickEntry } from './QuickEntry';
import { StatusStrip } from './StatusStrip';
import { TicketActions, TicketHeader, TicketLines, TicketTotals } from './TicketPanel';
import { useAutoPrint, useFitToViewport, useMediaQuery } from './hooks/useDevice';
import { useHeldTickets } from './hooks/useHeldTickets';
import { usePosShortcuts } from './hooks/usePosShortcuts';
import { usePosStats } from './hooks/usePosStats';
import { useTicket } from './hooks/useTicket';
import { GRID_PAGE_SIZE, newId, parseScanInput } from './posUtils';
import type { CartLine, HeldTicket, TicketDiscount } from './types';

export default function PosPage() {
  const { business, businessId, actor, can, money, currencySymbol } = useActiveBusiness();
  const { products, productsById, findByCode, categories, loading: catalogLoading } = useCatalog();
  const { session, loading: cashLoading, requestOpen, requestClose } = useCash();
  const toast = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const online = useOnline();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const finePointer = useMediaQuery('(pointer: fine)');
  const [autoPrint, setAutoPrint] = useAutoPrint();
  const ticket = useTicket();
  const { addProduct, addFreeAmount, setQty, increment, remove } = ticket;
  const { held, add: holdAdd, remove: holdRemove, take: holdTake } = useHeldTickets(businessId);
  const stats = usePosStats(session);

  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useFitToViewport<HTMLDivElement>(isDesktop);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState<string | null>(null);
  const [scannerReady, setScannerReady] = useState(false);
  const [freeOpen, setFreeOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);

  const settings = business.settings;
  const requireCash = !!settings.requireCashSession;
  /** Cobro bloqueado por caja (incluye mientras se verifica). */
  const cashBlocked = requireCash && !session;
  /** Aviso visible solo cuando ya sabemos que no hay caja abierta. */
  const showCashNotice = cashBlocked && !cashLoading;
  const scanBeep = settings.scanBeep !== false;

  /* ---------------- Catálogo / filtros ---------------- */

  const activeProducts = useMemo(() => products.filter((p) => p.active !== false), [products]);

  const categoryChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of activeProducts) if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return categories.filter((c) => counts.has(c)).map((name) => ({ name, count: counts.get(name) ?? 0 }));
  }, [activeProducts, categories]);

  const activeCategory = category && categoryChips.some((c) => c.name === category) ? category : null;

  const filterProducts = useCallback(
    (text: string) => {
      const { code } = parseScanInput(text);
      return activeProducts.filter((p) => (!activeCategory || p.category === activeCategory) && productMatches(p, code));
    },
    [activeProducts, activeCategory]
  );

  const filtered = useMemo(() => filterProducts(deferredQuery), [filterProducts, deferredQuery]);

  // Paginación del grid: se reinicia al cambiar búsqueda o categoría.
  const filterKey = `${deferredQuery}\u0000${activeCategory ?? ''}`;
  const [paging, setPaging] = useState({ key: filterKey, limit: GRID_PAGE_SIZE });
  const limit = paging.key === filterKey ? paging.limit : GRID_PAGE_SIZE;
  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit]);

  const cartQty = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of ticket.lines) if (l.productId) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty);
    return m;
  }, [ticket.lines]);

  /* ---------------- Foco del escáner ---------------- */

  const focusSearch = useCallback(() => {
    const el = searchRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  /** Tras un clic, devuelve el foco al escáner (solo con mouse: en táctil abriría el teclado). */
  const refocusScanner = useCallback(() => {
    if (finePointer) setTimeout(focusSearch, 60);
  }, [finePointer, focusSearch]);

  /* ---------------- Agregar productos ---------------- */

  const handleScan = () => {
    // Se lee del DOM: el escáner puede enviar Enter inmediatamente después del último carácter.
    const raw = (searchRef.current?.value ?? query).trim();
    if (!raw) return;
    const { qty, code } = parseScanInput(raw);

    const exact = findByCode(code);
    if (exact) {
      if (addProduct(exact, qty)) setQuery('');
      else searchRef.current?.select();
      return;
    }

    const matches = filterProducts(raw);
    if (matches.length === 1) {
      if (addProduct(matches[0], qty)) setQuery('');
      else searchRef.current?.select();
      return;
    }
    if (matches.length === 0) {
      if (scanBeep) beep(220, 180);
      toast.error(
        activeCategory ? `No hay productos con “${code}” en ${activeCategory}.` : `No encontramos ningún producto con “${code}”.`
      );
      searchRef.current?.select();
      return;
    }
    toast.info(`${formatNumber(matches.length)} productos coinciden con “${code}”. Toca el que quieras agregar.`);
  };

  const handleGridAdd = useCallback(
    (p: Product) => {
      addProduct(p, 1);
      refocusScanner();
    },
    [addProduct, refocusScanner]
  );

  const handleFreeAdd = (name: string, amount: number) => {
    addFreeAmount(name, amount);
    refocusScanner();
  };

  /* ---------------- Descuento ---------------- */

  const openDiscount = () => {
    if (!ticket.canDiscount) {
      toast.error('No tienes permiso para aplicar descuentos.');
      return;
    }
    if (ticket.maxDiscountPct <= 0) {
      toast.info('Los descuentos están desactivados en la configuración del negocio.');
      return;
    }
    if (!ticket.lines.length) {
      toast.info('Agrega productos antes de aplicar un descuento.');
      return;
    }
    setDiscountOpen(true);
  };

  const applyDiscount = (d: TicketDiscount | null) => {
    ticket.setDiscount(d);
    setDiscountOpen(false);
    toast.success(d ? 'Descuento aplicado al ticket' : 'Descuento eliminado');
  };

  /* ---------------- Tickets en espera ---------------- */

  const holdCurrent = () => {
    const snap = ticket.snapshot();
    holdAdd({
      id: newId('held-'),
      createdAt: Date.now(),
      lines: snap.lines,
      discount: snap.discount,
      customerName: snap.customerName,
      itemCount: ticket.totals.itemCount,
      total: ticket.totals.total,
      cashierName: actor.name
    });
  };

  const handleHold = () => {
    if (processingRef.current) return;
    if (!ticket.lines.length) {
      if (held.length) setHeldOpen(true);
      else toast.info('No hay tickets en espera. Agrega productos y presiona F8 para pausar uno.');
      return;
    }
    holdCurrent();
    ticket.clear();
    setSheetOpen(false);
    toast.success('Ticket puesto en espera. Recupéralo desde “En espera”.');
    refocusScanner();
  };

  const handleRestore = (id: string) => {
    const restored = holdTake(id);
    if (!restored) return;
    if (ticket.lines.length) {
      holdCurrent();
      toast.info('El ticket que tenías abierto quedó en espera.');
    }
    // Precios y datos actualizados del catálogo; se quitan productos eliminados o inactivos.
    let dropped = 0;
    const lines = restored.lines.flatMap((l): CartLine[] => {
      if (!l.productId) return [l];
      const p = productsById.get(l.productId);
      if (!p || p.active === false) {
        dropped++;
        return [];
      }
      return [
        {
          ...l,
          name: p.name,
          sku: p.sku ?? '',
          category: p.category ?? '',
          unit: p.unit ?? '',
          unitPrice: round2(Number(p.salePrice) || 0),
          unitCost: round2(Number(p.costPrice) || 0)
        }
      ];
    });
    ticket.load({ lines, discount: restored.discount, customerName: restored.customerName });
    setHeldOpen(false);
    if (dropped) toast.warning(`Ticket recuperado. Se quitaron ${dropped} producto(s) que ya no están disponibles.`);
    else toast.success('Ticket recuperado');
    if (!isDesktop) setSheetOpen(true);
    else refocusScanner();
  };

  const handleDiscard = async (t: HeldTicket) => {
    const ok = await confirm({
      title: '¿Descartar este ticket en espera?',
      message: `Se eliminará el ticket de ${t.customerName.trim() || 'Cliente mostrador'} por ${money(t.total)}. Esta acción no se puede deshacer.`,
      confirmLabel: 'Descartar',
      tone: 'danger'
    });
    if (ok) {
      holdRemove(t.id);
      toast.info('Ticket en espera descartado');
    }
  };

  /* ---------------- Vaciar ticket ---------------- */

  const handleClear = async () => {
    if (!ticket.lines.length || processingRef.current) return;
    const ok = await confirm({
      title: '¿Anular el ticket actual?',
      message: `Se quitarán ${formatNumber(ticket.totals.itemCount)} artículos (${money(ticket.totals.total)}) del ticket. Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, vaciar ticket',
      tone: 'danger'
    });
    if (!ok) return;
    ticket.clear();
    setSheetOpen(false);
    toast.info('Ticket anulado');
    refocusScanner();
  };

  /* ---------------- Cobro ---------------- */

  const overStockLine = useMemo(() => {
    if (ticket.allowNegative) return null;
    return (
      ticket.lines.find((l) => {
        if (!l.productId) return false;
        const p = productsById.get(l.productId);
        return !p || p.active === false || l.qty > (Number(p.stock) || 0);
      }) ?? null
    );
  }, [ticket.lines, ticket.allowNegative, productsById]);

  const cashShort = ticket.paymentMethod === 'cash' && ticket.change < 0;
  const hasItems = ticket.lines.length > 0;
  const checkoutDisabled = processing || !hasItems || cashBlocked || !!overStockLine || cashShort;
  const blockReason = !hasItems
    ? 'Agrega productos para poder cobrar.'
    : overStockLine
      ? `Revisa “${overStockLine.name}”: no hay stock suficiente.`
      : cashShort
        ? 'El monto recibido no cubre el total.'
        : null;

  const handleCheckout = async () => {
    if (processingRef.current) return;
    if (!hasItems) {
      toast.info('Agrega productos al ticket antes de cobrar.');
      focusSearch();
      return;
    }
    if (cashBlocked) {
      toast.warning('Abre la caja para poder cobrar.');
      if (!cashLoading) requestOpen();
      return;
    }
    if (overStockLine) {
      toast.error(`Stock insuficiente de “${overStockLine.name}”. Ajusta la cantidad antes de cobrar.`);
      return;
    }
    if (cashShort) {
      toast.error('El efectivo recibido es menor al total a cobrar.');
      return;
    }
    processingRef.current = true;
    setProcessing(true);
    try {
      const sale = await checkout({
        business,
        actor,
        items: ticket.items,
        discount: ticket.discountAmount,
        paymentMethod: ticket.paymentMethod,
        cashReceived: ticket.paymentMethod === 'cash' && ticket.cashReceived !== '' ? ticket.cashReceived : null,
        customerName: ticket.customerName,
        sessionId: session?.id ?? null,
        products
      });
      ticket.clear();
      setQuery('');
      setSheetOpen(false);
      setReceipt(sale);
      if (sale.offline) {
        toast.warning('Sin conexión: la venta se guardó en este equipo y se sincronizará automáticamente al volver la red.');
      } else {
        toast.success(`Venta ${sale.folio} registrada · ${money(sale.total)}`);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  // Impresión automática del ticket al terminar el cobro (preferencia de este equipo).
  const autoPrintRef = useRef(autoPrint);
  useEffect(() => {
    autoPrintRef.current = autoPrint;
  }, [autoPrint]);
  useEffect(() => {
    if (!receipt || !autoPrintRef.current) return;
    const t = setTimeout(() => window.print(), 450);
    return () => clearTimeout(t);
  }, [receipt]);

  const closeReceipt = () => {
    setReceipt(null);
    refocusScanner();
  };

  // En escritorio el ticket vive en la columna derecha: cierra el panel móvil si cambia el tamaño.
  useEffect(() => {
    if (isDesktop) setSheetOpen(false);
  }, [isDesktop]);

  /* ---------------- Atajos ---------------- */

  usePosShortcuts({
    onSearch: () => {
      setSheetOpen(false);
      focusSearch();
    },
    onFreeAmount: () => setFreeOpen(true),
    onHold: handleHold,
    onDiscount: openDiscount,
    onCheckout: () => void handleCheckout(),
    onEscape: () => {
      if (query) setQuery('');
      focusSearch();
    },
    onTypeAhead: focusSearch
  });

  /* ---------------- Render ---------------- */

  const paymentProps = {
    method: ticket.paymentMethod,
    onMethodChange: ticket.setPaymentMethod,
    total: ticket.totals.total,
    cashReceived: ticket.cashReceived,
    onCashReceivedChange: ticket.setCashReceived,
    received: ticket.received,
    change: ticket.change,
    money,
    currency: business.currency,
    locale: business.locale,
    currencySymbol,
    disabled: processing,
    onSubmit: () => void handleCheckout()
  };

  const actionsProps = {
    onCheckout: () => void handleCheckout(),
    processing,
    checkoutDisabled,
    blockReason,
    needsCash: showCashNotice,
    onOpenCash: requestOpen,
    autoPrint,
    onHold: handleHold,
    onDiscount: openDiscount,
    onClear: () => void handleClear(),
    showDiscount: ticket.canDiscount,
    discountDisabled: ticket.maxDiscountPct <= 0 || !hasItems,
    hasItems
  };

  const linesProps = {
    lines: ticket.lines,
    productsById,
    allowNegative: ticket.allowNegative,
    highlight: ticket.highlight,
    money,
    onIncrement: increment,
    onSetQty: setQty,
    onRemove: remove
  };

  const totalsProps = {
    totals: ticket.totals,
    discount: ticket.discount,
    taxName: business.taxName,
    taxRate: business.taxRate,
    pricesIncludeTax: business.pricesIncludeTax,
    currency: business.currency,
    canDiscount: ticket.canDiscount && ticket.maxDiscountPct > 0 && hasItems,
    onDiscount: openDiscount,
    money
  };

  const noProducts = !catalogLoading && activeProducts.length === 0;

  return (
    <div className={cn(!isDesktop && 'pb-24')}>
      <PageHeader
        title="Terminal POS"
        actions={
          <>
            <Button variant="secondary" icon={CirclePause} onClick={() => setHeldOpen(true)}>
              En espera
              {held.length > 0 && (
                <span className="rounded-full bg-tertiary-fixed px-1.5 text-[11px] font-bold text-on-tertiary-fixed-variant tnum">{held.length}</span>
              )}
            </Button>
            <Button variant="secondary" icon={Wallet} onClick={session ? requestClose : requestOpen} disabled={cashLoading}>
              {session ? 'Corte de caja' : 'Abrir caja'}
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <StatusStrip
          scannerReady={scannerReady}
          onFocusScanner={focusSearch}
          session={session}
          cashLoading={cashLoading}
          onCashClick={session ? requestClose : requestOpen}
          online={online}
          autoPrint={autoPrint}
          onToggleAutoPrint={() => {
            setAutoPrint(!autoPrint);
            toast.info(autoPrint ? 'Impresión automática desactivada en este equipo.' : 'El ticket se imprimirá al cobrar.');
          }}
        />

        {showCashNotice && <CashNotice onOpen={requestOpen} />}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,7fr)_minmax(380px,5fr)]">
          {/* Catálogo y entrada rápida */}
          <section aria-label="Catálogo de productos" className="@container flex min-w-0 flex-col gap-3">
            <QuickEntry
              ref={searchRef}
              value={query}
              onChange={setQuery}
              onSubmit={handleScan}
              onClear={() => {
                setQuery('');
                focusSearch();
              }}
              onFocusChange={setScannerReady}
              autoFocus={finePointer}
            />

            {noProducts ? (
              <Card padded={false}>
                <EmptyState
                  icon={PackageSearch}
                  title="Aún no hay productos para vender"
                  description={
                    can('inventory')
                      ? 'Da de alta tu catálogo en Inventario y aparecerá aquí listo para escanear. Mientras tanto puedes cobrar montos libres.'
                      : 'Pide a un encargado que registre productos en el inventario. Mientras tanto puedes cobrar montos libres.'
                  }
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      {can('inventory') && (
                        <Button icon={PackagePlus} onClick={() => navigate('/inventario')}>
                          Ir a inventario
                        </Button>
                      )}
                      <Button variant="secondary" icon={Calculator} onClick={() => setFreeOpen(true)}>
                        Cobrar monto libre
                      </Button>
                    </div>
                  }
                />
              </Card>
            ) : (
              <>
                {categoryChips.length > 0 && (
                  <CategoryChips categories={categoryChips} total={activeProducts.length} value={activeCategory} onChange={setCategory} />
                )}
                <ProductGrid
                  products={visible}
                  matchCount={filtered.length}
                  loading={catalogLoading}
                  cartQty={cartQty}
                  allowNegative={ticket.allowNegative}
                  money={money}
                  onAdd={handleGridAdd}
                  onFreeAmount={() => setFreeOpen(true)}
                  onShowMore={() => setPaging({ key: filterKey, limit: limit + GRID_PAGE_SIZE })}
                  query={deferredQuery}
                  category={activeCategory}
                />
              </>
            )}

            <PosKpis
              todayCount={stats.todayCount}
              todayTotal={stats.todayTotal}
              todayLoading={stats.todayLoading}
              cashInDrawer={stats.cashInDrawer}
              openingFloat={session ? Number(session.openingFloat) || 0 : null}
              cashLoading={stats.cashLoading}
              heldCount={held.length}
              money={money}
              onCashClick={session ? requestClose : requestOpen}
              onHeldClick={() => setHeldOpen(true)}
            />
          </section>

          {/* Ticket (escritorio) */}
          {isDesktop && (
            <aside aria-label="Ticket actual" className="sticky top-20">
              <div
                ref={panelRef}
                className="@container flex max-h-[calc(100dvh-6rem)] flex-col overflow-y-auto rounded-2xl border border-slate-200/80 bg-white shadow-card scrollbar-thin"
              >
                <TicketHeader
                  className="shrink-0 bg-surface-container-low p-4"
                  cashierName={actor.name}
                  customerName={ticket.customerName}
                  onCustomerChange={ticket.setCustomerName}
                />
                <TicketLines {...linesProps} className="max-h-[clamp(9rem,34dvh,24rem)] shrink-0 overflow-y-auto px-4 py-1 scrollbar-thin" />
                <TicketTotals {...totalsProps} className="shrink-0 border-t border-slate-100 bg-surface-container-low/70 p-4" />
                <PaymentSection {...paymentProps} className="shrink-0 p-4" />
                <TicketActions {...actionsProps} className="sticky bottom-0 shrink-0 border-t border-slate-100 bg-white p-4" />
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Ticket (móvil / tablet) */}
      {!isDesktop && (
        <>
          <MobileTicketBar
            itemCount={ticket.totals.itemCount}
            total={ticket.totals.total}
            money={money}
            blocked={showCashNotice}
            onOpen={() => setSheetOpen(true)}
          />
          <Modal
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Ticket nuevo"
            subtitle={`${formatNumber(ticket.totals.itemCount)} ${ticket.totals.itemCount === 1 ? 'artículo' : 'artículos'} · ${money(ticket.totals.total)}`}
            icon={ReceiptText}
            size="lg"
            dismissible={!processing}
            footer={
              <div data-pos-sheet="" className="@container w-full">
                <TicketActions {...actionsProps} />
              </div>
            }
          >
            <div data-pos-sheet="" className="@container flex flex-col gap-4">
              <TicketHeader
                showTitle={false}
                cashierName={actor.name}
                customerName={ticket.customerName}
                onCustomerChange={ticket.setCustomerName}
              />
              <TicketLines {...linesProps} />
              {hasItems && (
                <>
                  <TicketTotals {...totalsProps} className="rounded-2xl bg-surface-container-low p-3" />
                  <PaymentSection {...paymentProps} />
                </>
              )}
            </div>
          </Modal>
        </>
      )}

      <FreeAmountModal open={freeOpen} onClose={() => setFreeOpen(false)} onAdd={handleFreeAdd} currencySymbol={currencySymbol} />

      <DiscountModal
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        gross={ticket.gross}
        current={ticket.discount}
        maxPct={ticket.maxDiscountPct}
        money={money}
        currencySymbol={currencySymbol}
        previewTotal={ticket.previewTotal}
        onApply={applyDiscount}
      />

      <HeldTicketsModal
        open={heldOpen}
        onClose={() => setHeldOpen(false)}
        held={held}
        money={money}
        hasCurrent={hasItems}
        onRestore={handleRestore}
        onDiscard={(t) => void handleDiscard(t)}
      />

      <ReceiptModal
        sale={receipt}
        business={business}
        onClose={closeReceipt}
        title={receipt?.offline ? 'Venta guardada sin conexión' : 'Venta registrada'}
        actions={
          <Button icon={Plus} kbd="Enter" data-autofocus onClick={closeReceipt}>
            Nueva venta
          </Button>
        }
      />
    </div>
  );
}
