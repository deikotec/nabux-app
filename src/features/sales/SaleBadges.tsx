import type { LucideIcon } from 'lucide-react';
import { ArrowLeftRight, Banknote, Bitcoin, CloudOff, CreditCard, HandCoins, Smartphone, Split, Wallet } from 'lucide-react';
import { useFx } from '@/contexts/FxContext';
import { formatRate } from '@/lib/fx';
import { salePayments } from '@/lib/payments';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';
import type { PaymentKind, Sale, SalePayment } from '@/types';
import { isMixedSale, SALE_STATUS_LABEL, saleLocalTotal } from './saleUtils';

/** Ícono por tipo de forma de pago (las formas de pago son configurables; el tipo es fijo). */
export const KIND_ICONS: Record<PaymentKind, LucideIcon> = {
  cash: Banknote,
  mobile: Smartphone,
  card: CreditCard,
  transfer: ArrowLeftRight,
  crypto: Bitcoin,
  credit: HandCoins,
  other: Wallet
};

export const KIND_TONES: Record<PaymentKind, string> = {
  cash: 'text-primary',
  mobile: 'text-violet-600',
  card: 'text-secondary',
  transfer: 'text-tertiary-container',
  crypto: 'text-amber-600',
  credit: 'text-rose-600',
  other: 'text-on-surface-variant'
};

/** Etiquetas compactas para nombres largos de métodos antiguos. */
const SHORT_LABELS: Record<string, string> = {
  'Transferencia / QR': 'Transferencia'
};

type PaymentsOf = Pick<Sale, 'payments' | 'paymentMethod' | 'total' | 'currency'>;

/**
 * Clases para mostrar solo el ícono cuando el contenedor (`@container`) es más angosto que el umbral.
 * [etiqueta solo para lectores de pantalla, etiqueta visible]
 */
const COMPACT_BELOW = {
  '42rem': ['sr-only @min-[42rem]:hidden', 'hidden @min-[42rem]:inline-flex'],
  '52rem': ['sr-only @min-[52rem]:hidden', 'hidden @min-[52rem]:inline-flex']
} as const;

/** Formatea el monto de un pago en su propia moneda (ventas antiguas: moneda base). */
function usePaymentAmount(sale: PaymentsOf) {
  const { moneyIn, baseCurrency } = useFx();
  return (p: SalePayment) => moneyIn(p.amount, p.currency || sale.currency || baseCurrency);
}

/**
 * Forma de pago de una venta con ícono (estilo "chip" del mockup). Ventas con varios pagos muestran
 * "Mixto" y el detalle de cada pago en el tooltip (y para lectores de pantalla).
 * `short` usa etiquetas compactas; `compactBelow` deja solo el ícono en contenedores angostos.
 */
export function PaymentBadge({
  sale,
  short,
  compactBelow,
  className
}: {
  sale: PaymentsOf;
  short?: boolean;
  compactBelow?: keyof typeof COMPACT_BELOW;
  className?: string;
}) {
  const amount = usePaymentAmount(sale);
  const payments = salePayments(sale);
  const mixed = isMixedSale(sale, payments);
  const first = payments[0];
  const Icon = mixed ? Split : (KIND_ICONS[first?.kind] ?? Wallet);
  const tone = mixed ? 'text-on-surface' : (KIND_TONES[first?.kind] ?? KIND_TONES.other);
  const full = mixed ? 'Pago mixto' : (first?.label ?? '—');
  const label = mixed ? 'Mixto' : short ? (SHORT_LABELS[full] ?? full) : full;
  const detail = payments.map((p) => `${p.label}: ${amount(p)}${p.reference ? ` · Ref. ${p.reference}` : ''}`);
  const title = mixed ? `Pago mixto\n${detail.join('\n')}` : (detail[0] ?? full);

  const text = (
    <>
      {label}
      {mixed && payments.length > 1 && (
        <span className="rounded bg-white px-1 text-[10px] leading-4 font-bold text-on-surface-variant tnum" aria-hidden>
          {payments.length}
        </span>
      )}
    </>
  );

  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md bg-surface-container-low px-2 py-1 text-label-sm whitespace-nowrap text-on-surface',
        className
      )}
    >
      <Icon className={cn('size-3.5 shrink-0', tone)} aria-hidden />
      {compactBelow ? (
        <>
          <span className={COMPACT_BELOW[compactBelow][0]}>{label}</span>
          <span className={cn('items-center gap-1', COMPACT_BELOW[compactBelow][1])}>{text}</span>
        </>
      ) : (
        <span className="inline-flex items-center gap-1">{text}</span>
      )}
      {mixed && <span className="sr-only">: {detail.join(', ')}</span>}
    </span>
  );
}

/**
 * Detalle de pagos bajo el método: en ventas mixtas, cada pago con su monto en su moneda;
 * en ventas de un solo pago, solo la referencia (si la hay). Útil para conciliar.
 */
export function PaymentDetail({ sale, className }: { sale: PaymentsOf; className?: string }) {
  const amount = usePaymentAmount(sale);
  const payments = salePayments(sale);
  if (!isMixedSale(sale, payments)) {
    const ref = payments[0]?.reference;
    return ref ? (
      <span className={cn('block max-w-44 truncate text-body-sm text-on-surface-variant tnum', className)} title={`Referencia ${ref}`}>
        Ref. {ref}
      </span>
    ) : null;
  }
  return (
    <ul className={cn('flex flex-col gap-0.5 text-body-sm text-on-surface-variant', className)} aria-label="Detalle del pago mixto">
      {payments.map((p, i) => {
        const Icon = KIND_ICONS[p.kind] ?? Wallet;
        return (
          <li key={`${p.methodId}-${i}`} className="min-w-0">
            <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
              <Icon className={cn('size-3 shrink-0', KIND_TONES[p.kind] ?? KIND_TONES.other)} aria-hidden />
              <span className="truncate">{p.label}</span>
              <span className="font-semibold text-on-surface tnum">{amount(p)}</span>
            </span>
            {p.reference && (
              <span className="block truncate pl-[18px] tnum" title={`Referencia ${p.reference}`}>
                Ref. {p.reference}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Total de la venta en moneda local, a la tasa guardada en la venta (nada si no tiene tasa). */
export function SaleLocalAmount({ sale, className }: { sale: Sale; className?: string }) {
  const { moneyIn, localCurrency } = useFx();
  const local = saleLocalTotal(sale);
  if (local === null) return null;
  return (
    <span
      className={cn('block text-body-sm font-normal whitespace-nowrap text-on-surface-variant tnum', className)}
      title={sale.rate ? `A la tasa de la venta: ${formatRate(sale.rate)}` : undefined}
    >
      {moneyIn(local, sale.localCurrency || localCurrency)}
    </span>
  );
}

export function SaleStatusBadge({ status }: { status: Sale['status'] }) {
  return (
    <Badge tone={status === 'voided' ? 'danger' : 'primary'} dot>
      {SALE_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function OfflineBadge() {
  return (
    <Badge tone="warning" size="xs" icon={CloudOff}>
      Sin conexión
    </Badge>
  );
}
