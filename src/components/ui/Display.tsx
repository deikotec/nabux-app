import { useEffect, useRef, type HTMLAttributes, type ReactNode, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronLeft, ChevronRight, ImageOff, Loader2, Package } from 'lucide-react';
import { initials } from '@/lib/format';
import { cn, STOCK_STATUS_LABEL, stockStatus } from '@/lib/utils';
import type { Product } from '@/types';

/* ---------- Badge ---------- */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary' | 'violet';

const toneClasses: Record<Tone, { badge: string; dot: string }> = {
  success: { badge: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  warning: { badge: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  danger: { badge: 'bg-red-50 text-red-800 border-red-200', dot: 'bg-red-500' },
  info: { badge: 'bg-blue-50 text-blue-800 border-blue-200', dot: 'bg-blue-500' },
  neutral: { badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  primary: { badge: 'bg-primary-fixed/35 text-on-primary-fixed-variant border-primary-fixed-dim/60', dot: 'bg-primary' },
  violet: { badge: 'bg-violet-50 text-violet-800 border-violet-200', dot: 'bg-violet-500' }
};

export function Badge({
  tone = 'neutral',
  dot,
  icon: Icon,
  children,
  className,
  size = 'sm'
}: {
  tone?: Tone;
  dot?: boolean;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap',
        size === 'xs' ? 'px-1.5 py-px text-[10px]' : size === 'md' ? 'px-3 py-1 text-label-md' : 'px-2 py-0.5 text-label-sm',
        toneClasses[tone].badge,
        className
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', toneClasses[tone].dot)} />}
      {Icon && <Icon className="size-3.5" />}
      {children}
    </span>
  );
}

export function StatusDot({ tone = 'success', pulse, className }: { tone?: Tone; pulse?: boolean; className?: string }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', toneClasses[tone].dot, pulse && 'animate-pulse', className)} />;
}

const stockTone = { ok: 'success', low: 'warning', out: 'danger' } as const;

export function StockBadge({ product, className }: { product: Pick<Product, 'stock' | 'minStock'>; className?: string }) {
  const s = stockStatus(product);
  return (
    <Badge tone={stockTone[s]} dot className={className}>
      {STOCK_STATUS_LABEL[s]}
    </Badge>
  );
}

/** Barra de nivel de stock respecto al mínimo (se llena al 100% con 3× el mínimo). */
export function StockBar({ product, className }: { product: Pick<Product, 'stock' | 'minStock'>; className?: string }) {
  const s = stockStatus(product);
  const target = Math.max(1, (Number(product.minStock) || 1) * 3);
  const pct = Math.max(s === 'out' ? 0 : 6, Math.min(100, ((Number(product.stock) || 0) / target) * 100));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div
        className={cn('h-full rounded-full', s === 'ok' ? 'bg-primary' : s === 'low' ? 'bg-amber-500' : 'bg-red-500')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ProgressBar({ value, max = 100, tone = 'primary', className }: { value: number; max?: number; tone?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'slate'; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const color = { primary: 'bg-primary', secondary: 'bg-secondary', tertiary: 'bg-tertiary-container', error: 'bg-error', slate: 'bg-slate-500' }[tone];
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-container', className)}>
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ---------- Card ---------- */

export function Card({ className, children, padded = true, ...rest }: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200/80 bg-white shadow-card', padded && 'p-5', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
            <Icon className="size-5" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-headline-md text-on-surface">{title}</h3>
          {subtitle && <p className="text-body-sm text-on-surface-variant">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- KPI ---------- */

const kpiIconTone = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
  error: 'text-error'
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'primary',
  footer,
  highlight,
  loading,
  className,
  onClick
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: 'primary' | 'secondary' | 'tertiary' | 'error';
  footer?: ReactNode;
  /** Fondo de alerta (ej. stock crítico). */
  highlight?: boolean;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        'flex flex-col justify-between gap-3 rounded-2xl border p-4 shadow-card transition-all',
        highlight ? 'border-red-200 bg-error-container/40' : 'border-slate-200/80 bg-white',
        onClick && 'cursor-pointer hover:shadow-lift',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className={cn('text-label-md', highlight ? 'text-on-error-container' : 'text-on-surface-variant')}>{label}</span>
          {loading ? (
            <span className="mt-2 h-8 w-32 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <span className={cn('mt-1 truncate text-headline-lg tnum', highlight ? 'text-error' : 'text-on-surface')}>{value}</span>
          )}
        </div>
        {Icon && (
          <div className={cn('rounded-lg p-2', highlight ? 'bg-white text-error' : cn('bg-surface-container-low', kpiIconTone[tone]))}>
            <Icon className="size-[22px]" />
          </div>
        )}
      </div>
      {footer && <div className={cn('text-body-sm', highlight ? 'text-on-error-container' : 'text-on-surface-variant')}>{footer}</div>}
    </div>
  );
}

/** Chip de variación porcentual (+12.4% vs ayer). */
export function DeltaChip({ value, suffix }: { value: number | null; suffix?: string }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className="text-body-sm text-on-surface-variant">{suffix ? 'Sin datos para comparar' : 'Sin comparación'}</span>;
  }
  const up = value >= 0;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          'inline-flex items-center rounded-full px-1.5 py-0.5 text-label-sm tnum',
          up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        )}
      >
        {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
      </span>
      {suffix && <span className="text-body-sm text-on-surface-variant">{suffix}</span>}
    </span>
  );
}

/* ---------- Page header ---------- */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col justify-between gap-4 py-5 lg:flex-row lg:items-end', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && <span className="text-label-md font-bold tracking-wider text-primary uppercase">{eyebrow}</span>}
        <h1 className="text-headline-lg-mobile text-on-surface sm:text-headline-lg">{title}</h1>
        {description && <p className="max-w-2xl text-body-md text-on-surface-variant">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Estados vacíos / carga ---------- */

export function EmptyState({
  icon: Icon = Package,
  title,
  description,
  action,
  className
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      <div className="flex size-14 items-center justify-center rounded-2xl bg-surface-container-low text-primary">
        <Icon className="size-7" />
      </div>
      <div className="flex max-w-sm flex-col gap-1">
        <h3 className="text-headline-sm text-on-surface">{title}</h3>
        {description && <p className="text-body-md text-on-surface-variant">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-primary', className)} />;
}

export function PageLoader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 text-on-surface-variant">
      <Spinner className="size-8" />
      <span className="text-body-md">{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-100', className)} />;
}

/* ---------- Avatar / miniaturas ---------- */

const avatarColors = ['bg-emerald-100 text-emerald-800', 'bg-blue-100 text-blue-800', 'bg-amber-100 text-amber-800', 'bg-violet-100 text-violet-800', 'bg-rose-100 text-rose-800', 'bg-teal-100 text-teal-800'];

export function Avatar({ src, name, size = 'md', className }: { src?: string | null; name?: string | null; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const dims = { xs: 'size-6 text-[10px]', sm: 'size-8 text-label-sm', md: 'size-10 text-label-md', lg: 'size-12 text-label-lg', xl: 'size-20 text-headline-md' }[size];
  const color = avatarColors[(name ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length];
  if (src) return <img src={src} alt={name ?? ''} className={cn('shrink-0 rounded-full object-cover', dims, className)} referrerPolicy="no-referrer" />;
  return <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold', dims, color, className)}>{initials(name)}</span>;
}

export function ProductThumb({ product, size = 'md', className }: { product: Pick<Product, 'imageUrl' | 'name'>; size?: 'sm' | 'md' | 'lg' | 'fill'; className?: string }) {
  const dims = { sm: 'size-9', md: 'size-12', lg: 'size-20', fill: 'h-full w-full' }[size];
  if (product.imageUrl) {
    return <img src={product.imageUrl} alt={product.name} loading="lazy" className={cn('shrink-0 rounded-lg bg-slate-50 object-cover', dims, className)} />;
  }
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-slate-400', dims, className)}>
      {size === 'sm' ? <ImageOff className="size-4" /> : <Package className={size === 'fill' ? 'size-10' : 'size-5'} />}
    </div>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  // Los atajos de teclado no aplican en pantallas táctiles.
  return (
    <kbd className={cn('rounded bg-surface-container px-1.5 py-0.5 font-sans text-[11px] font-semibold text-on-surface-variant tnum pointer-coarse:hidden!', className)}>
      {children}
    </kbd>
  );
}

/* ---------- Pestañas ---------- */

export interface TabOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: LucideIcon;
  count?: number;
}

/** Selector segmentado tipo "Hoy | Esta semana | Este mes". */
export function Segmented<T extends string>({ options, value, onChange, className, size = 'md' }: { options: TabOption<T>[]; value: T; onChange: (v: T) => void; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div className={cn('inline-flex rounded-xl bg-surface-container p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-all',
            size === 'sm' ? 'px-2.5 py-1 text-label-sm' : 'px-3 py-1.5 text-label-md',
            value === o.value ? 'bg-white text-on-surface shadow-card' : 'text-on-surface-variant hover:text-on-surface'
          )}
        >
          {o.icon && <o.icon className="size-4" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Pestañas tipo píldora con scroll horizontal (secciones de una página). */
export function TabBar<T extends string>({ tabs, value, onChange, className }: { tabs: TabOption<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  const listRef = useRef<HTMLDivElement>(null);

  // En móvil no caben todas: la pestaña activa se desplaza a la vista (sin mover la página).
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !active || list.scrollWidth <= list.clientWidth) return;
    const left = active.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft || left + active.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: Math.max(0, left - 16), behavior: 'smooth' });
    }
  }, [value]);

  return (
    <div ref={listRef} className={cn('no-scrollbar flex gap-1.5 overflow-x-auto', className)} role="tablist">
      {tabs.map((t) => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-label-md whitespace-nowrap transition-colors',
              active ? 'bg-primary text-white shadow-card' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            )}
          >
            {t.icon && <t.icon className="size-4" />}
            {t.label}
            {t.count !== undefined && (
              <span className={cn('rounded-full px-1.5 text-[11px] tnum', active ? 'bg-white/20' : 'bg-surface-container-high')}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Tablas ---------- */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    // "relative": los textos sr-only (position: absolute) quedan dentro del scroll y no ensanchan la página en móvil.
    <div className={cn('relative w-full overflow-x-auto scrollbar-thin', className)}>
      <table className="w-full min-w-full border-collapse text-left">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({ children, className, align = 'left', ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      className={cn(
        'h-10 px-4 text-label-sm whitespace-nowrap text-slate-500 uppercase',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TR({
  children,
  className,
  onClick,
  highlight,
  ...rest
}: Omit<HTMLAttributes<HTMLTableRowElement>, 'onClick'> & { children: ReactNode; className?: string; onClick?: () => void; highlight?: 'danger' | 'warning' }) {
  return (
    <tr
      {...rest}
      onClick={onClick}
      className={cn(
        'border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/80',
        highlight === 'danger' && 'bg-red-50/40',
        highlight === 'warning' && 'bg-amber-50/40',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </tr>
  );
}

export function TD({ children, className, align = 'left', ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <td className={cn('px-4 py-3 align-middle text-body-md', align === 'right' && 'text-right tnum', align === 'center' && 'text-center', className)} {...rest}>
      {children}
    </td>
  );
}

/* ---------- Paginación ---------- */

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  label = 'registros',
  className
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  label?: string;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const nums: (number | '…')[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  return (
    <div className={cn('flex flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row', className)}>
      <span className="text-body-sm text-on-surface-variant">
        Mostrando <b className="tnum">{from}–{to}</b> de <b className="tnum">{total}</b> {label}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-lg p-2 text-slate-600 hover:bg-surface-container disabled:opacity-40" aria-label="Anterior">
            <ChevronLeft className="size-4" />
          </button>
          {nums.map((n, i) =>
            n === '…' ? (
              <span key={`e${i}`} className="px-1 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={cn('min-w-8 rounded-lg px-2 py-1 text-label-md tnum', n === page ? 'bg-primary text-white' : 'text-slate-600 hover:bg-surface-container')}
              >
                {n}
              </button>
            )
          )}
          <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} className="rounded-lg p-2 text-slate-600 hover:bg-surface-container disabled:opacity-40" aria-label="Siguiente">
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
