import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  Bitcoin,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CreditCard,
  HandCoins,
  Info,
  Landmark,
  QrCode,
  Smartphone,
  TriangleAlert,
  Wallet,
  X
} from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useFx } from '@/contexts/FxContext';
import { currencySymbol as currencySymbolOf } from '@/lib/format';
import { baseToMethod } from '@/lib/payments';
import { cn } from '@/lib/utils';
import type { PaymentKind, PaymentMethodConfig } from '@/types';
import { MoneyInput } from './MoneyInput';
import { BASE_BILLS, localRoundUps, type ResolvedEntry } from './paymentPlan';
import { formatAmountInput, formatBill, quickCashOptions } from './posUtils';
import { useMediaQuery } from './hooks/useDevice';
import type { PaymentsApi } from './hooks/usePayments';

const KIND_ICONS: Record<PaymentKind, LucideIcon> = {
  cash: Banknote,
  mobile: Smartphone,
  card: CreditCard,
  transfer: Landmark,
  crypto: Bitcoin,
  credit: CalendarClock,
  other: Wallet
};

/** Nombres cortos de los métodos legados (negocios de una sola moneda). */
const LEGACY_SHORT: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transf. / QR' };

const KIND_HINTS: Partial<Record<PaymentKind, string>> = {
  card: 'Cobra en la terminal o punto de venta y confirma cuando el pago sea aprobado.',
  mobile: 'Verifica que el pago móvil se haya acreditado antes de confirmar.',
  transfer: 'Verifica que la transferencia se haya acreditado antes de confirmar.',
  crypto: 'Confirma la recepción en la billetera antes de cobrar.',
  credit: 'Confirma que el financiamiento fue aprobado antes de cobrar.'
};

export function methodIcon(m: Pick<PaymentMethodConfig, 'id' | 'kind'>): LucideIcon {
  if (m.id === 'transfer') return QrCode;
  return KIND_ICONS[m.kind] ?? Wallet;
}

function shortLabel(m: Pick<PaymentMethodConfig, 'id' | 'label'>) {
  return LEGACY_SHORT[m.id] ?? m.label;
}

interface PaymentSectionProps {
  pay: PaymentsApi;
  /** Total de la venta (moneda base, sin IGTF). */
  total: number;
  disabled?: boolean;
  /** Mostrar errores de validación (tras intentar cobrar). */
  showErrors?: boolean;
  /** Enter en un monto o referencia → cobrar. */
  onSubmit: () => void;
  className?: string;
}

/** Cobro: formas de pago, pagos mixtos en $ y Bs, IGTF, resta y vuelto. */
export function PaymentSection({ pay, total, disabled, showErrors, onSubmit, className }: PaymentSectionProps) {
  const id = useId();
  const fx = useFx();
  const { business, money, currencySymbol } = useActiveBusiness();
  const finePointer = useMediaQuery('(pointer: fine)');
  const sectionRef = useRef<HTMLElement>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const dual = fx.enabled;
  const rate = pay.rate;
  const localSymbol = currencySymbolOf(fx.localCurrency, fx.settings.localLocale);
  const localFmt = dual && rate ? fx.moneyLocal : null;
  const igtfOn = dual && fx.settings.igtfEnabled && fx.settings.igtfRate > 0;

  // Tras tocar un método (con mouse/teclado), el monto queda listo para escribir lo recibido.
  useEffect(() => {
    if (!focusKey) return;
    const el = sectionRef.current?.querySelector<HTMLInputElement>(`[data-pay-amount="${CSS.escape(focusKey)}"]`);
    if (el && !el.disabled) {
      el.focus();
      el.select();
    }
    setFocusKey(null);
  }, [focusKey, pay.entries]);

  const tap = (methodId: string) => {
    const key = pay.tapMethod(methodId);
    if (key && finePointer) setFocusKey(key);
  };

  const groups = useMemo(() => {
    if (!dual) return [{ key: 'all', title: '', symbol: '', methods: pay.methods }];
    return [
      { key: 'base', title: 'Divisas', symbol: currencySymbol, methods: pay.methods.filter((m) => m.currency === 'base') },
      {
        key: 'local',
        title: fx.localCurrency === 'VES' ? 'Bolívares' : fx.localCurrency,
        symbol: localSymbol,
        methods: pay.methods.filter((m) => m.currency === 'local')
      }
    ].filter((g) => g.methods.length > 0);
  }, [dual, pay.methods, currencySymbol, localSymbol, fx.localCurrency]);

  const entries = pay.entries;
  const last = entries[entries.length - 1];
  const usedIds = new Set(entries.map((e) => e.methodId));

  return (
    <section ref={sectionRef} aria-labelledby={`${id}-title`} className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${id}-title`} className="text-label-sm tracking-wider text-on-surface-variant uppercase">
          {dual ? 'Cobro · formas de pago' : 'Forma de pago'}
        </h3>
        <kbd className="hidden rounded bg-surface-container px-1.5 py-0.5 font-sans text-[11px] font-semibold text-on-surface-variant pointer-fine:inline">
          F6
        </kbd>
      </div>

      {/* Formas de pago */}
      <div data-pay-methods="" className="flex flex-col gap-2.5">
        {groups.map((g) => (
          <div key={g.key} className="flex flex-col gap-1.5" role="group" aria-label={g.title || 'Formas de pago'}>
            {g.title && (
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'rounded-md px-1.5 py-px text-label-md tnum',
                    g.key === 'local' ? 'bg-secondary-fixed text-on-secondary-fixed-variant' : 'bg-primary-fixed/60 text-on-primary-fixed-variant'
                  )}
                >
                  {g.symbol}
                </span>
                <span className="text-label-sm tracking-wider text-on-surface-variant uppercase">{g.title}</span>
                <span aria-hidden className="h-px flex-1 bg-slate-200/80" />
              </div>
            )}
            <div className={cn('grid gap-2', dual ? 'grid-cols-2 @xs:grid-cols-3' : 'grid-cols-3')}>
              {g.methods.map((m) => {
                const Icon = methodIcon(m);
                const selected = !!last?.auto && last.methodId === m.id;
                const used = usedIds.has(m.id);
                const noRate = m.currency === 'local' && !rate;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={used}
                    disabled={disabled || noRate}
                    onClick={() => tap(m.id)}
                    title={noRate ? 'Sin tasa de cambio: no se puede cobrar en bolívares' : m.label}
                    className={cn(
                      'relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-label-md transition-all pointer-fine:min-h-12 disabled:cursor-not-allowed disabled:opacity-50',
                      selected
                        ? 'bg-primary text-on-primary shadow-lift'
                        : used
                          ? 'border border-primary/50 bg-primary-fixed/30 text-on-primary-fixed-variant'
                          : 'border border-slate-200/80 bg-surface-container-low text-on-surface hover:border-primary/30 hover:bg-surface-container'
                    )}
                  >
                    <Icon className="size-5" />
                    <span className="text-center leading-tight">{shortLabel(m)}</span>
                    {igtfOn && m.igtf && (
                      <span
                        className={cn(
                          'absolute top-1 right-1 rounded px-1 text-[9px] leading-[14px] font-bold tnum',
                          selected ? 'bg-white/20 text-white' : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                        )}
                        title={`Paga IGTF ${fx.settings.igtfRate}%`}
                      >
                        +{fx.settings.igtfRate}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {dual && (!entries.length || last?.auto || pay.result.remaining > 0) && (
          <p className="text-body-sm text-on-surface-variant">
            {!entries.length
              ? 'Toca cómo paga el cliente. Para un pago mixto, ajusta el monto y toca otra forma de pago.'
              : last?.auto
                ? 'Toca otra forma de pago para cambiarla, o ajusta el monto para combinar varias.'
                : 'Toca otra forma de pago para cobrar lo que resta.'}
          </p>
        )}
      </div>

      {/* Pagos agregados */}
      {entries.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Pagos del ticket">
          {entries.map((e, i) => (
            <EntryCard
              key={e.key}
              entry={e}
              index={i}
              count={entries.length}
              isLast={i === entries.length - 1}
              pay={pay}
              dual={dual}
              disabled={disabled}
              showErrors={showErrors}
              onSubmit={onSubmit}
              money={money}
              localFmt={localFmt}
              baseSymbol={currencySymbol}
              localSymbol={localSymbol}
              baseLocale={business.locale}
              localLocale={fx.settings.localLocale}
              baseCurrency={business.currency}
              localCurrency={fx.localCurrency}
            />
          ))}
        </ul>
      )}

      <PaymentSummary
        pay={pay}
        total={total}
        dual={dual}
        money={money}
        localFmt={localFmt}
        formatLocal={fx.formatLocal}
        igtfRate={fx.settings.igtfRate}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pago agregado                                                       */
/* ------------------------------------------------------------------ */

function EntryCard({
  entry: e,
  index,
  count,
  isLast,
  pay,
  dual,
  disabled,
  showErrors,
  onSubmit,
  money,
  localFmt,
  baseSymbol,
  localSymbol,
  baseLocale,
  localLocale,
  baseCurrency,
  localCurrency
}: {
  entry: ResolvedEntry;
  index: number;
  count: number;
  isLast: boolean;
  pay: PaymentsApi;
  dual: boolean;
  disabled?: boolean;
  showErrors?: boolean;
  onSubmit: () => void;
  money: (n: number) => string;
  localFmt: ((n: number) => string) | null;
  baseSymbol: string;
  localSymbol: string;
  baseLocale: string;
  localLocale: string;
  baseCurrency: string;
  localCurrency: string;
}) {
  const refId = useId();
  const m = e.method;
  if (!m) {
    return (
      <li className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-body-sm text-amber-900">
        <TriangleAlert className="size-4 shrink-0" />
        <span className="flex-1">Esta forma de pago ya no está disponible.</span>
        <RemoveButton label="Quitar pago" onClick={() => pay.removePayment(e.key)} disabled={disabled} />
      </li>
    );
  }

  const Icon = methodIcon(m);
  const locale = e.isLocal ? localLocale : baseLocale;
  const currency = e.isLocal ? localCurrency : baseCurrency;
  const exactLabel = index > 0 ? 'Resto' : 'Exacto';
  const amount = e.value ?? 0;
  const isCash = m.kind === 'cash';
  const submitOnEnter = (ev: React.KeyboardEvent) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      onSubmit();
    }
  };

  // Equivalencias: Bs → $ y $ → Bs, más el IGTF del pago.
  const equiv: string[] = [];
  if (e.needsRate) equiv.push('Sin tasa: no se puede convertir');
  else if (amount > 0 && e.grossBase !== null) {
    if (e.isLocal) equiv.push(`≈ ${money(e.grossBase)}`);
    else if (localFmt) equiv.push(`≈ ${localFmt(e.grossBase)}`);
  }
  if (e.igtf > 0) equiv.push(`IGTF ${money(e.igtf)}`);
  if (!dual && count > 1 && e.coverage > 0) equiv.push(`Cubre ${money(e.coverage)}`);

  // Billetes / redondeos rápidos para efectivo.
  const target = e.exact ?? 0;
  const quick: { value: number; label: string; additive: boolean }[] = !isCash
    ? []
    : e.isLocal
      ? localRoundUps(target).map((v) => ({ value: v, label: formatBill(v, currency, locale), additive: false }))
      : dual
        ? BASE_BILLS.map((v) => ({ value: v, label: `+${formatBill(v, currency, locale)}`, additive: true }))
        : quickCashOptions(target).map((v) => ({ value: v, label: formatBill(v, currency, locale), additive: false }));

  const refMissing = !!showErrors && e.missingReference;
  const hint = isLast ? KIND_HINTS[m.kind] : undefined;

  return (
    <li className="flex flex-col gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-card">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl',
            e.isLocal ? 'bg-secondary-fixed text-secondary' : 'bg-primary-fixed/60 text-primary'
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-label-lg text-on-surface">{m.label}</p>
          {equiv.length > 0 && <p className="truncate text-body-sm text-on-surface-variant tnum">{equiv.join(' · ')}</p>}
        </div>
        <RemoveButton label={`Quitar pago ${m.label}`} onClick={() => pay.removePayment(e.key)} disabled={disabled} />
      </div>

      <div className="flex items-center gap-2">
        <MoneyInput
          data-pay-amount={e.key}
          aria-label={`Monto recibido en ${m.label}`}
          locale={locale}
          prefix={e.isLocal ? localSymbol : baseSymbol}
          value={e.value ?? ''}
          onValueChange={(v) => pay.setAmount(e.key, v)}
          placeholder={e.needsRate ? 'Sin tasa' : e.exact ? formatAmountInput(e.exact, locale) : '0'}
          disabled={disabled || e.needsRate}
          onKeyDown={submitOnEnter}
          className="flex-1"
        />
        <button
          type="button"
          aria-pressed={e.auto}
          disabled={disabled || e.needsRate || (!e.auto && !(target > 0))}
          onClick={() => pay.setExact(e.key)}
          title={target > 0 ? `Cobrar exacto: ${pay.formatIn(target, m)}` : 'No falta nada por cobrar'}
          className={cn(
            'flex h-12 shrink-0 items-center gap-1 rounded-xl px-3 text-label-lg transition-colors disabled:opacity-50',
            e.auto ? 'bg-primary-fixed/60 text-on-primary-fixed-variant' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
          )}
        >
          {e.auto && <CircleCheck className="size-4" />}
          {exactLabel}
        </button>
      </div>

      {quick.length > 0 && !e.needsRate && (
        <div className="flex flex-col gap-1.5">
          <span className="text-label-md text-on-surface-variant">
            {quick[0].additive ? 'Billetes recibidos (se suman)' : 'Recibido rápido'}
          </span>
          <div
            className={cn('grid gap-1.5', quick[0].additive ? 'grid-cols-3 @sm:grid-cols-6' : 'grid-cols-2 @sm:grid-cols-4')}
            role="group"
            aria-label="Montos recibidos rápidos"
          >
            {quick.map((q) => {
              const active = !q.additive && !e.auto && e.amount === q.value;
              return (
                <button
                  key={q.value}
                  type="button"
                  disabled={disabled}
                  aria-pressed={q.additive ? undefined : active}
                  onClick={() => (q.additive ? pay.addBill(e.key, q.value) : pay.setAmount(e.key, q.value))}
                  className={cn(
                    'h-10 truncate rounded-lg px-1.5 text-label-lg tnum transition-colors pointer-coarse:h-11 disabled:opacity-55',
                    active
                      ? 'bg-primary text-on-primary shadow-card'
                      : 'border border-slate-200 bg-white text-on-surface hover:border-primary/40 hover:bg-primary-fixed/10'
                  )}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {m.requiresReference && (
        <div className="flex flex-col gap-1">
          <label htmlFor={refId} className="text-label-md text-slate-700">
            Referencia<span className="ml-0.5 text-error">*</span>
          </label>
          <input
            id={refId}
            data-pay-ref={e.key}
            value={e.reference}
            onChange={(ev) => pay.setReference(e.key, ev.target.value)}
            onKeyDown={submitOnEnter}
            disabled={disabled}
            maxLength={30}
            autoComplete="off"
            inputMode={e.isLocal ? 'numeric' : 'text'}
            placeholder={e.isLocal ? 'Últimos 4–6 dígitos' : 'Número o código de confirmación'}
            aria-invalid={refMissing || undefined}
            className={cn(
              'h-11 w-full rounded-lg border bg-white px-3 text-body-lg text-on-surface tnum transition-colors placeholder:text-slate-400 focus:ring-2 focus:outline-none',
              refMissing ? 'border-error focus:ring-error/25' : 'border-slate-300 focus:border-primary focus:ring-primary/25'
            )}
          />
          {refMissing && <p className="text-body-sm text-error">Escribe la referencia para poder cobrar.</p>}
        </div>
      )}

      {e.auto && amount === 0 && e.remainingBefore === 0 && count > 1 && (
        <p className="text-body-sm text-on-surface-variant">El total ya está cubierto con los pagos anteriores.</p>
      )}
      {e.excess > 0 && !isCash && (
        <p className="flex items-start gap-1.5 text-body-sm text-amber-800">
          <TriangleAlert className="mt-px size-4 shrink-0 text-amber-600" />
          Este pago supera lo que faltaba por {money(e.excess)}: la diferencia se entrega como vuelto.
        </p>
      )}
      {hint && (
        <p className="flex items-start gap-1.5 text-body-sm text-on-surface-variant">
          <Info className="mt-px size-4 shrink-0 text-secondary" />
          {hint}
        </p>
      )}
    </li>
  );
}

function RemoveButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-error disabled:opacity-50"
    >
      <X className="size-[18px]" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Resumen: total, IGTF, pagado, resta / vuelto                        */
/* ------------------------------------------------------------------ */

function PaymentSummary({
  pay,
  total,
  dual,
  money,
  localFmt,
  formatLocal,
  igtfRate
}: {
  pay: PaymentsApi;
  total: number;
  dual: boolean;
  money: (n: number) => string;
  localFmt: ((n: number) => string) | null;
  /** Formatea un monto ya expresado en Bs. */
  formatLocal: (n: number) => string;
  igtfRate: number;
}) {
  const { result, entries, paid } = pay;
  // Lo entregado en Bs según lo capturado (no reconvertido desde $ redondeados).
  const paidLocal = pay.rate
    ? entries.reduce((acc, e) => acc + (e.needsRate ? 0 : (e.value ?? 0) * (e.isLocal ? 1 : (pay.rate as number))), 0)
    : 0;
  const igtf = result.igtf;
  const remaining = result.remaining;
  const excess = result.excess;
  const showBreakdown = (dual || entries.length > 1) && total > 0;
  const single = entries.length === 1 ? entries[0] : null;

  const status: 'empty' | 'due' | 'done' = !entries.length ? 'empty' : remaining > 0 ? 'due' : 'done';
  const leftLabel =
    status === 'empty'
      ? 'Elige cómo paga el cliente'
      : status === 'due'
        ? 'Resta por cobrar'
        : single?.method
          ? single.auto
            ? 'Paga con el monto exacto'
            : `Paga con ${pay.formatIn(single.value ?? 0, single.method)}`
          : excess > 0
            ? `Pagado ${money(paid)}`
            : 'Pago completo';
  const big = status === 'empty' ? result.amountDue : status === 'due' ? remaining : excess;
  const bigLabel = status === 'done' ? 'Vuelto' : status === 'due' ? 'Resta' : 'Total';

  return (
    <div className="flex flex-col gap-2">
      {showBreakdown && (
        <dl className="flex flex-col gap-1 rounded-xl bg-surface-container-low px-3 py-2.5">
          <SummaryRow label="Total" value={money(total)} local={localFmt?.(total)} />
          {igtf > 0 && (
            <>
              <SummaryRow label={`IGTF (${igtfRate}%)`} value={money(igtf)} />
              <SummaryRow label="Total a cobrar" value={money(result.amountDue)} local={localFmt?.(result.amountDue)} strong />
            </>
          )}
          {!pay.noPayments && <SummaryRow label="Pagado" value={money(paid)} local={localFmt ? formatLocal(paidLocal) : undefined} />}
        </dl>
      )}

      <div
        aria-live="polite"
        className={cn(
          'flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl px-3 py-2.5',
          status === 'due'
            ? 'bg-error-container text-on-error-container'
            : status === 'empty'
              ? 'bg-surface-container text-on-surface'
              : 'bg-primary-fixed/60 text-on-primary-fixed-variant'
        )}
      >
        <span className="flex min-w-0 items-center gap-2 text-label-md">
          {status === 'due' ? <CircleAlert className="size-[18px] shrink-0" /> : status === 'empty' ? <Wallet className="size-[18px] shrink-0" /> : <HandCoins className="size-[18px] shrink-0" />}
          <span className="min-w-0">{leftLabel}</span>
        </span>
        <span className="ml-auto flex flex-col items-end">
          <span className="text-headline-sm font-bold whitespace-nowrap tnum @sm:text-headline-md">
            {bigLabel}: {money(big)}
          </span>
          {localFmt && (status !== 'done' || big > 0) && <span className="text-label-lg whitespace-nowrap tnum">{localFmt(big)}</span>}
        </span>
      </div>

      {pay.hasChange && <ChangePicker pay={pay} dual={dual} />}
    </div>
  );
}

function SummaryRow({ label, value, local, strong }: { label: string; value: string; local?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn('text-body-md', strong ? 'font-semibold text-on-surface' : 'text-on-surface-variant')}>{label}</dt>
      <dd className="flex flex-wrap items-baseline justify-end gap-x-2 text-right tnum">
        <span className={cn('font-semibold text-on-surface', strong ? 'text-label-lg' : 'text-body-md')}>{value}</span>
        {local && <span className="text-body-sm text-secondary">{local}</span>}
      </dd>
    </div>
  );
}

/** Cómo se entrega el vuelto (efectivo $, efectivo Bs, pago móvil…). */
function ChangePicker({ pay, dual }: { pay: PaymentsApi; dual: boolean }) {
  const { changeOptions, changeMethod, result } = pay;
  if (!changeOptions.length) {
    return (
      <p className="flex items-start gap-1.5 rounded-xl bg-error-container px-3 py-2 text-body-sm text-on-error-container">
        <CircleAlert className="mt-px size-4 shrink-0" />
        No hay una forma de pago habilitada para dar vuelto. Ajusta los montos para cobrar exacto.
      </p>
    );
  }
  // Una sola opción y una sola moneda: el recuadro de arriba ya lo dice todo.
  if (changeOptions.length === 1 && !dual) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label-md text-on-surface-variant">Entregar vuelto en</span>
      <div role="radiogroup" aria-label="Entregar vuelto en" className="grid grid-cols-1 gap-1.5 @sm:grid-cols-3">
        {changeOptions.map((m) => {
          const active = changeMethod?.id === m.id;
          const amount = baseToMethod(result.excess, m, pay.rate);
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => pay.setChangeMethodId(m.id)}
              className={cn(
                'flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-colors pointer-coarse:min-h-12 @sm:flex-col @sm:items-start @sm:justify-center @sm:gap-0',
                active ? 'bg-primary text-on-primary shadow-card' : 'border border-slate-200 bg-white text-on-surface hover:border-primary/40'
              )}
            >
              <span className="text-label-md">{m.label}</span>
              <span className="text-headline-sm whitespace-nowrap tnum">{pay.formatIn(amount, m)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
