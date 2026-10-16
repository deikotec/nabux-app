import type { LucideIcon } from 'lucide-react';
import { BarChart3, LayoutDashboard, Package, ReceiptText, Settings, ShoppingCart, Users } from 'lucide-react';
import type { Permission } from '@/types';

export interface NavItem {
  to: string;
  label: string;
  /** Nombre corto para la barra de navegación inferior (móvil). */
  short: string;
  icon: LucideIcon;
  /** Permiso necesario para ver la sección (sin permiso = todos los miembros). */
  perm?: Permission;
  kbd?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Panel Principal', short: 'Inicio', icon: LayoutDashboard },
  { to: '/pos', label: 'Terminal POS', short: 'Vender', icon: ShoppingCart, perm: 'pos', kbd: 'F2' },
  { to: '/inventario', label: 'Inventario & Stock', short: 'Inventario', icon: Package },
  { to: '/ventas', label: 'Ventas', short: 'Ventas', icon: ReceiptText },
  { to: '/reportes', label: 'Reportes & Métricas', short: 'Reportes', icon: BarChart3, perm: 'reports' },
  { to: '/personal', label: 'Personal & Usuarios', short: 'Personal', icon: Users, perm: 'staff' },
  { to: '/configuracion', label: 'Configuración', short: 'Ajustes', icon: Settings, perm: 'settings' }
];

/** Secciones que van en la barra inferior del móvil (las 4 primeras permitidas); el resto queda en "Más". */
export const BOTTOM_NAV_CANDIDATES = ['/', '/pos', '/inventario', '/ventas', '/reportes'];
