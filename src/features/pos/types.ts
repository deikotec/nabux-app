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
}

export type DiscountMode = 'pct' | 'amount';

/** Descuento capturado por el cajero (se convierte a monto al calcular totales). */
export interface TicketDiscount {
  mode: DiscountMode;
  value: number;
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
  total: number;
  cashierName: string;
}

/** Estado de stock de una línea, calculado contra el catálogo en tiempo real. */
export interface LineStockState {
  tone: 'ok' | 'low' | 'over' | 'gone' | 'free';
  /** Etiqueta corta visible ("Stock OK", "Bajo stock"…). */
  label: string;
  /** Detalle para el tooltip. */
  detail: string;
}
