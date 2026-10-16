import { useEffect, useRef } from 'react';
import { ArrowRight, ChevronUp, LockKeyhole, Loader2 } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PaymentMethodConfig } from '@/types';
import { methodIcon } from './PaymentSection';
import type { PaymentsApi } from './hooks/usePayments';

/** Nombres cortos para que quepan cuatro botones en un celular angosto. */
const SHORT_LABELS: Record<string, string> = {
  punto: 'Punto',
  transfer: 'Transf. / QR',
  transfer_ves: 'Transf. Bs',
  usdt: 'USDT'
};

const shortLabel = (m: Pick<PaymentMethodConfig, 'id' | 'label'>) => SHORT_LABELS[m.id] ?? m.label;

/**
 * Formas de pago principales para la barra: efectivo $, efectivo Bs, pago móvil y punto de venta
 * (en negocios de una sola moneda, las primeras activas). El resto se elige desde el ticket.
 */
function quickMethods(methods: PaymentMethodConfig[], max = 4) {
  const picks: PaymentMethodConfig[] = [];
  const add = (m: PaymentMethodConfig | undefined) => {
    if (m && picks.length < max && !picks.includes(m)) picks.push(m);
  };
  add(methods.find((m) => m.kind === 'cash' && m.currency === 'base'));
  add(methods.find((m) => m.kind === 'cash' && m.currency === 'local'));
  add(methods.find((m) => m.kind === 'mobile'));
  add(methods.find((m) => m.kind === 'card'));
  methods.forEach(add);
  return picks;
}

interface MobileTicketBarProps {
  /** Productos distintos en el ticket. */
  lineCount: number;
  /** Unidades en el ticket. */
  itemCount: number;
  total: number;
  money: (n: number) => string;
  /** Equivalente en Bs (modo bimonetario con tasa). */
  moneyLocal?: (n: number) => string;
  pay: PaymentsApi;
  /** IGTF vigente (%) para marcar los métodos que lo pagan; null si no aplica. */
  igtfRate: number | null;
  /** El negocio exige caja abierta y está cerrada. */
  cashBlocked: boolean;
  processing: boolean;
  onOpen: () => void;
  onQuickPay: (methodId: string) => void;
  onCheckout: () => void;
  onOpenCash: () => void;
}

/**
 * Panel fijo inferior (móvil/tablet): resumen del ticket (al tocarlo se abre completo), formas de pago
 * principales y botón Cobrar. Con el ticket vacío queda solo el resumen para dejar espacio al catálogo.
 */
export function MobileTicketBar({
  lineCount,
  itemCount,
  total,
  money,
  moneyLocal,
  pay,
  igtfRate,
  cashBlocked,
  processing,
  onOpen,
  onQuickPay,
  onCheckout,
  onOpenCash
}: MobileTicketBarProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Publica su alto en --bottom-bar para que el contenido y los avisos (toasts) queden por encima.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty('--bottom-bar', `${el.offsetHeight}px`);
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--bottom-bar');
    };
  }, []);

  const hasItems = lineCount > 0;
  const methods = quickMethods(pay.methods);
  const entries = pay.entries;
  const last = entries[entries.length - 1];
  const single = entries.length === 1 ? entries[0] : null;
  const { result } = pay;

  // Monto del botón Cobrar: en la moneda del método si se cobra con uno solo (Bs para pago móvil).
  const due =
    single?.auto && single.method && single.value
      ? pay.formatIn(single.value, single.method)
      : money(result.amountDue > 0 ? result.amountDue : total);
  const detail = pay.noPayments
    ? 'Elige cómo paga el cliente'
    : pay.hasChange && pay.changeMethod && pay.changeAmount !== null
      ? `Vuelto: ${pay.formatIn(pay.changeAmount, pay.changeMethod)}`
      : result.remaining > 0
        ? `Resta ${money(result.remaining)}`
        : single?.method
          ? `${shortLabel(single.method)}${single.auto ? ' · exacto' : ''}${result.igtf > 0 ? ' · con IGTF' : ''}`
          : `Pago mixto${result.igtf > 0 ? ' · con IGTF' : ''}`;

  return (
    <div
      ref={ref}
      // Va justo encima de la navegación inferior (--bottom-nav), que ya respeta la barra de inicio del iPhone.
      className="fixed inset-x-0 bottom-[var(--bottom-nav,0px)] z-30 pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] lg:hidden"
    >
      <div className="mx-auto max-w-3xl overflow-hidden rounded-t-3xl bg-white shadow-[0_-10px_28px_-14px_rgba(15,23,42,0.45)]">
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          aria-label={`Ver ticket actual: ${formatNumber(itemCount)} ${itemCount === 1 ? 'artículo' : 'artículos'}, ${money(total)}`}
          className="flex w-full items-center gap-3 bg-inverse-surface px-4 py-2.5 text-left text-inverse-on-surface transition-colors active:bg-inverse-surface/90"
        >
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full text-label-md font-bold tnum',
              hasItems ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-white/15'
            )}
          >
            {lineCount}
          </span>
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span className="truncate text-label-lg font-bold">Ticket actual</span>
            <span className="shrink-0 text-body-sm opacity-70 tnum">({hasItems ? `${formatNumber(itemCount)} un.` : 'vacío'})</span>
          </span>
          <span className="flex shrink-0 flex-col items-end leading-tight">
            <span className="text-headline-sm font-bold text-primary-fixed tnum">{money(total)}</span>
            {moneyLocal && <span className="text-[11px] font-semibold opacity-75 tnum">{moneyLocal(total)}</span>}
          </span>
          <ChevronUp className="size-5 shrink-0 opacity-90" />
        </button>

        {hasItems && (
          <div className="flex flex-col gap-2.5 px-3 pt-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)-var(--bottom-nav,0px)))]">
            {!cashBlocked && (
              <div role="group" aria-label="Forma de pago" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${methods.length}, minmax(0, 1fr))` }}>
                {methods.map((m) => {
                  const Icon = methodIcon(m);
                  const selected = !!last?.auto && last.methodId === m.id;
                  const used = entries.some((e) => e.methodId === m.id);
                  const noRate = m.currency === 'local' && !pay.rate;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={used}
                      disabled={processing || noRate}
                      onClick={() => onQuickPay(m.id)}
                      title={noRate ? 'Sin tasa de cambio: no se puede cobrar en bolívares' : m.label}
                      className={cn(
                        'relative flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[12px] leading-tight font-semibold transition-all active:scale-95 disabled:opacity-45',
                        selected
                          ? 'bg-primary text-on-primary shadow-card'
                          : used
                            ? 'border border-primary/50 bg-primary-fixed/30 text-on-primary-fixed-variant'
                            : 'bg-surface-container text-on-surface'
                      )}
                    >
                      <Icon className="size-5" />
                      <span className="max-w-full truncate">{shortLabel(m)}</span>
                      {igtfRate !== null && m.igtf && (
                        <span
                          className={cn(
                            'absolute top-1 right-1 rounded px-0.5 text-[9px] leading-3 font-bold tnum',
                            selected ? 'bg-white/20 text-white' : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                          )}
                        >
                          +{igtfRate}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {cashBlocked ? (
              <button
                type="button"
                onClick={onOpenCash}
                className="flex h-14 w-full items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 text-left text-amber-900 transition-colors active:bg-amber-100"
              >
                <LockKeyhole className="size-5 shrink-0 text-amber-700" />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="text-label-lg font-bold">Abrir caja para cobrar</span>
                  <span className="truncate text-body-sm text-amber-800">La caja está cerrada</span>
                </span>
                <ArrowRight className="size-5 shrink-0" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onCheckout}
                disabled={processing}
                aria-busy={processing || undefined}
                className="flex h-14 w-full items-center gap-3 rounded-2xl bg-primary px-4 text-left text-on-primary shadow-lift transition-all active:scale-[0.99] disabled:opacity-70"
              >
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-headline-sm font-bold">{processing ? 'Procesando cobro…' : 'Cobrar ticket'}</span>
                  <span className="truncate text-body-sm opacity-85 tnum">{detail}</span>
                </span>
                <span className="shrink-0 text-headline-md font-bold tnum">{due}</span>
                {processing ? <Loader2 className="size-5 shrink-0 animate-spin" /> : <ArrowRight className="size-5 shrink-0" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
