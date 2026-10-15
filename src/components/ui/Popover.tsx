import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function useClickOutside<T extends HTMLElement>(onOutside: () => void, active = true) {
  const ref = useRef<T>(null);
  const cb = useRef(onOutside);
  cb.current = onOutside;
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cb.current();
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [active]);
  return ref;
}

/** Menú desplegable simple anclado a un disparador. */
export function Popover({
  trigger,
  children,
  align = 'right',
  className,
  panelClassName
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'left' | 'right';
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);
  const close = () => setOpen(false);
  return (
    <div ref={ref} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={cn(
            'absolute top-full z-50 mt-2 min-w-56 animate-pop-in rounded-xl border border-slate-200 bg-white p-1.5 shadow-overlay',
            align === 'right' ? 'right-0' : 'left-0',
            panelClassName
          )}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon: Icon,
  children,
  onClick,
  danger,
  active,
  hint
}: {
  icon?: React.ComponentType<{ className?: string }>;
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  active?: boolean;
  hint?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-label-lg transition-colors',
        danger ? 'text-error hover:bg-red-50' : active ? 'bg-primary-fixed/25 text-primary' : 'text-on-surface hover:bg-surface-container-low'
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint}
    </button>
  );
}
