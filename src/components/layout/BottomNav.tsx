import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { cn } from '@/lib/utils';
import { bottomNavItems } from './nav';

/**
 * Barra de navegación inferior tipo app (móvil y tablet), como en ref/movil: Inicio, Inventario, POS,
 * Reportes y Personal (según permisos). Las demás secciones están en el menú de la cuenta (barra superior).
 */
export function BottomNav() {
  const { can } = useBusiness();
  const { lowStock } = useCatalog();
  const ref = useRef<HTMLElement>(null);
  const items = bottomNavItems(can);

  // Publica su alto en --bottom-nav para que el contenido y otras barras fijas queden por encima.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    // Redondeado hacia abajo: con alto fraccionario (67,5px) las barras de encima quedan solapadas y no asoma el contenido.
    const update = () => root.style.setProperty('--bottom-nav', `${Math.floor(el.getBoundingClientRect().height)}px`);
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
      className="fixed inset-x-0 bottom-0 z-40 bg-surface/85 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] shadow-[0_-1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl"
    >
      <div className="mx-auto grid h-16 max-w-xl items-center px-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = item.tabIcon ?? item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-label-sm transition-colors active:bg-surface-container',
                  isActive ? 'font-bold text-primary' : 'font-semibold text-on-surface-variant hover:text-on-surface'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <Icon className="size-[22px]" strokeWidth={isActive ? 2.3 : 1.9} />
                    {item.to === '/inventario' && lowStock.length > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[10px] leading-4 font-bold tracking-normal text-white ring-2 ring-surface tnum">
                        {lowStock.length > 99 ? '99+' : lowStock.length}
                      </span>
                    )}
                  </span>
                  <span className="w-full truncate text-center">{item.short}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
