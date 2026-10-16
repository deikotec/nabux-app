import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type PointerEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { smoothPath } from '@/components/charts';
import { cn } from '@/lib/utils';

/*
 * Piezas de la versión móvil (pantallas de referencia en ref/movil): tarjetas sin borde con sombra
 * suave, píldoras de estado, pestañas segmentadas a todo el ancho, encabezados de sección y dos
 * gráficas compactas pensadas para el dedo.
 */

/* ---------- Tarjeta ---------- */

export function MCard({ className, children, padded = true, ...rest }: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div className={cn('rounded-xl bg-surface-container-lowest shadow-card', padded && 'p-3', className)} {...rest}>
      {children}
    </div>
  );
}

/* ---------- Píldoras ---------- */

export type PillTone = 'primary' | 'success' | 'secondary' | 'tertiary' | 'error' | 'neutral' | 'muted';

const PILL: Record<PillTone, { body: string; dot: string }> = {
  primary: { body: 'bg-primary-fixed text-on-primary-fixed', dot: 'bg-primary' },
  success: { body: 'bg-primary-fixed-dim/30 text-on-primary-fixed-variant', dot: 'bg-primary' },
  secondary: { body: 'bg-secondary-fixed text-on-secondary-fixed', dot: 'bg-secondary' },
  tertiary: { body: 'bg-tertiary-fixed text-on-tertiary-fixed', dot: 'bg-tertiary' },
  error: { body: 'bg-error-container text-on-error-container', dot: 'bg-error' },
  neutral: { body: 'bg-surface-container-high text-on-surface', dot: 'bg-outline' },
  muted: { body: 'bg-surface-container-high text-on-surface-variant', dot: 'bg-outline' }
};

/** Etiqueta redonda de estado ("● Turno mañana", "Prom. $21,00"). */
export function Pill({
  tone = 'neutral',
  dot,
  pulse,
  icon: Icon,
  size = 'sm',
  className,
  children
}: {
  tone?: PillTone;
  dot?: boolean;
  pulse?: boolean;
  icon?: LucideIcon;
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full text-label-sm whitespace-nowrap',
        size === 'md' ? 'gap-1.5 px-2.5 py-1' : 'gap-1 px-1.5 py-0.5',
        PILL[tone].body,
        className
      )}
    >
      {dot && <span className={cn('shrink-0 rounded-full', size === 'md' ? 'size-2' : 'size-1.5', PILL[tone].dot, pulse && 'animate-pulse')} aria-hidden />}
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
      {children}
    </span>
  );
}

/* ---------- Pestañas segmentadas ---------- */

export interface PillTabOption<T extends string> {
  value: T;
  label: ReactNode;
}

/** Selector segmentado a todo el ancho ("Hoy | 7 días | Este mes"). */
export function PillTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  className
}: {
  options: PillTabOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Nombre accesible del grupo. */
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex w-full items-center gap-1 rounded-xl bg-surface-container-low p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-w-0 flex-1 truncate rounded-lg px-1.5 py-1.5 text-center text-label-md transition-all',
              active ? 'bg-surface-container-lowest font-bold text-primary shadow-card' : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Encabezados ---------- */

/** Título de sección con ícono y un dato o acción a la derecha. */
export function MSectionHeader({
  icon: Icon,
  iconClassName = 'text-primary',
  title,
  aside,
  className
}: {
  icon?: LucideIcon;
  iconClassName?: string;
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <div className="flex min-w-0 items-center gap-1.5">
        {Icon && <Icon className={cn('size-5 shrink-0', iconClassName)} aria-hidden />}
        <h2 className="truncate text-headline-sm font-bold text-on-surface">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

/** Texto secundario a la derecha de un encabezado de sección. */
export function SectionNote({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('shrink-0 text-label-sm text-outline', className)}>{children}</span>;
}

/**
 * Tamaño del número grande de una tarjeta angosta según su largo: los montos en pesos o bolívares
 * pueden tener muchas cifras y no deben cortarse.
 */
export function fitAmount(text: string): string {
  if (text.length <= 9) return 'text-headline-lg-mobile';
  if (text.length <= 12) return 'text-[19px] leading-7 font-bold tracking-tight';
  return 'text-headline-sm font-bold';
}

/** Texto largo que en pantallas muy angostas (menos de 380 px) se cambia por uno corto. */
export function Narrow({ full, short }: { full: string; short: string }) {
  return (
    <>
      {/* El texto completo sigue disponible para lectores de pantalla. */}
      <span className="max-[380px]:sr-only">{full}</span>
      <span className="min-[380px]:hidden" aria-hidden>
        {short}
      </span>
    </>
  );
}

/** Botón redondo de ícono (esquina de los encabezados de página). */
export function RoundButton({
  icon: Icon,
  label,
  active,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; /** Resaltado (algo configurado). */ active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-full shadow-card transition-all active:scale-95',
        active ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-surface-container text-on-surface hover:bg-surface-container-high',
        className
      )}
      {...rest}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}

/* ---------- Gráficas ---------- */

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

export interface MiniPoint {
  /** Etiqueta del eje ("08h", "Lun"). */
  label: string;
  value: number;
  /** Tramo que aún no llega (horas futuras de hoy): no se dibuja. */
  future?: boolean;
}

/**
 * Curva de área compacta ("Ritmo de ventas"). Se toca o se arrastra para ver el detalle de un punto;
 * `peak` se marca con un punto grande.
 */
export function MiniAreaChart({
  points,
  showLabel,
  peak,
  active,
  onActive,
  label,
  height = 132,
  className
}: {
  points: MiniPoint[];
  /** ¿Lleva etiqueta en el eje este índice? */
  showLabel: (i: number) => boolean;
  peak: number | null;
  active: number | null;
  onActive: (i: number | null) => void;
  /** Descripción accesible de la gráfica. */
  label: string;
  height?: number;
  className?: string;
}) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, '');
  const n = points.length;
  let last = -1;
  points.forEach((p, i) => {
    if (!p.future) last = i;
  });

  const top = 14;
  const labelH = 22;
  const plotH = height - top - labelH;
  const padX = 6;
  const innerW = Math.max(1, width - padX * 2);
  const max = Math.max(1, ...points.slice(0, last + 1).map((p) => p.value)) * 1.1;
  const x = (i: number) => padX + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const y = (v: number) => top + plotH - (Math.max(0, v) / max) * plotH;
  const pts = points.slice(0, last + 1).map((p, i) => [x(i), y(p.value)] as [number, number]);
  const line = smoothPath(pts);
  const base = top + plotH;

  // Etiquetas del eje sin encimarse: primero el pico, el punto activo y los extremos; luego el resto.
  const anchorOf = (i: number) => (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle');
  const labels: number[] = [];
  const taken: [number, number][] = [];
  const candidates = points.map((_, i) => i).filter(showLabel);
  const order = [...new Set([peak, active, 0, n - 1, ...candidates].filter((i): i is number => i !== null && candidates.includes(i)))];
  for (const i of order) {
    const w = points[i].label.length * 6.6 + 2;
    const cx = x(i);
    const a = anchorOf(i);
    const span: [number, number] = a === 'start' ? [cx, cx + w] : a === 'end' ? [cx - w, cx] : [cx - w / 2, cx + w / 2];
    if (taken.some(([l, r]) => span[0] < r + 6 && span[1] > l - 6)) continue;
    taken.push(span);
    labels.push(i);
  }

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    if (last < 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left - padX) / innerW;
    onActive(Math.max(0, Math.min(last, Math.round(rel * (n - 1)))));
  };

  return (
    <div ref={ref} className={cn('relative w-full select-none', className)} style={{ height }} role="img" aria-label={label}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="touch-pan-y overflow-visible"
          onPointerDown={pick}
          onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && pick(e)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && onActive(null)}
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <line x1={padX} x2={width - padX} y1={base} y2={base} stroke="var(--color-surface-container-high)" />
          {pts.length > 1 && (
            <>
              <path d={`${line} L${pts[pts.length - 1][0]},${base} L${pts[0][0]},${base} Z`} fill={`url(#${gid})`} />
              <path d={line} fill="none" stroke="var(--color-primary)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
          {pts.map(([cx, cy], i) =>
            labels.includes(i) && i !== peak && points[i].value > 0 ? <circle key={i} cx={cx} cy={cy} r={2.5} fill="var(--color-primary)" /> : null
          )}
          {active !== null && active <= last && (
            <line x1={x(active)} x2={x(active)} y1={top - 6} y2={base} stroke="var(--color-primary)" strokeOpacity={0.35} strokeDasharray="3 3" />
          )}
          {peak !== null && peak <= last && <circle cx={x(peak)} cy={y(points[peak].value)} r={4.5} fill="var(--color-primary)" stroke="#fff" strokeWidth={2} />}
          {active !== null && active !== peak && active <= last && (
            <circle cx={x(active)} cy={y(points[active].value)} r={4} fill="#fff" stroke="var(--color-primary)" strokeWidth={2.5} />
          )}
          {labels.map((i) => (
            <text
              key={`t${i}`}
              x={x(i)}
              y={height - 5}
              textAnchor={anchorOf(i)}
              className={cn('text-[11px] font-bold tracking-[0.04em] tnum', i === peak || i === active ? 'fill-primary' : 'fill-outline')}
            >
              {points[i].label}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

export interface MiniBar {
  key: string;
  /** Etiqueta bajo la barra ("L", "12", "9h"). */
  label: string;
  value: number;
  /** Texto accesible ("sábado 12 oct: $1.980"). */
  title: string;
}

/**
 * Barras verticales que se tocan para ver el detalle ("Ventas semanales"). La más alta lleva la marca
 * "MÁX"; la seleccionada muestra su monto encima.
 */
export function MiniBarChart({
  bars,
  selected,
  onSelect,
  formatTop,
  labelEvery = 1,
  height = 176,
  label,
  className
}: {
  bars: MiniBar[];
  selected: number | null;
  onSelect: (i: number) => void;
  /** Monto compacto encima de la barra seleccionada / pico. */
  formatTop: (v: number) => string;
  /** Mostrar la etiqueta de una de cada N barras (rangos largos). */
  labelEvery?: number;
  height?: number;
  label: string;
  className?: string;
}) {
  const max = Math.max(0, ...bars.map((b) => b.value));
  const peak = max > 0 ? bars.findIndex((b) => b.value === max) : -1;
  const dense = bars.length > 12;
  const gap = dense ? 'gap-0.5' : 'gap-2';

  return (
    <div className={cn('flex w-full flex-col', className)} style={{ height }} role="group" aria-label={label}>
      <div className={cn('flex min-h-0 flex-1 items-end pt-9', gap, !dense && 'px-1')}>
        {bars.map((b, i) => {
          const pct = max > 0 ? (b.value / max) * 100 : 0;
          const isPeak = i === peak;
          const isSel = i === selected;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => onSelect(i)}
              aria-pressed={isSel}
              aria-label={b.title}
              title={b.title}
              className="group relative flex h-full min-w-0 flex-1 items-end focus-visible:outline-none"
            >
              <span
                className={cn(
                  'w-full rounded-t transition-colors group-focus-visible:ring-2 group-focus-visible:ring-primary/40',
                  isPeak ? 'bg-primary-container shadow-card' : isSel ? 'bg-primary-fixed-dim' : 'bg-surface-container-high group-hover:bg-primary-fixed-dim'
                )}
                style={{ height: `${b.value > 0 ? Math.max(pct, 3) : 1.5}%` }}
              />
              {(isPeak || isSel) && (
                <span className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-0.5" style={{ bottom: `calc(${b.value > 0 ? Math.max(pct, 3) : 1.5}% + 4px)` }}>
                  {isPeak && <span className="rounded bg-tertiary px-1 text-[9px] leading-[14px] font-bold text-on-tertiary shadow-card">MÁX</span>}
                  {!dense && <span className="text-[10px] leading-3 font-bold whitespace-nowrap text-primary tnum">{formatTop(b.value)}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className={cn('flex pt-2', gap, !dense && 'px-1')} aria-hidden>
        {bars.map((b, i) => (
          <span
            key={b.key}
            className={cn(
              'min-w-0 flex-1 overflow-visible text-center text-label-sm whitespace-nowrap',
              i === peak || i === selected ? 'text-primary' : 'text-on-surface-variant'
            )}
          >
            {i % labelEvery === 0 || i === selected ? b.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
