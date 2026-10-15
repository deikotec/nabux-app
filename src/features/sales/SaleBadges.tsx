import type { LucideIcon } from 'lucide-react';
import { ArrowLeftRight, Banknote, CloudOff, CreditCard } from 'lucide-react';
import { PAYMENT_LABELS } from '@/config/app';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';
import type { PaymentMethod, Sale } from '@/types';
import { SALE_STATUS_LABEL } from './saleUtils';

export const PAYMENT_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  transfer: ArrowLeftRight
};

const paymentIconTone: Record<PaymentMethod, string> = {
  cash: 'text-primary',
  card: 'text-secondary',
  transfer: 'text-tertiary-container'
};

const SHORT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia'
};

/**
 * Clases para mostrar solo el ícono cuando el contenedor (`@container`) es más angosto que el umbral.
 * [etiqueta solo para lectores de pantalla, etiqueta visible]
 */
const COMPACT_BELOW = {
  '42rem': ['sr-only @min-[42rem]:hidden', 'hidden @min-[42rem]:inline'],
  '52rem': ['sr-only @min-[52rem]:hidden', 'hidden @min-[52rem]:inline']
} as const;

/**
 * Método de pago con ícono (estilo "chip" del mockup).
 * `short` usa etiquetas compactas; `compactBelow` deja solo el ícono en contenedores angostos
 * (la etiqueta se conserva para lectores de pantalla y como tooltip).
 */
export function PaymentBadge({
  method,
  short,
  compactBelow,
  className
}: {
  method: PaymentMethod;
  short?: boolean;
  compactBelow?: keyof typeof COMPACT_BELOW;
  className?: string;
}) {
  const Icon = PAYMENT_ICONS[method] ?? Banknote;
  const full = PAYMENT_LABELS[method] ?? method;
  const label = short ? (SHORT_LABELS[method] ?? full) : full;
  return (
    <span
      title={full}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md bg-surface-container-low px-2 py-1 text-label-sm whitespace-nowrap text-on-surface',
        className
      )}
    >
      <Icon className={cn('size-3.5 shrink-0', paymentIconTone[method])} aria-hidden />
      {compactBelow ? (
        <>
          <span className={COMPACT_BELOW[compactBelow][0]}>{label}</span>
          <span className={COMPACT_BELOW[compactBelow][1]}>{label}</span>
        </>
      ) : (
        label
      )}
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
