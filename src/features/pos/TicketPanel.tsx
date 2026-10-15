import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleUserRound, CirclePause, LockKeyhole, Minus, Percent, Plus, ReceiptText, ShoppingCart, Trash2, User, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Product, SaleTotals } from '@/types';
import { allowsDecimalQty, lineStockState } from './posUtils';
import type { CartLine, TicketDiscount } from './types';
import type { TicketHighlight } from './hooks/useTicket';

/* ------------------------------------------------------------------ */
/* Encabezado: título, cajero y cliente                                */
/* ------------------------------------------------------------------ */

export function TicketHeader({
  cashierName,
  customerName,
  onCustomerChange,
  showTitle = true,
  className
}: {
  cashierName: string;
  customerName: string;
  onCustomerChange: (v: string) => void;
  showTitle?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {showTitle && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex shrink-0 items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full bg-primary" />
            <h2 className="text-headline-md font-bold whitespace-nowrap text-on-surface">Ticket nuevo</h2>
          </div>
          <span
            className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-1 text-label-sm text-on-surface-variant"
            title={`Cajero: ${cashierName}`}
          >
            <CircleUserRound className="size-4 shrink-0" />
            <span className="truncate">Cajero: {cashierName}</span>
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white p-2 shadow-card focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20">
        <User className="ml-1 size-5 shrink-0 text-primary" />
        <label className="flex min-w-0 flex-1 flex-col">
          <span className="text-[10px] font-bold tracking-wide text-on-surface-variant uppercase">Cliente asignado</span>
          <input
            value={customerName}
            onChange={(e) => onCustomerChange(e.target.value)}
            placeholder="Cliente mostrador"
            maxLength={80}
            autoComplete="off"
            className="w-full bg-transparent text-label-lg text-on-surface outline-none placeholder:text-on-surface/80"
          />
        </label>
        {customerName && (
          <button
            type="button"
            onClick={() => onCustomerChange('')}
            aria-label="Volver a Cliente mostrador"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <X className="size-4" />
          </button>
        )}
        {!showTitle && (
          <span className="hidden max-w-[40%] items-center gap-1 truncate rounded-full bg-surface-container px-2 py-1 text-label-sm text-on-surface-variant sm:inline-flex">
            <CircleUserRound className="size-3.5 shrink-0" />
            <span className="truncate">{cashierName}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Líneas del ticket                                                   */
/* ------------------------------------------------------------------ */

const STATE_TONE = {
  ok: 'text-primary',
  low: 'text-tertiary',
  over: 'text-error',
  gone: 'text-error',
  free: 'text-secondary'
} as const;

export function TicketLines({
  lines,
  productsById,
  allowNegative,
  highlight,
  money,
  onIncrement,
  onSetQty,
  onRemove,
  className
}: {
  lines: CartLine[];
  productsById: Map<string, Product>;
  allowNegative: boolean;
  highlight: TicketHighlight | null;
  money: (n: number) => string;
  onIncrement: (key: string, delta: number) => void;
  onSetQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);

  useEffect(() => {
    if (!highlight) return;
    setFlashKey(highlight.key);
    const el = listRef.current?.querySelector<HTMLElement>(`[data-line="${CSS.escape(highlight.key)}"]`);
    el?.scrollIntoView({ block: 'nearest' });
    const t = setTimeout(() => setFlashKey(null), 700);
    return () => clearTimeout(t);
  }, [highlight]);

  if (!lines.length) {
    return (
      <div className={cn('flex flex-col items-center gap-2 px-6 py-10 text-center', className)}>
        <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-container-low text-primary">
          <ShoppingCart className="size-6" />
        </div>
        <p className="text-label-lg text-on-surface">El ticket está vacío</p>
        <p className="max-w-60 text-body-sm text-on-surface-variant">Escanea un código o toca un producto del catálogo para agregarlo.</p>
      </div>
    );
  }

  return (
    <ul ref={listRef} aria-label="Artículos del ticket" className={cn('flex flex-col divide-y divide-slate-100', className)}>
      {lines.map((line) => {
        const state = lineStockState(line, line.productId ? productsById.get(line.productId) : undefined, allowNegative);
        const total = line.unitPrice * line.qty;
        return (
          <li
            key={line.key}
            data-line={line.key}
            className={cn(
              'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1.5 rounded-lg py-2.5 transition-colors duration-500',
              "[grid-template-areas:'name_total_del'_'meta_step_step']",
              "@md:grid-cols-[minmax(0,1fr)_auto_auto_auto] @md:[grid-template-areas:'name_step_total_del'_'meta_step_total_del']",
              flashKey === line.key && 'bg-primary-fixed/25'
            )}
          >
            <p className="truncate text-headline-sm text-on-surface [grid-area:name]" title={line.name}>
              {line.name}
            </p>
            <p className="flex min-w-0 items-center gap-1.5 text-body-sm text-on-surface-variant tnum [grid-area:meta]">
              <span className="shrink-0">{money(line.unitPrice)} c/u</span>
              <span aria-hidden>•</span>
              <span className={cn('truncate font-semibold', STATE_TONE[state.tone])} title={state.detail}>
                {state.label}
              </span>
            </p>
            <div className="justify-self-end [grid-area:step]">
              <QtyStepper line={line} onIncrement={onIncrement} onSetQty={onSetQty} />
            </div>
            <span className="min-w-16 text-right text-label-lg text-on-surface tnum [grid-area:total] @md:min-w-20">{money(total)}</span>
            <button
              type="button"
              onClick={() => onRemove(line.key)}
              aria-label={`Quitar ${line.name} del ticket`}
              title="Quitar del ticket"
              className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors [grid-area:del] hover:bg-red-50 hover:text-error"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function QtyStepper({
  line,
  onIncrement,
  onSetQty
}: {
  line: CartLine;
  onIncrement: (key: string, delta: number) => void;
  onSetQty: (key: string, qty: number) => void;
}) {
  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
      <button
        type="button"
        onClick={() => onIncrement(line.key, -1)}
        disabled={line.qty <= 1}
        aria-label={`Restar uno a ${line.name}`}
        className="flex size-8 items-center justify-center text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-35"
      >
        <Minus className="size-4" />
      </button>
      <QtyInput value={line.qty} decimals={allowsDecimalQty(line.unit)} label={line.name} onCommit={(q) => onSetQty(line.key, q)} />
      <button
        type="button"
        onClick={() => onIncrement(line.key, 1)}
        aria-label={`Sumar uno a ${line.name}`}
        className="flex size-8 items-center justify-center text-on-surface transition-colors hover:bg-surface-container-low"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/** Cantidad editable: confirma con Enter o al salir; Esc revierte. */
function QtyInput({ value, decimals, label, onCommit }: { value: number; decimals: boolean; label: string; onCommit: (q: number) => void }) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const n = Number(text.replace(',', '.'));
    if (text.trim() === '' || !Number.isFinite(n)) {
      setText(String(value));
      return;
    }
    if (n !== value) onCommit(n);
  };

  return (
    <input
      type="text"
      inputMode={decimals ? 'decimal' : 'numeric'}
      aria-label={`Cantidad de ${label}`}
      value={text}
      onFocus={(e) => {
        setEditing(true);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.');
        if (decimals ? /^\d*\.?\d{0,3}$/.test(raw) : /^\d*$/.test(raw)) setText(raw);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          setText(String(value));
          setEditing(false);
          e.currentTarget.blur();
        }
      }}
      className="h-8 w-12 border-x border-slate-200 bg-transparent text-center text-label-lg text-on-surface outline-none tnum focus:bg-primary-fixed/15"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Totales                                                             */
/* ------------------------------------------------------------------ */

export function TicketTotals({
  totals,
  discount,
  taxName,
  taxRate,
  pricesIncludeTax,
  currency,
  canDiscount,
  onDiscount,
  money,
  className
}: {
  totals: SaleTotals;
  discount: TicketDiscount | null;
  taxName: string;
  taxRate: number;
  pricesIncludeTax: boolean;
  currency: string;
  canDiscount: boolean;
  onDiscount: () => void;
  money: (n: number) => string;
  className?: string;
}) {
  const hasDiscount = totals.discount > 0;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Row label={`Subtotal (${formatNumber(totals.itemCount)} ${totals.itemCount === 1 ? 'artículo' : 'artículos'})`} value={money(totals.gross)} />
      <Row
        label={
          <span className="flex flex-wrap items-center gap-x-1.5">
            Descuento
            {hasDiscount && discount?.mode === 'pct' && <span className="tnum">({formatNumber(discount.value)}%)</span>}
            {canDiscount && (
              <button type="button" onClick={onDiscount} className="text-label-md text-primary hover:underline">
                ({hasDiscount ? 'Editar' : 'Agregar'})
              </button>
            )}
          </span>
        }
        value={hasDiscount ? `−${money(totals.discount)}` : money(0)}
        valueClass="text-primary"
      />
      <Row
        label={`${taxName || 'Impuesto'} (${formatNumber(taxRate)}%)${pricesIncludeTax ? ' · incluido' : ''}`}
        value={money(totals.tax)}
      />
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card">
        <div className="flex flex-col">
          <span className="text-label-sm tracking-wider text-on-surface uppercase">Total a cobrar</span>
          <span className="text-body-sm text-primary">Moneda: {currency}</span>
        </div>
        <span aria-live="polite" className="ml-auto text-headline-lg text-primary tnum @sm:text-display-lg">
          {money(totals.total)}
        </span>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: ReactNode; value: string; valueClass?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-body-md text-on-surface-variant">
      <span className="min-w-0">{label}</span>
      <span className={cn('shrink-0 font-semibold text-on-surface tnum', valueClass)}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Acciones                                                            */
/* ------------------------------------------------------------------ */

export function TicketActions({
  onCheckout,
  processing,
  checkoutDisabled,
  blockReason,
  needsCash,
  onOpenCash,
  autoPrint,
  onHold,
  onDiscount,
  onClear,
  showDiscount,
  discountDisabled,
  hasItems,
  className
}: {
  onCheckout: () => void;
  processing: boolean;
  checkoutDisabled: boolean;
  blockReason: string | null;
  needsCash: boolean;
  onOpenCash: () => void;
  autoPrint: boolean;
  onHold: () => void;
  onDiscount: () => void;
  onClear: () => void;
  showDiscount: boolean;
  discountDisabled: boolean;
  hasItems: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {needsCash ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <LockKeyhole className="size-4 shrink-0 text-amber-700" />
          <span className="min-w-0 flex-1 text-body-sm text-amber-900">Abre la caja para poder cobrar.</span>
          <Button size="sm" variant="secondary" onClick={onOpenCash}>
            Abrir caja
          </Button>
        </div>
      ) : (
        blockReason && (
          <p role="status" className="text-center text-body-sm text-on-surface-variant">
            {blockReason}
          </p>
        )
      )}
      <Button size="xl" fullWidth icon={ReceiptText} kbd="F10" loading={processing} disabled={checkoutDisabled} onClick={onCheckout}>
        <span className="truncate">{processing ? 'Procesando cobro…' : autoPrint ? 'Cobrar e imprimir ticket' : 'Cobrar ticket'}</span>
      </Button>
      <div className={cn('grid gap-2', showDiscount ? 'grid-cols-3' : 'grid-cols-2')}>
        <SecondaryAction icon={CirclePause} label="En espera" kbd="F8" onClick={onHold} disabled={processing} />
        {showDiscount && <SecondaryAction icon={Percent} label="Descuento" kbd="F9" onClick={onDiscount} disabled={processing || discountDisabled} />}
        <SecondaryAction icon={X} label="Anular" onClick={onClear} disabled={processing || !hasItems} danger />
      </div>
    </div>
  );
}

function SecondaryAction({
  icon: Icon,
  label,
  kbd,
  onClick,
  disabled,
  danger
}: {
  icon: typeof X;
  label: string;
  kbd?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-keyshortcuts={kbd}
      className={cn(
        'flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-center text-label-md leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        danger ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>
        {label}
        {kbd && <span className="hidden @md:inline"> ({kbd})</span>}
      </span>
    </button>
  );
}
