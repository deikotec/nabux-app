import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  /** Tono del ícono del encabezado. */
  iconTone?: 'primary' | 'secondary' | 'warning' | 'danger';
  /** Insignia junto al título (ej. nombre de la sucursal). */
  badge?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  footer?: ReactNode;
  children?: ReactNode;
  /** Si es false, no se cierra con Esc ni clic afuera (ej. mientras guarda). */
  dismissible?: boolean;
  className?: string;
  bodyClassName?: string;
}

const sizes = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  '2xl': 'sm:max-w-6xl'
};

const iconTones = {
  primary: 'bg-primary text-white',
  secondary: 'bg-secondary-fixed text-secondary',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700'
};

let openCount = 0;
/** Pila de modales abiertos: solo el de arriba responde a Escape. */
const modalStack: symbol[] = [];

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconTone = 'primary',
  badge,
  size = 'md',
  footer,
  children,
  dismissible = true,
  className,
  bodyClassName
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return;
    openCount++;
    document.body.style.overflow = 'hidden';
    const prevFocus = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const panel = panelRef.current;
      // Si un campo con autoFocus ya tomó el foco, se respeta.
      if (!panel || panel.contains(document.activeElement)) return;
      const el = panel.querySelector<HTMLElement>('[data-autofocus]');
      (el ?? panel).focus();
    }, 30);
    return () => {
      clearTimeout(t);
      openCount--;
      if (openCount <= 0) document.body.style.overflow = '';
      prevFocus?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = Symbol('modal');
    modalStack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || modalStack[modalStack.length - 1] !== id) return;
      e.stopPropagation();
      if (dismissibleRef.current) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const idx = modalStack.indexOf(id);
      if (idx >= 0) modalStack.splice(idx, 1);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/45 backdrop-blur-[2px]" onClick={() => dismissible && onClose()} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[94dvh] w-full animate-pop-in flex-col overflow-hidden rounded-t-2xl bg-white shadow-overlay outline-none sm:rounded-2xl',
          sizes[size],
          className
        )}
      >
        {(title || Icon) && (
          <div className="flex items-start gap-3 border-b border-slate-100 bg-surface-container-low/60 px-5 py-4 sm:px-6">
            {Icon && (
              <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', iconTones[iconTone])}>
                <Icon className="size-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-headline-md text-on-surface">{title}</h2>
                {badge}
              </div>
              {subtitle && <p className="mt-0.5 text-body-md text-on-surface-variant">{subtitle}</p>}
            </div>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                className="-mr-1 rounded-lg p-2 text-slate-500 transition-colors hover:bg-surface-container hover:text-slate-800"
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
        )}
        <div className={cn('flex-1 overflow-y-auto px-5 py-5 scrollbar-thin sm:px-6', bodyClassName)}>{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Encabezado de sección dentro de formularios largos ("1. Información general"). */
export function FormSection({ icon: Icon, title, aside, children, className }: { icon?: LucideIcon; title: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <h3 className="flex items-center gap-2 text-headline-sm text-on-surface">
          {Icon && <Icon className="size-5 text-primary" />}
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
