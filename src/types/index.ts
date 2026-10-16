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

/** Métodos de las primeras versiones (ventas antiguas). */
export type LegacyPaymentMethod = 'cash' | 'card' | 'transfer';

/** Id de un método de pago configurado (ej. "cash_usd", "pago_movil") o legado ("cash"). */
export type PaymentMethod = string;

/* ---------------- Multimoneda (Venezuela: USD + Bs) ---------------- */

/** Fuente de la tasa de cambio que usa el POS. */
export type RateSource = 'bcv' | 'parallel' | 'custom';

export interface FxSettings {
  /** Modo bimonetario: precios en moneda base (USD) y cobro también en moneda local (Bs). */
  enabled: boolean;
  /** Moneda local de cobro, ej. "VES". */
  localCurrency: string;
  /** Locale para formatear la moneda local, ej. "es-VE". */
  localLocale: string;
  /** Tasa con la que se convierten los precios en el POS. */
  rateSource: RateSource;
  /** Consultar automáticamente BCV y paralelo en internet al abrir la app. */
  autoUpdate: boolean;
  /** IGTF (Impuesto a las Grandes Transacciones Financieras) sobre pagos en divisas. */
  igtfEnabled: boolean;
  /** Tasa del IGTF en %, ej. 3. */
  igtfRate: number;
  /** Redondeo de montos en moneda local: 0.01, 1, 5, 10… */
  localRounding: number;
}

/** Tasas vigentes: unidades de moneda local por 1 unidad de moneda base (Bs por $). */
export interface FxRates {
  bcv: number | null;
  parallel: number | null;
  custom: number | null;
  /** Fecha de vigencia publicada por el BCV (yyyy-mm-dd). */
  bcvDate?: string | null;
  parallelUpdatedAt?: string | null;
  updatedAt?: TS;
  updatedBy?: string | null;
  updatedByName?: string | null;
  /** "auto" si vino de internet, "manual" si la cargó alguien. */
  source?: 'auto' | 'manual';
}

export interface FxHistoryEntry extends Omit<FxRates, 'updatedAt'> {
  id: string;
  userId: string;
  userName: string;
  createdAt?: TS;
}

export type PaymentKind = 'cash' | 'mobile' | 'card' | 'transfer' | 'crypto' | 'credit' | 'other';

/** Forma de pago configurable por negocio. */
export interface PaymentMethodConfig {
  id: string;
  label: string;
  /** "base" = moneda de referencia (USD), "local" = moneda local (Bs). */
  currency: 'base' | 'local';
  kind: PaymentKind;
  /** Aplica IGTF (pagos en divisas). */
  igtf: boolean;
  /** Pide número de referencia (pago móvil, transferencia, Zelle…). */
  requiresReference: boolean;
  /** Se puede usar para entregar vuelto. */
  allowsChange: boolean;
  active: boolean;
}

/** Pago aplicado a una venta (una venta puede tener varios: pago mixto). */
export interface SalePayment {
  methodId: string;
  label: string;
  /** Moneda ISO del pago ("USD", "VES"). */
  currency: string;
  kind: PaymentKind;
  /** Monto entregado en la moneda del pago (incluye IGTF y lo que se devolvió de vuelto). */
  amount: number;
  /** Parte que cubre la venta, en moneda base (sin IGTF ni vuelto). */
  amountBase: number;
  /** IGTF cobrado sobre este pago, en moneda base. */
  igtf: number;
  reference?: string;
}

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
  /** País (ej. "VE") para ajustes regionales. */
  country?: string;
  /** Configuración bimonetaria (USD + Bs). Ausente o enabled=false → una sola moneda. */
  fx?: FxSettings;
  /** Formas de pago del negocio. Si falta, se usan las predeterminadas del país. */
  paymentMethods?: PaymentMethodConfig[];
  /** Cajas registradoras. Si falta, el negocio tiene una sola ("Caja principal"). */
  registers?: CashRegister[];
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
  /** Exento de IVA (ej. alimentos de la canasta básica). */
  taxExempt?: boolean;
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
  /** Exento de IVA. */
  taxExempt?: boolean;
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
  /** Método principal (el de mayor monto) o "mixed" si hubo varios. Ventas antiguas: cash|card|transfer. */
  paymentMethod: PaymentMethod;
  /** Pagos aplicados (ventas nuevas). Para ventas antiguas usa salePayments(sale). */
  payments?: SalePayment[];
  /** Moneda base de la venta (ej. "USD"). */
  currency?: string;
  /** Moneda local y tasa usada (modo bimonetario). */
  localCurrency?: string | null;
  rate?: number | null;
  rateSource?: RateSource | null;
  /** Total en moneda local (total × tasa). */
  totalLocal?: number | null;
  /** % de IGTF con que se cobró la venta. */
  igtfRate?: number | null;
  /** IGTF total cobrado (moneda base). No forma parte de `total`. */
  igtf?: number;
  /** Total cobrado al cliente = total + igtf (moneda base). */
  amountDue?: number;
  /** Vuelto entregado: método, moneda y monto en esa moneda. */
  changeMethodId?: string | null;
  changeCurrency?: string | null;
  changeAmount?: number | null;
  /** Ventas antiguas en efectivo. */
  cashReceived?: number | null;
  /** Vuelto en moneda base. */
  change?: number | null;
  customerName?: string;
  cashierId: string;
  cashierName: string;
  sessionId?: string | null;
  /** Caja registradora donde se cobró. */
  registerId?: string | null;
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

export interface MethodTotal {
  label: string;
  /** Moneda ISO del método. */
  currency: string;
  kind: PaymentKind;
  /** Neto recibido en la moneda del método (descontando vueltos entregados con ese método). */
  amount: number;
  /** Equivalente en moneda base (parte aplicada a ventas). */
  amountBase: number;
  count: number;
}

export interface PaymentTotals {
  /** Ventas totales (moneda base, sin IGTF). */
  total: number;
  count: number;
  /** IGTF cobrado (moneda base). */
  igtf?: number;
  /** Totales por método de pago. */
  byMethod?: Record<string, MethodTotal>;
  /** Efectivo neto en moneda base (USD) y en moneda local (Bs). */
  cashBase?: number;
  cashLocal?: number;
  /** Compatibilidad con cortes antiguos. */
  cash: number;
  card: number;
  transfer: number;
}

export interface CashSession {
  id: string;
  status: 'open' | 'closed';
  openedBy: string;
  openedByName: string;
  openedAt?: TS;
  /** Fondo inicial en moneda base (USD). */
  openingFloat: number;
  /** Fondo inicial en moneda local (Bs), modo bimonetario. */
  openingFloatLocal?: number | null;
  localCurrency?: string | null;
  closedAt?: TS;
  closedBy?: string | null;
  closedByName?: string | null;
  declaredCash?: number | null;
  expectedCash?: number | null;
  difference?: number | null;
  /** Efectivo en moneda local: contado, esperado y diferencia. */
  declaredCashLocal?: number | null;
  expectedCashLocal?: number | null;
  differenceLocal?: number | null;
  totals?: PaymentTotals | null;
  notes?: string;
  /**
   * Caja registradora del turno. Los turnos sin caja son de la versión anterior (caja personal de
   * quien la abrió); los turnos con caja los comparten todos los que cobran en ella.
   */
  registerId?: string | null;
  registerName?: string | null;
  /** Totales que se suman venta a venta (turnos con caja): el corte no necesita leer las ventas de otros. */
  live?: SessionLive;
  /** Quiénes han cobrado en este turno. */
  cashierIds?: string[];
}

/** Caja registradora del negocio (un cajón / punto de cobro). */
export interface CashRegister {
  id: string;
  name: string;
  active: boolean;
}

/**
 * Estado en vivo de una caja (businesses/{bid}/registers/{id}): qué turno tiene abierto.
 * Funciona como candado: las reglas impiden abrir un segundo turno en la misma caja.
 */
export interface RegisterState {
  openSessionId: string | null;
  registerName?: string | null;
  openedBy?: string | null;
  openedByName?: string | null;
  openedAt?: TS;
  closedAt?: TS;
  closedByName?: string | null;
}

/** Acumulado de un turno compartido (moneda base, salvo `byMethod[].amount` que va en la moneda del método). */
export interface SessionLive {
  total: number;
  count: number;
  igtf: number;
  byMethod: Record<string, MethodTotal>;
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
