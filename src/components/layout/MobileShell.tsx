import { useEffect, useRef, type RefObject } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { Building2, Check, ChevronDown, CloudCheck, CloudOff, LogOut, Plus, Store, UserCircle, Wallet, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCash } from '@/contexts/CashContext';
import { useOnline } from '@/hooks/data';
import { ROLE_LABELS, ROLE_SHORT } from '@/config/app';
import { formatTime, initials, shortName } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar, MenuItem, Popover, StatusDot } from '@/components/ui';
import { Pill } from '@/components/mobile';
import { LogoMark } from './Logo';
import { bottomNavItems, isNavActive, NAV_ITEMS } from './nav';

/* ------------------------------------------------------------------ */
/* Barra superior                                                      */
/* ------------------------------------------------------------------ */

/**
 * Barra superior del móvil (ref/movil): logo y nombre del negocio con su estado, y a la derecha quién
 * está usando la app; al tocarlo se abre el menú de la cuenta.
 */
export function MobileTopbar({ onMenu, menuOpen }: { onMenu: () => void; menuOpen: boolean }) {
  const { business, member, role, can } = useBusiness();
  const { user } = useAuth();
  const online = useOnline();
  const { pathname } = useLocation();
  // En el POS la segunda línea es la caja (abrir, corte, cambiar de caja).
  const onPos = pathname === '/pos' && can('pos');
  const photo = member?.photoURL ?? user?.photoURL;

  return (
    <header className="sticky top-0 z-30 bg-surface/85 pt-[env(safe-area-inset-top)] shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <NavLink to="/" className="shrink-0 rounded-lg" aria-label="Ir al inicio">
            {business?.logoUrl ? (
              <img src={business.logoUrl} alt="" className="size-9 rounded-lg bg-white object-contain shadow-card" />
            ) : (
              <LogoMark className="rounded-lg shadow-card" />
            )}
          </NavLink>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-headline-sm leading-tight tracking-tight text-on-surface">{business?.name}</span>
            <div className="flex min-w-0 items-center gap-1">
              {onPos ? (
                <CashStatusChip />
              ) : (
                <span className="min-w-0 truncate rounded bg-surface-container-high px-1.5 py-0.5 text-label-sm text-on-surface-variant">
                  {business?.businessType || 'Mi negocio'}
                </span>
              )}
              {/* En el POS la caja necesita el espacio: la red solo se marca si se cae. */}
              {(!onPos || !online) && <NetworkMark online={online} />}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onMenu}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-label="Abrir el menú de la cuenta"
          className="flex shrink-0 items-center gap-2 rounded-xl py-1 pr-0.5 pl-1.5 transition-colors active:bg-surface-container"
        >
          <span className="flex flex-col items-end">
            <span className="max-w-24 truncate text-label-md text-on-surface">{shortName(member?.displayName) || 'Mi cuenta'}</span>
            <span className="text-label-sm text-outline">{role ? ROLE_SHORT[role] : ''}</span>
          </span>
          {photo ? (
            <img src={photo} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full object-cover shadow-card" />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-[12px] font-bold text-on-primary-container shadow-card">
              {initials(member?.displayName)}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

/** Punto + nube: datos sincronizados o sin conexión (se puede seguir vendiendo). */
function NetworkMark({ online }: { online: boolean }) {
  const text = online ? 'En línea: datos sincronizados en la nube' : 'Sin conexión: puedes seguir vendiendo, se sincroniza al volver la red';
  return (
    <span role="status" title={text} className="flex shrink-0 items-center gap-1 border-l border-outline-variant/50 pl-1">
      <span className={cn('size-1.5 rounded-full', online ? 'bg-primary' : 'animate-pulse bg-amber-500')} aria-hidden />
      {online ? (
        <CloudCheck className="size-3.5 text-primary" aria-hidden />
      ) : (
        <>
          <CloudOff className="size-3.5 text-amber-700" aria-hidden />
          <span className="text-label-sm text-amber-800">Sin red</span>
        </>
      )}
      <span className="sr-only">{text}</span>
    </span>
  );
}

/** Estado de la caja en el POS (con corte y cambio de caja). */
function CashStatusChip() {
  const { actor } = useBusiness();
  const { session, loading, register, multiRegister, requestOpen, requestClose, requestSwitch } = useCash();
  const regName = multiRegister ? (session?.registerName ?? register?.name ?? null) : null;
  const chip = 'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full py-0.5 text-label-sm';

  if (loading) {
    return (
      <span className={cn(chip, 'text-on-surface-variant')}>
        <StatusDot tone="neutral" />
        Verificando caja…
      </span>
    );
  }
  if (!session) {
    return (
      <button type="button" onClick={requestOpen} className={cn(chip, 'text-amber-800')}>
        <StatusDot tone="warning" />
        <span className="truncate">{multiRegister && !register ? 'Elegir caja' : `${regName ?? 'Caja'} cerrada · Abrir`}</span>
      </button>
    );
  }
  return (
    <Popover
      align="left"
      className="max-w-full min-w-0"
      panelClassName="w-64"
      trigger={({ open, toggle }) => (
        <button type="button" onClick={toggle} aria-expanded={open} className={cn(chip, 'text-primary')}>
          <StatusDot tone="success" pulse />
          <span className="truncate">
            {regName ?? 'Caja'} abierta · {formatTime(session.openedAt)}
          </span>
          <ChevronDown className="size-3.5 shrink-0" />
        </button>
      )}
    >
      {(close) => (
        <>
          <p className="px-3 pt-1 pb-2 text-body-sm text-on-surface-variant">
            Abierta por {session.openedBy === actor.uid ? 'ti' : session.openedByName} a las {formatTime(session.openedAt)}
          </p>
          <MenuItem
            icon={Wallet}
            onClick={() => {
              close();
              requestClose();
            }}
          >
            Hacer corte de caja
          </MenuItem>
          {multiRegister && (
            <MenuItem
              icon={Store}
              onClick={() => {
                close();
                requestSwitch();
              }}
            >
              Cambiar de caja
            </MenuItem>
          )}
        </>
      )}
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Menú de la cuenta                                                   */
/* ------------------------------------------------------------------ */

/**
 * Hoja lateral con la cuenta, el negocio (y cambio de negocio), las secciones que no caben en la
 * barra inferior, la caja y el cierre de sesión.
 */
export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeBtn = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      // Tab no sale de la hoja mientras está abierta.
      if (e.key !== 'Tab' || !sheet.current) return;
      const items = Array.from(sheet.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = sheet.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      // Devuelve el foco solo si nadie lo tomó (p. ej. el campo del modal de caja que se abrió desde el menú).
      const active = document.activeElement;
      if (!active || active === document.body) prevFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return <MenuSheet onClose={onClose} closeRef={closeBtn} sheetRef={sheet} />;
}

function MenuSheet({
  onClose,
  closeRef,
  sheetRef
}: {
  onClose: () => void;
  closeRef: RefObject<HTMLButtonElement | null>;
  sheetRef: RefObject<HTMLElement | null>;
}) {
  const { business, businesses, businessId, switchBusiness, member, role, can } = useBusiness();
  const { user, signOut } = useAuth();
  const { session, multiRegister, requestOpen, requestClose, requestSwitch } = useCash();
  const online = useOnline();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const tabs = new Set(bottomNavItems(can).map((n) => n.to));
  const more = NAV_ITEMS.filter((n) => (!n.perm || can(n.perm)) && !tabs.has(n.to));
  const go = (to: string) => {
    onClose();
    navigate(to);
  };
  const group = 'rounded-xl bg-surface-container-lowest p-1.5 shadow-card';
  const groupTitle = 'px-2.5 pt-1.5 pb-1 text-label-sm tracking-wider text-outline uppercase';

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40" onClick={onClose} aria-hidden />
      <aside
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de la cuenta"
        className="absolute inset-y-0 right-0 flex w-80 max-w-[88vw] animate-slide-in-right flex-col gap-3 overflow-y-auto overscroll-contain bg-surface px-4 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-overlay"
      >
        <div className="flex items-start gap-3">
          <Avatar src={member?.photoURL ?? user?.photoURL} name={member?.displayName} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-headline-sm text-on-surface">{member?.displayName || 'Mi cuenta'}</span>
            <span className="truncate text-body-sm text-on-surface-variant">{user?.email}</span>
            {role && (
              <Pill tone="primary" dot className="mt-1 self-start">
                {ROLE_LABELS[role]}
              </Pill>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="-mt-1 -mr-1 rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <X className="size-5" />
          </button>
        </div>

        <section className={group} aria-label="Negocio">
          <p className={groupTitle}>{businesses.length > 1 ? 'Tus negocios' : 'Negocio'}</p>
          {businesses.length ? (
            businesses.map((b) => (
              <MenuItem
                key={b.id}
                icon={Building2}
                active={b.id === businessId}
                hint={b.id === businessId ? <Check className="size-4" /> : undefined}
                onClick={() => {
                  onClose();
                  if (b.id !== businessId) {
                    switchBusiness(b.id);
                    navigate('/');
                  }
                }}
              >
                {b.name}
              </MenuItem>
            ))
          ) : (
            <MenuItem icon={Building2} active>
              {business?.name}
            </MenuItem>
          )}
          <MenuItem icon={Plus} onClick={() => go('/bienvenida?nuevo=1')}>
            Crear otro negocio
          </MenuItem>
        </section>

        {more.length > 0 && (
          <nav className={group} aria-label="Más secciones">
            <p className={groupTitle}>Más secciones</p>
            {more.map((item) => (
              <MenuItem key={item.to} icon={item.icon} active={isNavActive(item, pathname)} onClick={() => go(item.to)}>
                {item.label}
              </MenuItem>
            ))}
          </nav>
        )}

        <section className={group} aria-label="Cuenta">
          <MenuItem icon={UserCircle} active={pathname === '/perfil'} onClick={() => go('/perfil')}>
            Mi perfil
          </MenuItem>
          {can('pos') && (
            <MenuItem
              icon={Wallet}
              onClick={() => {
                onClose();
                if (session) requestClose();
                else requestOpen();
              }}
            >
              {session ? 'Corte de caja' : 'Abrir caja'}
            </MenuItem>
          )}
          {can('pos') && multiRegister && (
            <MenuItem
              icon={Store}
              onClick={() => {
                onClose();
                requestSwitch();
              }}
            >
              Cambiar de caja
            </MenuItem>
          )}
          <MenuItem icon={LogOut} danger onClick={() => signOut()}>
            Cerrar sesión
          </MenuItem>
        </section>

        <div className="mt-auto flex flex-col gap-1 rounded-xl bg-surface-container p-3">
          <div className="flex items-center justify-between">
            <span className="text-label-md text-on-surface">Estado de red</span>
            <span className={cn('flex items-center gap-1.5 text-label-sm', online ? 'text-primary' : 'text-amber-700')}>
              <StatusDot tone={online ? 'success' : 'warning'} pulse={!online} />
              {online ? 'En línea' : 'Sin conexión'}
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant">
            {online ? 'Datos sincronizados en la nube.' : 'Puedes seguir vendiendo; se sincroniza al volver la red.'}
          </p>
        </div>
      </aside>
    </div>
  );
}
