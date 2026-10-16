import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Archive, BarChart3, ChartSpline, LayoutDashboard, Package, ReceiptText, Settings, ShoppingCart, Users } from 'lucide-react';
import type { Permission } from '@/types';
import { PosIcon } from './icons';

export interface NavItem {
  to: string;
  label: string;
  /** Nombre corto para la barra de navegación inferior (móvil). */
  short: string;
  icon: LucideIcon;
  /** Ícono en la barra inferior del móvil (si difiere del de la barra lateral). */
  tabIcon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Permiso necesario para ver la sección (sin permiso = todos los miembros). */
  perm?: Permission;
  kbd?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Panel Principal', short: 'Inicio', icon: LayoutDashboard },
  { to: '/pos', label: 'Terminal POS', short: 'POS', icon: ShoppingCart, tabIcon: PosIcon, perm: 'pos', kbd: 'F2' },
  { to: '/inventario', label: 'Inventario & Stock', short: 'Inventario', icon: Package, tabIcon: Archive },
  { to: '/ventas', label: 'Ventas', short: 'Ventas', icon: ReceiptText },
  { to: '/reportes', label: 'Reportes & Métricas', short: 'Reportes', icon: BarChart3, tabIcon: ChartSpline, perm: 'reports' },
  { to: '/personal', label: 'Personal & Usuarios', short: 'Personal', icon: Users, perm: 'staff' },
  { to: '/configuracion', label: 'Configuración', short: 'Ajustes', icon: Settings, perm: 'settings' }
];

/** Pestañas de la barra inferior del móvil, en este orden (como en ref/movil). */
const BOTTOM_TABS = ['/', '/inventario', '/pos', '/reportes', '/personal'];
/** Si faltan permisos para alguna, se completan con estas (hasta 5). */
const BOTTOM_FALLBACK = ['/ventas', '/configuracion'];

/** Secciones de la barra inferior para quien tiene estos permisos; el resto va en el menú de la cuenta. */
export function bottomNavItems(can: (perm: Permission) => boolean): NavItem[] {
  const allowed = (to: string) => {
    const item = NAV_ITEMS.find((n) => n.to === to);
    return item && (!item.perm || can(item.perm)) ? item : null;
  };
  const tabs = BOTTOM_TABS.map(allowed).filter((n): n is NavItem => !!n);
  for (const to of BOTTOM_FALLBACK) {
    if (tabs.length >= 5) break;
    const item = allowed(to);
    if (item) tabs.push(item);
  }
  return tabs;
}

/** ¿La ruta actual pertenece a esta sección? */
export function isNavActive(item: Pick<NavItem, 'to'>, pathname: string): boolean {
  return item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`);
}
