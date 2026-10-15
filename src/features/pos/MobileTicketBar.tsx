import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

interface MobileTicketBarProps {
  itemCount: number;
  total: number;
  money: (n: number) => string;
  blocked: boolean;
  onOpen: () => void;
}

/** Barra fija inferior (móvil/tablet) con el resumen del ticket y acceso al cobro. */
export function MobileTicketBar({ itemCount, total, money, blocked, onOpen }: MobileTicketBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-overlay backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col text-left" aria-label="Ver ticket actual">
          <span className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
            <span className={cn('size-2 rounded-full', itemCount > 0 ? 'bg-primary' : 'bg-slate-300')} />
            {formatNumber(itemCount)} {itemCount === 1 ? 'artículo' : 'artículos'}
            {blocked && <span className="text-amber-700">· caja cerrada</span>}
          </span>
          <span className="truncate text-headline-md font-bold text-primary tnum">{money(total)}</span>
        </button>
        <Button size="lg" icon={ShoppingCart} onClick={onOpen}>
          Ver ticket
        </Button>
      </div>
    </div>
  );
}
