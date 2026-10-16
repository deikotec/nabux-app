import { useEffect, useRef } from 'react';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

interface MobileTicketBarProps {
  itemCount: number;
  total: number;
  money: (n: number) => string;
  /** Equivalente en Bs (modo bimonetario con tasa). */
  moneyLocal?: (n: number) => string;
  blocked: boolean;
  onOpen: () => void;
}

/** Barra fija inferior (móvil/tablet) con el resumen del ticket y acceso al cobro. */
export function MobileTicketBar({ itemCount, total, money, moneyLocal, blocked, onOpen }: MobileTicketBarProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Publica su alto en --bottom-bar para que los avisos (toasts) aparezcan por encima de la barra.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty('--bottom-bar', `${el.offsetHeight}px`);
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--bottom-bar');
    };
  }, []);

  return (
    <div
      ref={ref}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pt-3 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] shadow-overlay backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col text-left" aria-label="Ver ticket actual">
          <span className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
            <span className={cn('size-2 rounded-full', itemCount > 0 ? 'bg-primary' : 'bg-slate-300')} />
            {formatNumber(itemCount)} {itemCount === 1 ? 'artículo' : 'artículos'}
            {blocked && <span className="text-amber-700">· caja cerrada</span>}
          </span>
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="truncate text-headline-md font-bold text-primary tnum">{money(total)}</span>
            {moneyLocal && <span className="truncate text-label-lg text-secondary tnum">{moneyLocal(total)}</span>}
          </span>
        </button>
        <Button size="lg" icon={ShoppingCart} onClick={onOpen}>
          Ver ticket
        </Button>
      </div>
    </div>
  );
}
