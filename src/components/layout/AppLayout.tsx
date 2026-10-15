import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  AlertTriangle,
  Bell,
  Building2,
  Check,
  ChevronDown,
  CloudOff,
  LogOut,
  Menu,
  Plus,
  Search,
  UserCircle,
  Wallet,
  X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCash } from '@/contexts/CashContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useOnline } from '@/hooks/data';
import { ROLE_LABELS } from '@/config/app';
import { formatTime } from '@/lib/format';
import { cn, productMatches } from '@/lib/utils';
import { Avatar, Button, Kbd, MenuItem, Popover, ProductThumb, StatusDot, StockBadge, useClickOutside } from '@/components/ui';
import { LogoMark } from './Logo';
import { NAV_ITEMS } from './nav';

export function AppLayout() {
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { can } = useBusiness();

  useEffect(() => setDrawer(false), [location.pathname]);

  // Atajo global: F2 → Terminal POS
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2' && can('pos') && location.pathname !== '/pos') {
        e.preventDefault();
        navigate('/pos');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [can, navigate, location.pathname]);

  return (
    <div className="min-h-dvh bg-surface">
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200/70 bg-surface-container-low lg:flex">
        <SidebarContent />
      </aside>

      {/* Drawer móvil */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-slate-900/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-pop-in flex-col bg-surface-container-low shadow-overlay">
            <button className="absolute top-4 right-3 rounded-lg p-2 text-slate-500 hover:bg-surface-container" onClick={() => setDrawer(false)} aria-label="Cerrar menú">
              <X className="size-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <Topbar onMenu={() => setDrawer(true)} />
        <main className="mx-auto w-full max-w-[1600px] px-4 pb-10 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SidebarContent() {
  const { business, businesses, switchBusiness, can, businessId } = useBusiness();
  const { lowStock } = useCatalog();
  const online = useOnline();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col justify-between gap-4 py-4">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 px-4">
          <div className="flex items-center gap-2.5">
            {business?.logoUrl ? (
              <img src={business.logoUrl} alt="" className="size-9 rounded-xl bg-white object-contain" />
            ) : (
              <LogoMark />
            )}
            <span className="truncate text-headline-sm font-bold text-primary">{business?.name}</span>
          </div>
          <Popover
            align="left"
            panelClassName="w-60"
            trigger={({ toggle }) => (
              <button
                onClick={toggle}
                className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-1 text-label-sm text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="truncate">{business?.businessType || 'Mi negocio'}</span>
                <ChevronDown className="size-3.5 shrink-0" />
              </button>
            )}
          >
            {(close) => (
              <>
                <p className="px-3 pt-1 pb-2 text-label-sm text-slate-500 uppercase">Tus negocios</p>
                {businesses.map((b) => (
                  <MenuItem
                    key={b.id}
                    icon={Building2}
                    active={b.id === businessId}
                    hint={b.id === businessId ? <Check className="size-4" /> : undefined}
                    onClick={() => {
                      switchBusiness(b.id);
                      close();
                      navigate('/');
                    }}
                  >
                    {b.name}
                  </MenuItem>
                ))}
                <div className="my-1 border-t border-slate-100" />
                <MenuItem
                  icon={Plus}
                  onClick={() => {
                    close();
                    navigate('/bienvenida?nuevo=1');
                  }}
                >
                  Crear otro negocio
                </MenuItem>
              </>
            )}
          </Popover>
        </div>

        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.filter((n) => !n.perm || can(n.perm)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-label-lg transition-colors',
                  isActive ? 'bg-primary text-white shadow-card' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="flex items-center gap-3">
                    <item.icon className="size-5" />
                    {item.label}
                  </span>
                  {item.to === '/inventario' && lowStock.length > 0 ? (
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold tnum', isActive ? 'bg-white/20' : 'bg-amber-100 text-amber-800')}>
                      {lowStock.length}
                    </span>
                  ) : item.kbd ? (
                    <kbd className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold', isActive ? 'bg-white/20' : 'bg-surface-container-high text-on-surface-variant')}>
                      {item.kbd}
                    </kbd>
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="px-4">
        <div className="flex flex-col gap-1 rounded-xl bg-surface-container p-3">
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
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { member, business, can } = useBusiness();
  const { user, signOut } = useAuth();
  const { session, requestOpen, requestClose } = useCash();
  const { lowStock } = useCatalog();
  const navigate = useNavigate();
  const online = useOnline();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/60 bg-surface/85 px-4 backdrop-blur-xl sm:px-6">
      <button className="-ml-1 rounded-lg p-2 text-on-surface-variant hover:bg-surface-container lg:hidden" onClick={onMenu} aria-label="Abrir menú">
        <Menu className="size-5" />
      </button>

      <GlobalSearch />

      {can('pos') && (
        <button
          onClick={() => (session ? requestClose() : requestOpen())}
          className={cn(
            'hidden shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-label-sm shadow-card transition-colors xl:inline-flex',
            session ? 'bg-white text-on-surface-variant hover:bg-surface-container-low' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
          )}
          title={session ? 'Hacer corte de caja' : 'Abrir caja'}
        >
          <StatusDot tone={session ? 'success' : 'warning'} pulse={!!session} />
          {session ? `Caja abierta · desde ${formatTime(session.openedAt)}` : 'Caja cerrada · Abrir'}
        </button>
      )}

      {!online && (
        <span className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-label-sm text-amber-800 md:inline-flex">
          <CloudOff className="size-3.5" /> Sin conexión
        </span>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {can('pos') && (
          <Button icon={Plus} onClick={() => navigate('/pos')} className="hidden sm:inline-flex">
            Nueva venta
          </Button>
        )}

        <Popover
          panelClassName="w-80 p-0"
          trigger={({ toggle }) => (
            <button
              onClick={toggle}
              className="relative rounded-lg bg-white p-2 text-on-surface-variant shadow-card hover:bg-surface-container-low hover:text-on-surface"
              aria-label="Alertas de stock"
            >
              <Bell className="size-5" />
              {lowStock.length > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-error ring-2 ring-white" />}
            </button>
          )}
        >
          {(close) => (
            <div className="flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <span className="text-label-lg">Alertas de stock</span>
                <span className="text-body-sm text-on-surface-variant tnum">{lowStock.length}</span>
              </div>
              <div className="max-h-80 overflow-y-auto p-1.5 scrollbar-thin">
                {lowStock.length === 0 ? (
                  <p className="px-3 py-6 text-center text-body-md text-on-surface-variant">Todo en orden: ningún producto bajo el mínimo.</p>
                ) : (
                  lowStock.slice(0, 12).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        close();
                        navigate(`/inventario?q=${encodeURIComponent(p.sku || p.name)}`);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-container-low"
                    >
                      <ProductThumb product={p} size="sm" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-label-md">{p.name}</span>
                        <span className="text-body-sm text-on-surface-variant tnum">
                          {p.stock} disp. / mín. {p.minStock}
                        </span>
                      </span>
                      <StockBadge product={p} />
                    </button>
                  ))
                )}
              </div>
              {lowStock.length > 0 && (
                <button
                  className="border-t border-slate-100 px-4 py-2.5 text-label-md text-primary hover:bg-surface-container-low"
                  onClick={() => {
                    close();
                    navigate('/inventario?estado=bajo');
                  }}
                >
                  Ver todos en inventario →
                </button>
              )}
            </div>
          )}
        </Popover>

        <Popover
          panelClassName="w-64"
          trigger={({ toggle }) => (
            <button onClick={toggle} className="flex items-center gap-2 rounded-xl py-1 pr-2 pl-1 hover:bg-surface-container" aria-label="Menú de usuario">
              <Avatar src={member?.photoURL ?? user?.photoURL} name={member?.displayName} size="sm" />
              <span className="hidden flex-col text-left md:flex">
                <span className="max-w-36 truncate text-label-md leading-tight text-on-surface">{member?.displayName}</span>
                <span className="text-body-sm leading-tight text-on-surface-variant">{member ? ROLE_LABELS[member.role] : ''}</span>
              </span>
              <ChevronDown className="hidden size-4 text-slate-400 md:block" />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-3 pt-2 pb-3">
                <p className="truncate text-label-lg">{member?.displayName}</p>
                <p className="truncate text-body-sm text-on-surface-variant">{user?.email}</p>
                <p className="mt-1 truncate text-body-sm text-on-surface-variant">{business?.name}</p>
              </div>
              <div className="border-t border-slate-100 pt-1.5" />
              <MenuItem
                icon={UserCircle}
                onClick={() => {
                  close();
                  navigate('/perfil');
                }}
              >
                Mi perfil
              </MenuItem>
              {can('pos') && (
                <MenuItem
                  icon={Wallet}
                  onClick={() => {
                    close();
                    if (session) requestClose();
                    else requestOpen();
                  }}
                >
                  {session ? 'Corte de caja' : 'Abrir caja'}
                </MenuItem>
              )}
              <MenuItem icon={LogOut} danger onClick={() => signOut()}>
                Cerrar sesión
              </MenuItem>
            </>
          )}
        </Popover>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */

function GlobalSearch() {
  const { products } = useCatalog();
  const { money } = useBusiness();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useClickOutside<HTMLDivElement>(() => setOpen(false), open);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => (q.trim() ? products.filter((p) => productMatches(p, q)).slice(0, 8) : []), [products, q]);

  const go = (sku: string) => {
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
    navigate(`/inventario?q=${encodeURIComponent(sku)}`);
  };

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1 md:max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && results[active]) {
            go(results[active].sku || results[active].name);
          } else if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        placeholder="Buscar producto, SKU o código…"
        className="h-10 w-full rounded-lg border border-transparent bg-white pr-16 pl-10 text-body-md shadow-card placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
      />
      <Kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 sm:block">Ctrl+K</Kbd>
      {open && q.trim() && (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 animate-pop-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-overlay">
          {results.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-4 text-body-md text-on-surface-variant">
              <AlertTriangle className="size-4" /> Sin resultados para “{q}”
            </p>
          ) : (
            results.map((p, i) => (
              <button
                key={p.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(p.sku || p.name)}
                className={cn('flex w-full items-center gap-3 px-3 py-2 text-left', i === active ? 'bg-surface-container-low' : 'bg-white')}
              >
                <ProductThumb product={p} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-label-md">{p.name}</span>
                  <span className="truncate text-body-sm text-on-surface-variant">
                    {p.sku} · {p.category}
                  </span>
                </span>
                <span className="flex flex-col items-end">
                  <span className="text-label-md tnum">{money(p.salePrice)}</span>
                  <span className="text-body-sm text-on-surface-variant tnum">{p.stock} disp.</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
