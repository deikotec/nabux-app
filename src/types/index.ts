import type { Timestamp } from 'firebase/firestore';

/** Marca de tiempo tal como llega de Firestore (puede ser null mientras el servidor confirma). */
export type TS = Timestamp | null | undefined;

export type Role = 'owner' | 'admin' | 'manager' | 'cashier' | 'warehouse';

export type Permission =
  | 'pos' // vender en el punto de venta
  | 'discounts' // aplicar descuentos en el POS
  | 'void' // anular ventas
  | 'inventory' // crear/editar productos, ajustar stock, proveedores
  | 'reports' // ver reportes, historial completo de ventas y cortes
  | 'staff' // gestionar personal e invitaciones
  | 'settings'; // configurar el negocio

export type PaymentMethod = 'cash' | 'card' | 'transfer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  businessIds: string[];
  lastBusinessId?: string | null;
  createdAt?: TS;
  updatedAt?: TS;
}

export interface InventorySettings {
  /** Stock mínimo por defecto para productos nuevos. */
  lowStockDefault: number;
  /** Permite vender aunque el stock quede en negativo. */
  allowNegativeStock: boolean;
  /** Margen bruto mínimo recomendado (%); se avisa en la ficha si el precio queda por debajo. */
  minMarginPct: number;
  /** Exige caja abierta para cobrar en el POS. */
  requireCashSession: boolean;
  /** Descuento máximo permitido por ticket (%). */
  maxDiscountPct: number;
  /** Prefijo para SKU autogenerados (ej. "PRD"). */
  skuPrefix: string;
  /** Sonido al escanear / agregar productos en el POS. */
  scanBeep: boolean;
}

export interface Business {
  id: string;
  name: string;
  legalName?: string;
  taxId?: string;
  businessType?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string | null;
  logoPath?: string | null;
  ownerId: string;
  /** Código ISO 4217, ej. "MXN". */
  currency: string;
  /** Locale para formatos, ej. "es-MX". */
  locale: string;
  /** Tasa de impuesto en %, ej. 16. */
  taxRate: number;
  /** Nombre del impuesto, ej. "IVA". */
  taxName: string;
  /** Si los precios de venta ya incluyen el impuesto (lo normal en retail). */
  pricesIncludeTax: boolean;
  categories: string[];
  settings: InventorySettings;
  receiptFooter?: string;
  createdAt?: TS;
  updatedAt?: TS;
}

export interface Member {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  phone?: string;
  role: Role;
  permissions: Permission[];
  status: 'active' | 'suspended';
  shift?: string;
  joinedAt?: TS;
  invitedBy?: string | null;
  lastActiveAt?: TS;
}

export interface Invite {
  id: string;
  businessId: string;
  businessName: string;
  email: string;
  displayName?: string;
  phone?: string;
  shift?: string;
  role: Exclude<Role, 'owner'>;
  permissions: Permission[];
  invitedBy: string;
  invitedByName: string;
  createdAt?: TS;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  brand?: string;
  unit: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  location?: string;
  supplierId?: string | null;
  supplierName?: string | null;
  imageUrl?: string | null;
  imagePath?: string | null;
  active: boolean;
  /** Lowercase "name sku barcode brand" para búsquedas rápidas en cliente. */
  searchText?: string;
  createdAt?: TS;
  updatedAt?: TS;
  lastRestockAt?: TS;
}

export type ProductInput = Omit<
  Product,
  'id' | 'createdAt' | 'updatedAt' | 'lastRestockAt' | 'searchText' | 'imageUrl' | 'imagePath'
> & {
  imageUrl?: string | null;
  imagePath?: string | null;
};

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt?: TS;
}

export interface SaleItem {
  /** null para "monto libre" (artículo no catalogado). */
  productId: string | null;
  name: string;
  sku?: string;
  category?: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
  /** unitPrice * qty */
  total: number;
}

export interface SaleTotals {
  /** Suma bruta de líneas (precio x cantidad). */
  gross: number;
  discount: number;
  /** Base imponible. */
  subtotal: number;
  tax: number;
  total: number;
  cost: number;
  profit: number;
  itemCount: number;
}

export interface Sale extends SaleTotals {
  id: string;
  /** Folio visible, ej. "T-000482" (o "OFF-…" si se registró sin conexión). */
  folio: string;
  number: number | null;
  items: SaleItem[];
  productIds: string[];
  paymentMethod: PaymentMethod;
  cashReceived?: number | null;
  change?: number | null;
  customerName?: string;
  cashierId: string;
  cashierName: string;
  sessionId?: string | null;
  status: 'completed' | 'voided';
  offline?: boolean;
  voidedAt?: TS;
  voidedBy?: string | null;
  voidedByName?: string | null;
  voidReason?: string | null;
  createdAt?: TS;
}

export type MovementType = 'initial' | 'in' | 'out' | 'adjust' | 'sale' | 'void';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  type: MovementType;
  /** Cambio con signo (+ entrada, - salida). */
  qty: number;
  /** Stock resultante si se conoce. */
  stockAfter?: number | null;
  reason?: string;
  refId?: string | null;
  unitCost?: number | null;
  userId: string;
  userName: string;
  createdAt?: TS;
}

export interface PaymentTotals {
  cash: number;
  card: number;
  transfer: number;
  total: number;
  count: number;
}

export interface CashSession {
  id: string;
  status: 'open' | 'closed';
  openedBy: string;
  openedByName: string;
  openedAt?: TS;
  openingFloat: number;
  closedAt?: TS;
  closedBy?: string | null;
  closedByName?: string | null;
  declaredCash?: number | null;
  expectedCash?: number | null;
  difference?: number | null;
  totals?: PaymentTotals | null;
  notes?: string;
}

export type ActivityType =
  | 'sale'
  | 'sale_void'
  | 'product_create'
  | 'product_update'
  | 'product_delete'
  | 'stock_adjust'
  | 'stock_in'
  | 'cash_open'
  | 'cash_close'
  | 'member_invite'
  | 'member_update'
  | 'member_remove'
  | 'member_join'
  | 'settings_update'
  | 'business_create';

export interface ActivityLog {
  id: string;
  type: ActivityType;
  message: string;
  userId: string;
  userName: string;
  refId?: string | null;
  amount?: number | null;
  createdAt?: TS;
}
