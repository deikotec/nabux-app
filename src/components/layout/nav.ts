import type { LucideIcon } from 'lucide-react';
import { BarChart3, LayoutDashboard, Package, ReceiptText, Settings, ShoppingCart, Users } from 'lucide-react';
import type { Permission } from '@/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Permiso necesario para ver la sección (sin permiso = todos los miembros). */
  perm?: Permission;
  kbd?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Panel Principal', icon: LayoutDashboard },
  { to: '/pos', label: 'Terminal POS', icon: ShoppingCart, perm: 'pos', kbd: 'F2' },
  { to: '/inventario', label: 'Inventario & Stock', icon: Package },
  { to: '/ventas', label: 'Ventas', icon: ReceiptText },
  { to: '/reportes', label: 'Reportes & Métricas', icon: BarChart3, perm: 'reports' },
  { to: '/personal', label: 'Personal & Usuarios', icon: Users, perm: 'staff' },
  { to: '/configuracion', label: 'Configuración', icon: Settings, perm: 'settings' }
];
