import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router';
import { Menu } from 'lucide-react';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { cn } from '@/lib/utils';
import { BOTTOM_NAV_CANDIDATES, NAV_ITEMS } from './nav';

/**
 * Barra de navegación inferior tipo app (móvil y tablet). Muestra las secciones principales que el
 * usuario puede ver y un botón "Más" que abre el menú lateral con el resto.
 */
export function BottomNav({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const { can } = useBusiness();
  const { lowStock } = useCatalog();
  const { pathname } = useLocation();
  const ref = useRef<HTMLElement>(null);

  const items = NAV_ITEMS.filter((n) => BOTTOM_NAV_CANDIDATES.includes(n.to) && (!n.perm || can(n.perm))).slice(0, 4);
  const inMore = !items.some((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)));

  // Publica su alto en --bottom-nav para que el contenido y otras barras fijas queden por encima.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty('--bottom-nav', `${el.offsetHeight}px`);
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--bottom-nav');
    };
  }, []);

  return (
    <nav
      ref={ref}
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn('group flex flex-col items-center gap-1 pt-2 pb-1.5 text-[11px] font-semibold', isActive ? 'text-primary' : 'text-on-surface-variant')
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'relative flex h-8 w-14 items-center justify-center rounded-full transition-colors',
                    isActive ? 'bg-primary-fixed/45' : 'group-active:bg-surface-container'
                  )}
                >
                  <item.icon className="size-[22px]" strokeWidth={isActive ? 2.4 : 2} />
                  {item.to === '/inventario' && lowStock.length > 0 && (
                    <span className="absolute top-0.5 right-2.5 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[10px] leading-4 font-bold text-white tnum">
                      {lowStock.length > 99 ? '99+' : lowStock.length}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate px-1">{item.short}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={onMore}
          aria-expanded={moreOpen}
          className={cn('group flex flex-col items-center gap-1 pt-2 pb-1.5 text-[11px] font-semibold', inMore || moreOpen ? 'text-primary' : 'text-on-surface-variant')}
        >
          <span
            className={cn(
              'flex h-8 w-14 items-center justify-center rounded-full transition-colors',
              inMore || moreOpen ? 'bg-primary-fixed/45' : 'group-active:bg-surface-container'
            )}
          >
            <Menu className="size-[22px]" />
          </span>
          <span>Más</span>
        </button>
      </div>
    </nav>
  );
}
