import type { LucideIcon } from 'lucide-react';
import {
  Ban,
  CalendarClock,
  Clock,
  Hourglass,
  Lock,
  LockOpen,
  Moon,
  PackageMinus,
  PackageOpen,
  PackagePlus,
  PackageX,
  Pencil,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Sun,
  Sunset,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus
} from 'lucide-react';
import { ALL_PERMISSIONS, APP_NAME, DEFAULT_ROLE_PERMISSIONS, ROLE_LABELS, ROLE_TONES } from '@/config/app';
import { firstName } from '@/lib/format';
import { normalize } from '@/lib/utils';
import type { ActivityType, Invite, Member, Permission, Role } from '@/types';

export type AssignableRole = Exclude<Role, 'owner'>;
export type StatusFilter = 'all' | 'active' | 'suspended' | 'pending';

/* ------------------------------------------------------------------ */
/* Roles y permisos                                                    */
/* ------------------------------------------------------------------ */

export const isAdminRole = (role: Role | null | undefined) => role === 'owner' || role === 'admin';

/** Permisos efectivos: propietario y administrador tienen todos. */
export function effectivePermissions(role: Role, permissions: Permission[] | undefined): Permission[] {
  if (isAdminRole(role)) return [...ALL_PERMISSIONS];
  return ALL_PERMISSIONS.filter((p) => (permissions ?? []).includes(p));
}

export const PERMISSION_SHORT: Record<Permission, string> = {
  pos: 'POS',
  discounts: 'Descuentos',
  void: 'Anulaciones',
  inventory: 'Inventario',
  reports: 'Reportes',
  staff: 'Personal',
  settings: 'Configuración'
};

/** Resumen corto de lo que puede hacer alguien ("POS • Descuentos • Reportes"). */
export function permissionSummary(role: Role, permissions: Permission[] | undefined): string {
  if (role === 'owner') return 'Control total del negocio';
  if (role === 'admin') return 'Acceso total · finanzas y personal';
  const list = effectivePermissions(role, permissions);
  if (!list.length) return 'Sin permisos asignados';
  return list.map((p) => PERMISSION_SHORT[p]).join(' • ');
}

/** ¿Los permisos difieren de los que trae el rol por defecto? */
export function isCustomized(role: Role, permissions: Permission[] | undefined): boolean {
  if (isAdminRole(role)) return false;
  const current = effectivePermissions(role, permissions);
  const defaults = DEFAULT_ROLE_PERMISSIONS[role];
  return current.length !== defaults.length || current.some((p) => !defaults.includes(p));
}

export type LevelTone = 'primary' | 'warning' | 'info' | 'success' | 'danger';

/** Nivel de acceso aproximado según los permisos. */
export function permissionLevel(role: Role, permissions: Permission[] | undefined): { label: string; tone: LevelTone } {
  if (isAdminRole(role)) return { label: 'Acceso total', tone: 'primary' };
  const list = effectivePermissions(role, permissions);
  if (list.includes('staff') || list.includes('settings')) return { label: 'Gestión', tone: 'warning' };
  if (list.includes('reports') || list.includes('void')) return { label: 'Supervisión', tone: 'info' };
  if (list.length) return { label: 'Operador estándar', tone: 'success' };
  return { label: 'Sin permisos', tone: 'danger' };
}

const toneDot: Record<(typeof ROLE_TONES)[Role], string> = {
  primary: 'bg-primary',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-400'
};

/** Clase de color del punto que identifica cada rol. */
export const roleDot = (role: Role) => toneDot[ROLE_TONES[role]];

const toneBar: Record<(typeof ROLE_TONES)[Role], 'primary' | 'secondary' | 'tertiary' | 'slate'> = {
  primary: 'primary',
  success: 'primary',
  warning: 'tertiary',
  info: 'secondary',
  neutral: 'slate'
};

/** Tono de la barra de progreso de cada rol. */
export const roleBar = (role: Role) => toneBar[ROLE_TONES[role]];

/** Motivo por el que no puedes gestionar a un miembro desde esta pantalla (o null si sí puedes). */
export type ManageBlock = 'self' | 'owner' | 'admin' | null;

export function manageBlock(member: Pick<Member, 'uid' | 'role'>, myUid: string, iAmAdmin: boolean): ManageBlock {
  if (member.uid === myUid) return 'self';
  if (member.role === 'owner') return 'owner';
  if (member.role === 'admin' && !iAmAdmin) return 'admin';
  return null;
}

export const MANAGE_BLOCK_TEXT: Record<Exclude<ManageBlock, null>, string> = {
  self: 'Tus propios datos se editan en Mi perfil',
  owner: 'Nadie puede modificar al propietario del negocio',
  admin: 'Solo el propietario o un administrador puede modificar a otro administrador'
};

/* ------------------------------------------------------------------ */
/* Turnos                                                              */
/* ------------------------------------------------------------------ */

export const SHIFT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Sin turno fijo' },
  { value: 'Mañana (08:00–16:00)', label: 'Mañana · 08:00–16:00' },
  { value: 'Tarde (14:00–22:00)', label: 'Tarde · 14:00–22:00' },
  { value: 'Noche (22:00–06:00)', label: 'Noche · 22:00–06:00' },
  { value: 'Turno completo', label: 'Turno completo' },
  { value: 'Medio tiempo', label: 'Medio tiempo' }
];

/** Opciones del select de turno, incluyendo el valor actual si es uno personalizado. */
export function shiftOptions(current?: string) {
  if (current && !SHIFT_OPTIONS.some((o) => o.value === current)) return [...SHIFT_OPTIONS, { value: current, label: current }];
  return SHIFT_OPTIONS;
}

export function shiftIcon(shift?: string): LucideIcon {
  const s = normalize(shift);
  if (s.startsWith('manana')) return Sun;
  if (s.startsWith('tarde')) return Sunset;
  if (s.startsWith('noche')) return Moon;
  if (s.includes('completo')) return Clock;
  if (s.includes('medio')) return Hourglass;
  return CalendarClock;
}

/* ------------------------------------------------------------------ */
/* Invitaciones                                                        */
/* ------------------------------------------------------------------ */

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function appSignupLink() {
  return `${window.location.origin}/registro`;
}

/** Mensaje listo para pegar en WhatsApp, SMS o correo con las instrucciones para unirse. */
export function inviteMessage(
  invite: Pick<Invite, 'email' | 'displayName' | 'role'>,
  businessName: string,
  inviterName: string
): string {
  const hello = invite.displayName ? `¡Hola, ${firstName(invite.displayName)}!` : '¡Hola!';
  return [
    `${hello} ${inviterName} te invitó a unirte al equipo de *${businessName}* en ${APP_NAME} como *${ROLE_LABELS[invite.role]}*.`,
    '',
    'Para entrar:',
    `1. Abre ${appSignupLink()}`,
    `2. Entra con Google o crea tu cuenta usando este mismo correo: ${invite.email}`,
    '3. Si creaste la cuenta con contraseña, verifica tu correo con el enlace que te llegará.',
    '4. En la pantalla de bienvenida pulsa “Unirme” en la invitación.',
    '',
    `Si ya usas ${APP_NAME}, encontrarás la invitación en “Mi perfil”.`
  ].join('\n');
}

export function whatsappUrl(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Copia texto al portapapeles (con alternativa para navegadores sin Clipboard API). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* sigue con la alternativa */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Bitácora                                                            */
/* ------------------------------------------------------------------ */

export type ActivityGroup = 'sales' | 'inventory' | 'cash' | 'team' | 'settings';

export const ACTIVITY_GROUPS: { value: 'all' | ActivityGroup; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'sales', label: 'Ventas' },
  { value: 'inventory', label: 'Inventario' },
  { value: 'cash', label: 'Caja' },
  { value: 'team', label: 'Equipo' },
  { value: 'settings', label: 'Configuración' }
];

export interface ActivityMeta {
  label: string;
  group: ActivityGroup;
  icon: LucideIcon;
  /** Clases del círculo del ícono. */
  tone: string;
  /** Cómo mostrar el monto: con signo (+/−) o como dato neutral con etiqueta. */
  amount?: { kind: 'signed' } | { kind: 'neutral'; label: string };
}

const T = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  primary: 'bg-primary-fixed/40 text-on-primary-fixed-variant ring-primary-fixed-dim/60',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200'
};

export const ACTIVITY_META: Record<ActivityType, ActivityMeta> = {
  sale: { label: 'Venta', group: 'sales', icon: ShoppingCart, tone: T.green, amount: { kind: 'signed' } },
  sale_void: { label: 'Venta anulada', group: 'sales', icon: Ban, tone: T.red, amount: { kind: 'signed' } },
  product_create: { label: 'Alta de producto', group: 'inventory', icon: PackagePlus, tone: T.blue },
  product_update: { label: 'Edición de producto', group: 'inventory', icon: Pencil, tone: T.blue },
  product_delete: { label: 'Baja de producto', group: 'inventory', icon: PackageX, tone: T.red },
  stock_adjust: { label: 'Ajuste de stock', group: 'inventory', icon: SlidersHorizontal, tone: T.amber },
  stock_in: { label: 'Entrada de stock', group: 'inventory', icon: PackageOpen, tone: T.green },
  cash_open: { label: 'Apertura de caja', group: 'cash', icon: LockOpen, tone: T.violet, amount: { kind: 'neutral', label: 'Fondo inicial' } },
  cash_close: { label: 'Corte de caja', group: 'cash', icon: Lock, tone: T.violet, amount: { kind: 'neutral', label: 'Total del turno' } },
  member_invite: { label: 'Invitación', group: 'team', icon: UserPlus, tone: T.primary },
  member_update: { label: 'Cambio de permisos', group: 'team', icon: UserCog, tone: T.slate },
  member_remove: { label: 'Baja de personal', group: 'team', icon: UserMinus, tone: T.red },
  member_join: { label: 'Alta en el equipo', group: 'team', icon: UserCheck, tone: T.primary },
  settings_update: { label: 'Configuración', group: 'settings', icon: Settings, tone: T.slate },
  business_create: { label: 'Negocio creado', group: 'settings', icon: Store, tone: T.primary }
};

const fallbackMeta: ActivityMeta = { label: 'Movimiento', group: 'settings', icon: PackageMinus, tone: T.slate };

export const activityMeta = (type: ActivityType | string): ActivityMeta => ACTIVITY_META[type as ActivityType] ?? fallbackMeta;
