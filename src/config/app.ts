import type { InventorySettings, PaymentMethod, Permission, Role } from '@/types';

export const APP_NAME = 'Nabux';
export const APP_TAGLINE = 'Inventario y punto de venta en la nube';

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  manager: 'Supervisor',
  cashier: 'Cajero / Vendedor',
  warehouse: 'Bodeguero / Almacén'
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'Control total del negocio',
  admin: 'Acceso total y finanzas',
  manager: 'Ventas, inventario, anulaciones y reportes',
  cashier: 'POS, cobros y cortes de caja',
  warehouse: 'Productos, entradas y conteos de stock'
};

/** Colores de acento por rol (clases Tailwind para el punto/insignia). */
export const ROLE_TONES: Record<Role, 'primary' | 'info' | 'warning' | 'neutral' | 'success'> = {
  owner: 'primary',
  admin: 'success',
  manager: 'warning',
  cashier: 'info',
  warehouse: 'neutral'
};

export const ASSIGNABLE_ROLES: Exclude<Role, 'owner'>[] = ['cashier', 'manager', 'warehouse', 'admin'];

export const ALL_PERMISSIONS: Permission[] = ['pos', 'discounts', 'void', 'inventory', 'reports', 'staff', 'settings'];

export const PERMISSION_LABELS: Record<Permission, { label: string; description: string }> = {
  pos: { label: 'Vender en el POS', description: 'Cobrar tickets y abrir/cerrar su caja' },
  discounts: { label: 'Aplicar descuentos', description: 'Hasta el máximo configurado por ticket' },
  void: { label: 'Anular ventas', description: 'Revierte el ticket y devuelve el stock' },
  inventory: { label: 'Gestionar inventario', description: 'Productos, precios, entradas y ajustes' },
  reports: { label: 'Ver reportes y finanzas', description: 'Ventas de todo el equipo, márgenes y cortes' },
  staff: { label: 'Gestionar personal', description: 'Invitar, editar y dar de baja usuarios' },
  settings: { label: 'Configurar el negocio', description: 'Datos fiscales, impuestos y reglas' }
};

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [...ALL_PERMISSIONS],
  admin: [...ALL_PERMISSIONS],
  manager: ['pos', 'discounts', 'void', 'inventory', 'reports'],
  cashier: ['pos'],
  warehouse: ['inventory']
};

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'card', label: 'Tarjeta' },
  { id: 'transfer', label: 'Transferencia / QR' }
];

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia / QR'
};

export const UNITS = ['Unidad', 'Pieza', 'Caja', 'Paquete', 'Kg', 'Gramo', 'Litro', 'Mililitro', 'Metro', 'Docena', 'Par', 'Servicio'];

export const BUSINESS_TYPES = [
  'Abarrotes / Minisúper',
  'Tienda de ropa y calzado',
  'Ferretería',
  'Farmacia',
  'Papelería',
  'Electrónica y tecnología',
  'Cafetería / Restaurante',
  'Panadería / Pastelería',
  'Belleza y cuidado personal',
  'Refacciones / Autopartes',
  'Mascotas',
  'Otro'
];

export const DEFAULT_CATEGORIES_BY_TYPE: Record<string, string[]> = {
  'Abarrotes / Minisúper': ['Abarrotes', 'Bebidas', 'Lácteos', 'Panadería', 'Snacks y Dulces', 'Limpieza', 'Cuidado Personal'],
  'Tienda de ropa y calzado': ['Dama', 'Caballero', 'Niños', 'Calzado', 'Accesorios'],
  Ferretería: ['Herramientas', 'Eléctrico', 'Plomería', 'Pinturas', 'Tornillería', 'Jardín'],
  Farmacia: ['Medicamentos', 'Cuidado Personal', 'Bebé', 'Vitaminas', 'Curación'],
  Papelería: ['Escolar', 'Oficina', 'Arte', 'Impresión', 'Regalos'],
  'Electrónica y tecnología': ['Accesorios', 'Audio', 'Cómputo', 'Celulares', 'Cables y Cargadores'],
  'Cafetería / Restaurante': ['Bebidas Calientes', 'Bebidas Frías', 'Alimentos', 'Postres', 'Insumos'],
  'Panadería / Pastelería': ['Pan Dulce', 'Pan Salado', 'Pasteles', 'Bebidas', 'Insumos'],
  'Belleza y cuidado personal': ['Cabello', 'Uñas', 'Maquillaje', 'Piel', 'Servicios'],
  'Refacciones / Autopartes': ['Motor', 'Frenos', 'Eléctrico', 'Lubricantes', 'Accesorios'],
  Mascotas: ['Alimento', 'Accesorios', 'Higiene', 'Salud'],
  Otro: ['General']
};

export interface CurrencyOption {
  code: string;
  label: string;
  locale: string;
  taxRate: number;
  taxName: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'MXN', label: 'Peso mexicano (MXN)', locale: 'es-MX', taxRate: 16, taxName: 'IVA' },
  { code: 'USD', label: 'Dólar estadounidense (USD)', locale: 'es-US', taxRate: 0, taxName: 'Impuesto' },
  { code: 'COP', label: 'Peso colombiano (COP)', locale: 'es-CO', taxRate: 19, taxName: 'IVA' },
  { code: 'ARS', label: 'Peso argentino (ARS)', locale: 'es-AR', taxRate: 21, taxName: 'IVA' },
  { code: 'CLP', label: 'Peso chileno (CLP)', locale: 'es-CL', taxRate: 19, taxName: 'IVA' },
  { code: 'PEN', label: 'Sol peruano (PEN)', locale: 'es-PE', taxRate: 18, taxName: 'IGV' },
  { code: 'GTQ', label: 'Quetzal (GTQ)', locale: 'es-GT', taxRate: 12, taxName: 'IVA' },
  { code: 'DOP', label: 'Peso dominicano (DOP)', locale: 'es-DO', taxRate: 18, taxName: 'ITBIS' },
  { code: 'BOB', label: 'Boliviano (BOB)', locale: 'es-BO', taxRate: 13, taxName: 'IVA' },
  { code: 'UYU', label: 'Peso uruguayo (UYU)', locale: 'es-UY', taxRate: 22, taxName: 'IVA' },
  { code: 'CRC', label: 'Colón costarricense (CRC)', locale: 'es-CR', taxRate: 13, taxName: 'IVA' },
  { code: 'HNL', label: 'Lempira (HNL)', locale: 'es-HN', taxRate: 15, taxName: 'ISV' },
  { code: 'PYG', label: 'Guaraní (PYG)', locale: 'es-PY', taxRate: 10, taxName: 'IVA' },
  { code: 'EUR', label: 'Euro (EUR)', locale: 'es-ES', taxRate: 21, taxName: 'IVA' }
];

export const DEFAULT_INVENTORY_SETTINGS: InventorySettings = {
  lowStockDefault: 5,
  allowNegativeStock: false,
  minMarginPct: 25,
  requireCashSession: true,
  maxDiscountPct: 15,
  skuPrefix: 'PRD',
  scanBeep: true
};

export const DEFAULT_RECEIPT_FOOTER = '¡Gracias por su compra! Conserve este ticket para cualquier aclaración.';

export const FREE_AMOUNT_ITEM_NAME = 'Venta no catalogada';
