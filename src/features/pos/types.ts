/** Línea del ticket en curso (una por producto; los "montos libres" van sueltos). */
export interface CartLine {
  /** Id estable de la línea: el id del producto o "free-…" para montos libres. */
  key: string;
  /** null para monto libre (artículo no catalogado). */
  productId: string | null;
  name: string;
  sku: string;
  category: string;
  unit: string;
  unitPrice: number;
  unitCost: number;
  qty: number;
  /** Exento de IVA (se marca "(E)" en el ticket). */
  taxExempt?: boolean;
}

export type DiscountMode = 'pct' | 'amount';

/** Descuento capturado por el cajero (se convierte a monto al calcular totales). */
export interface TicketDiscount {
  mode: DiscountMode;
  value: number;
}

/**
 * Pago capturado en el POS (borrador antes de cobrar). Un ticket puede tener varios (pago mixto).
 * Mientras `auto` sea true el monto lo calcula el POS (exacto para cubrir lo que falta, con IGTF)
 * y sigue al total si cambia el ticket; al editarlo el cajero, queda fijo.
 */
export interface PaymentEntry {
  key: string;
  methodId: string;
  /** Monto entregado en la moneda del método (se ignora mientras `auto` sea true). */
  amount: number | '';
  reference: string;
  auto: boolean;
}

/** Ticket pausado (F8). Se guarda en localStorage por negocio. */
export interface HeldTicket {
  id: string;
  /** Epoch ms. */
  createdAt: number;
  lines: CartLine[];
  discount: TicketDiscount | null;
  customerName: string;
  itemCount: number;
  /** Total en moneda base. */
  total: number;
  cashierName: string;
  /** Pagos que ya se habían registrado (versiones nuevas). */
  payments?: PaymentEntry[];
  changeMethodId?: string | null;
}

/** Estado de stock de una línea, calculado contra el catálogo en tiempo real. */
export interface LineStockState {
  tone: 'ok' | 'low' | 'over' | 'gone' | 'free';
  /** Etiqueta corta visible ("Stock OK", "Bajo stock"…). */
  label: string;
  /** Detalle para el tooltip. */
  detail: string;
}
