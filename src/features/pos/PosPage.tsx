import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Calculator, CirclePause, PackagePlus, PackageSearch, Plus, ReceiptText, Wallet } from 'lucide-react';
import { Button, Card, EmptyState, Modal, PageHeader, useConfirm, useToast } from '@/components/ui';
import { ReceiptModal } from '@/components/receipt/Receipt';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCash } from '@/contexts/CashContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useFx } from '@/contexts/FxContext';
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
import { RateNotice, useRateLabel } from './RateControls';
import { StatusStrip } from './StatusStrip';
import { TicketActions, TicketHeader, TicketLines, TicketTotals } from './TicketPanel';
import { useAutoPrint, useFitToViewport, useMediaQuery } from './hooks/useDevice';
import { useHeldTickets } from './hooks/useHeldTickets';
import { usePayments } from './hooks/usePayments';
import { usePosShortcuts } from './hooks/usePosShortcuts';
import { usePosStats } from './hooks/usePosStats';
import { useTicket } from './hooks/useTicket';
import { GRID_PAGE_SIZE, newId, parseScanInput } from './posUtils';
import type { CartLine, HeldTicket, PaymentEntry, TicketDiscount } from './types';

const METHODS_SELECTOR = '[data-pay-methods] button:not(:disabled)';

/** Normaliza los pagos guardados en un ticket en espera (localStorage). */
function sanitizePayments(raw: unknown): PaymentEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is PaymentEntry => !!p && typeof (p as PaymentEntry).key === 'string' && typeof (p as PaymentEntry).methodId === 'string')
    .map((p) => ({
      key: p.key,
      methodId: p.methodId,
      amount: typeof p.amount === 'number' && Number.isFinite(p.amount) ? p.amount : '',
      reference: typeof p.reference === 'string' ? p.reference : '',
      auto: !!p.auto
    }));
}

export default function PosPage() {
  const { business, businessId, actor, can, money, currencySymbol } = useActiveBusiness();
  const { products, productsById, findByCode, categories, loading: catalogLoading } = useCatalog();
  const { session, loading: cashLoading, requestOpen, requestClose } = useCash();
  const fx = useFx();
  const toast = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const online = useOnline();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const finePointer = useMediaQuery('(pointer: fine)');
  const [autoPrint, setAutoPrint] = useAutoPrint();
  const ticket = useTicket();
  const { addProduct, addFreeAmount, setQty, increment, remove } = ticket;
  const pay = usePayments(ticket);
  const { held, add: holdAdd, remove: holdRemove, take: holdTake } = useHeldTickets(businessId);
  const stats = usePosStats(session);
  const rateLabel = useRateLabel();

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
  /** Resaltar errores de cobro (referencias faltantes) tras intentar cobrar. */
  const [showPayErrors, setShowPayErrors] = useState(false);
  const processingRef = useRef(false);

  const settings = business.settings;
  const requireCash = !!settings.requireCashSession;
  /** Cobro bloqueado por caja (incluye mientras se verifica). */
  const cashBlocked = requireCash && !session;
  /** Aviso visible solo cuando ya sabemos que no hay caja abierta. */
  const showCashNotice = cashBlocked && !cashLoading;
  const scanBeep = settings.scanBeep !== false;

  /** Equivalente en Bs (solo en modo bimonetario y con tasa). */
  const moneyLocal = fx.enabled && fx.rate ? fx.moneyLocal : undefined;

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

  /** Lleva el foco a la sección de cobro (abre el panel del ticket en móvil). */
  const focusPayments = useCallback(
    (selector = METHODS_SELECTOR) => {
      if (!isDesktop) setSheetOpen(true);
      setTimeout(
        () => {
          const el = document.querySelector<HTMLElement>(selector);
          if (!el) return;
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          el.focus({ preventScroll: true });
        },
        isDesktop ? 0 : 160
      );
    },
    [isDesktop]
  );

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

  const handleFreeAdd = (name: string, amount: number, taxExempt: boolean) => {
    addFreeAmount(name, amount, taxExempt);
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

  const recordedCount = ticket.recordedPayments.length;
  const paymentsNote = (n: number) => (n === 1 ? '1 pago registrado' : `${n} pagos registrados`);

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
      cashierName: actor.name,
      // Se guardan los pagos ya capturados (p. ej. un pago móvil recibido) para no perderlos.
      payments: snap.payments ?? [],
      changeMethodId: snap.changeMethodId ?? null
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
    setShowPayErrors(false);
    setSheetOpen(false);
    toast.success(
      recordedCount
        ? `Ticket puesto en espera con ${paymentsNote(recordedCount)}. Recupéralo desde “En espera”.`
        : 'Ticket puesto en espera. Recupéralo desde “En espera”.'
    );
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
          unitCost: round2(Number(p.costPrice) || 0),
          taxExempt: !!p.taxExempt
        }
      ];
    });
    // Pagos guardados: se conservan los de formas de pago que siguen activas.
    const activeIds = new Set(fx.methods.map((m) => m.id));
    const savedPayments = sanitizePayments(restored.payments);
    const payments = savedPayments.filter((p) => activeIds.has(p.methodId));
    const droppedPayments = savedPayments.length - payments.length;
    const recorded = payments.filter((p) => !p.auto && Number(p.amount) > 0).length;

    ticket.load({ lines, discount: restored.discount, customerName: restored.customerName, payments, changeMethodId: restored.changeMethodId ?? null });
    setShowPayErrors(false);
    setHeldOpen(false);

    const warnings = [
      dropped ? `se quitaron ${dropped} producto(s) que ya no están disponibles` : '',
      droppedPayments ? `se descartaron ${droppedPayments} pago(s) con formas de pago que ya no están activas` : ''
    ].filter(Boolean);
    if (warnings.length) toast.warning(`Ticket recuperado, pero ${warnings.join(' y ')}.`);
    else toast.success(recorded ? `Ticket recuperado con ${paymentsNote(recorded)}. Revisa lo que resta antes de cobrar.` : 'Ticket recuperado');
    if (!isDesktop) setSheetOpen(true);
    else refocusScanner();
  };

  const handleDiscard = async (t: HeldTicket) => {
    const recorded = sanitizePayments(t.payments).filter((p) => !p.auto && Number(p.amount) > 0).length;
    const ok = await confirm({
      title: '¿Descartar este ticket en espera?',
      message: `Se eliminará el ticket de ${t.customerName.trim() || 'Cliente mostrador'} por ${money(t.total)}${
        recorded ? `, junto con ${paymentsNote(recorded)} (si el cliente ya pagó, devuélvele el dinero)` : ''
      }. Esta acción no se puede deshacer.`,
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
      message: `Se quitarán ${formatNumber(ticket.totals.itemCount)} artículos (${money(ticket.totals.total)}) del ticket${
        recordedCount ? ` y ${paymentsNote(recordedCount)}` : ''
      }. Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, vaciar ticket',
      tone: 'danger'
    });
    if (!ok) return;
    ticket.clear();
    setShowPayErrors(false);
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

  const hasItems = ticket.lines.length > 0;
  const remaining = pay.result.remaining;

  /** Motivo por el que los pagos no permiten cobrar todavía. */
  const payBlock: string | null = !hasItems
    ? null
    : !(ticket.totals.total > 0)
      ? 'El total del ticket es cero: no hay nada que cobrar.'
      : pay.needsRate
        ? 'Sin tasa de cambio no se puede cobrar en bolívares. Actualiza la tasa.'
        : pay.noPayments
          ? 'Elige cómo paga el cliente (F6).'
          : remaining > 0
            ? `Resta ${money(remaining)}${moneyLocal ? ` (${moneyLocal(remaining)})` : ''} por cobrar.`
            : pay.missingRefs.length
              ? `Falta la referencia de ${pay.missingRefs[0].method?.label ?? 'un pago'}.`
              : pay.hasChange && !pay.changeMethod
                ? 'No hay una forma de pago habilitada para dar vuelto.'
                : null;

  const checkoutDisabled = processing || !hasItems || cashBlocked || !!overStockLine || !!payBlock;
  const changeNote =
    hasItems && pay.hasChange && pay.changeMethod && pay.changeAmount !== null
      ? `Entrega vuelto: ${pay.formatIn(pay.changeAmount, pay.changeMethod)}${fx.enabled ? ` · ${pay.changeMethod.label}` : ''}`
      : null;
  const blockReason = !hasItems
    ? 'Agrega productos para poder cobrar.'
    : overStockLine
      ? `Revisa “${overStockLine.name}”: no hay stock suficiente.`
      : payBlock;

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
    if (payBlock) {
      setShowPayErrors(true);
      const missing = pay.missingRefs[0];
      if (pay.noPayments) {
        toast.info(payBlock);
        focusPayments();
      } else if (remaining <= 0 && missing && !pay.needsRate) {
        toast.error(payBlock);
        focusPayments(`[data-pay-ref="${CSS.escape(missing.key)}"]`);
      } else {
        toast.error(payBlock);
        if (!isDesktop) setSheetOpen(true);
      }
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
        payments: pay.drafts,
        rate: fx.enabled ? fx.rate : null,
        rateSource: fx.enabled ? fx.rateSource : null,
        changeMethodId: pay.changeMethod?.id ?? null,
        customerName: ticket.customerName,
        sessionId: session?.id ?? null,
        products
      });
      ticket.clear();
      setShowPayErrors(false);
      setQuery('');
      setSheetOpen(false);
      setReceipt(sale);
      if (sale.offline) {
        toast.warning('Sin conexión: la venta se guardó en este equipo y se sincronizará automáticamente al volver la red.');
      } else {
        const local = sale.totalLocal ? ` · ${fx.formatLocal(sale.totalLocal)}` : '';
        const change =
          sale.changeAmount && sale.changeAmount > 0
            ? `. Entrega vuelto: ${fx.moneyIn(sale.changeAmount, sale.changeCurrency || business.currency)}`
            : '';
        toast.success(`Venta ${sale.folio} registrada · ${money(sale.total)}${local}${change}`);
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
    onAddPayment: () => {
      if (!hasItems) {
        toast.info('Agrega productos al ticket antes de registrar pagos.');
        focusSearch();
        return;
      }
      focusPayments();
    },
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
    pay,
    total: ticket.totals.total,
    disabled: processing,
    showErrors: showPayErrors,
    onSubmit: () => void handleCheckout()
  };

  const actionsProps = {
    onCheckout: () => void handleCheckout(),
    processing,
    checkoutDisabled,
    blockReason,
    changeNote,
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
    moneyLocal,
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
    money,
    exemptTotal: ticket.exemptTotal,
    dual: fx.enabled,
    moneyLocal,
    rateLabel
  };

  const noProducts = !catalogLoading && activeProducts.length === 0;
  const localCurrency = stats.localCurrency;

  return (
    <div className={cn(!isDesktop && 'pb-28')}>
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
          showRate={fx.enabled}
        />

        {showCashNotice && <CashNotice onOpen={requestOpen} />}
        <RateNotice />

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
                  moneyLocal={moneyLocal}
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
              cashInDrawerLocal={stats.cashInDrawerLocal}
              openingFloatLocal={session ? Number(session.openingFloatLocal) || 0 : null}
              formatLocal={localCurrency ? (n) => fx.moneyIn(n, localCurrency) : undefined}
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
            moneyLocal={moneyLocal}
            blocked={showCashNotice}
            onOpen={() => setSheetOpen(true)}
          />
          <Modal
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Ticket nuevo"
            subtitle={`${formatNumber(ticket.totals.itemCount)} ${ticket.totals.itemCount === 1 ? 'artículo' : 'artículos'} · ${money(ticket.totals.total)}${
              moneyLocal ? ` · ${moneyLocal(ticket.totals.total)}` : ''
            }`}
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

      <FreeAmountModal open={freeOpen} onClose={() => setFreeOpen(false)} onAdd={handleFreeAdd} />

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
        moneyLocal={moneyLocal}
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
