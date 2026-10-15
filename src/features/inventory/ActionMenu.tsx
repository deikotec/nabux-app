import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { EllipsisVertical } from 'lucide-react';
import { MenuItem } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface ActionMenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  /** Dibuja un separador antes de este elemento. */
  separated?: boolean;
}

const PANEL_WIDTH = 232;

/**
 * Menú "⋮" que se dibuja en un portal con posición fija, para que no lo recorte
 * el contenedor con scroll horizontal de la tabla.
 */
export function ActionMenu({ label, items, className }: { label: string; items: ActionMenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = (refocus = false) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const estimated = items.length * 40 + items.filter((i) => i.separated).length * 9 + 14;
    const below = window.innerHeight - r.bottom;
    const up = below < estimated + 12 && r.top > below;
    const left = Math.min(window.innerWidth - PANEL_WIDTH - 8, Math.max(8, r.right - PANEL_WIDTH));
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left, up });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus(), 0);
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
      }
    };
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const onPanelKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const buttons = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next = 0;
    if (e.key === 'End') next = buttons.length - 1;
    else if (e.key === 'ArrowDown') next = (current + 1) % buttons.length;
    else if (e.key === 'ArrowUp') next = (current - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface',
          open && 'bg-surface-container text-on-surface',
          className
        )}
      >
        <EllipsisVertical className="size-[18px]" />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label={label}
            onKeyDown={onPanelKey}
            style={{ top: pos.top, left: pos.left, width: PANEL_WIDTH, transform: pos.up ? 'translateY(-100%)' : undefined }}
            className="fixed z-[55] animate-pop-in rounded-xl border border-slate-200 bg-white p-1.5 shadow-overlay"
          >
            {items.map((item) => (
              <div key={item.label} role="none">
                {item.separated && <div className="my-1 h-px bg-slate-100" role="separator" />}
                <MenuItem
                  icon={item.icon}
                  danger={item.danger}
                  onClick={() => {
                    close(true);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </MenuItem>
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
