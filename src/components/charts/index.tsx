import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Mide el ancho disponible del contenedor para dibujar el SVG en píxeles reales. */
function useWidth<T extends HTMLElement>() {
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

/** Curva suave (monótona) a través de los puntos. */
function smoothPath(points: [number, number][]) {
  if (points.length < 2) return points.length ? `M${points[0][0]},${points[0][1]}` : '';
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * exp;
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 80), Math.max(80, width - 80));
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-inverse-surface px-3 py-2 text-body-sm whitespace-nowrap text-white shadow-overlay"
      style={{ left, top: y - 10 }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Sparkline({ data, className, color = 'var(--color-primary)' }: { data: number[]; className?: string; color?: string }) {
  const w = 100;
  const h = 36;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const pts: [number, number][] = data.map((v, i) => [data.length > 1 ? (i / (data.length - 1)) * w : w, h - 4 - ((v - min) / (max - min || 1)) * (h - 8)]);
  const line = smoothPath(pts);
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('h-9 w-24 overflow-visible', className)} preserveAspectRatio="none">
      {pts.length > 1 && <path d={`${line} L${w},${h} L0,${h} Z`} fill={color} opacity={0.1} />}
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {last && <circle cx={last[0]} cy={last[1]} r={3} fill={color} />}
    </svg>
  );
}

/* ------------------------------------------------------------------ */

export interface SeriesPoint {
  label: string;
  value: number;
  /** Texto adicional en el tooltip. */
  detail?: ReactNode;
  highlight?: boolean;
}

export function AreaChart({
  data,
  height = 240,
  formatValue = (v) => String(v),
  formatAxis,
  className,
  color = 'var(--color-primary)'
}: {
  data: SeriesPoint[];
  height?: number;
  formatValue?: (v: number) => string;
  formatAxis?: (v: number) => string;
  className?: string;
  color?: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 52, r: 16, t: 16, b: 28 };
  const innerW = Math.max(0, width - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const x = (i: number) => pad.l + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;
  const pts = data.map((d, i) => [x(i), y(d.value)] as [number, number]);
  const line = smoothPath(pts);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(innerW / 70))));
  const gid = useMemo(() => `ag${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div ref={ref} className={cn('relative w-full', className)} style={{ height }} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} className="overflow-visible">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray="4 4" />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-400 text-[10px] tnum">
                {(formatAxis ?? formatValue)(t)}
              </text>
            </g>
          ))}
          {pts.length > 1 && <path d={`${line} L${pts[pts.length - 1][0]},${pad.t + innerH} L${pts[0][0]},${pad.t + innerH} Z`} fill={`url(#${gid})`} />}
          <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
          {data.map((d, i) => (
            <g key={i}>
              {(i % labelEvery === 0 || i === data.length - 1) && (
                <text x={x(i)} y={height - 8} textAnchor="middle" className={cn('text-[11px]', d.highlight ? 'fill-primary font-bold' : 'fill-slate-500')}>
                  {d.label}
                </text>
              )}
              <circle cx={pts[i][0]} cy={pts[i][1]} r={hover === i || d.highlight ? 5 : 3.5} fill="white" stroke={color} strokeWidth={2.5} />
              <rect
                x={x(i) - innerW / Math.max(1, data.length) / 2}
                y={pad.t}
                width={innerW / Math.max(1, data.length)}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + innerH} stroke={color} strokeOpacity={0.3} />}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={x(hover)} y={y(data[hover].value)} width={width}>
          <div className="font-semibold">{data[hover].label}</div>
          <div className="tnum">{formatValue(data[hover].value)}</div>
          {data[hover].detail && <div className="text-slate-300">{data[hover].detail}</div>}
        </Tooltip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export interface ComboPoint {
  label: string;
  bar: number;
  line: number;
  detail?: ReactNode;
  highlight?: boolean;
}

/** Barras (ej. ganancia) + línea (ej. ventas) + línea de meta opcional. */
export function ComboChart({
  data,
  height = 280,
  target,
  formatValue = (v) => String(v),
  formatAxis,
  barLabel = 'Barras',
  lineLabel = 'Línea',
  className
}: {
  data: ComboPoint[];
  height?: number;
  target?: number | null;
  formatValue?: (v: number) => string;
  formatAxis?: (v: number) => string;
  barLabel?: string;
  lineLabel?: string;
  className?: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 56, r: 16, t: 16, b: 28 };
  const innerW = Math.max(0, width - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.bar, d.line)), target ?? 0, 0));
  const slot = innerW / Math.max(1, data.length);
  const x = (i: number) => pad.l + slot * i + slot / 2;
  const y = (v: number) => pad.t + innerH - (Math.max(0, v) / max) * innerH;
  const barW = Math.max(4, Math.min(28, slot * 0.5));
  const linePts = data.map((d, i) => [x(i), y(d.line)] as [number, number]);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(innerW / 64))));
  const gid = useMemo(() => `cg${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-4 text-body-sm text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-primary" /> {lineLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-secondary-container" /> {barLabel}
        </span>
        {target ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0 w-4 border-t-2 border-dashed border-slate-500" /> Meta ({formatValue(target)})
          </span>
        ) : null}
      </div>
      <div ref={ref} className="relative w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={height} className="overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="#eef2f7" />
                <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-400 text-[10px] tnum">
                  {(formatAxis ?? formatValue)(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => (
              <g key={i}>
                <rect
                  x={x(i) - barW / 2}
                  y={y(d.bar)}
                  width={barW}
                  height={Math.max(0, pad.t + innerH - y(d.bar))}
                  rx={4}
                  className={cn('transition-opacity', hover !== null && hover !== i ? 'opacity-50' : 'opacity-100')}
                  fill="var(--color-secondary-container)"
                />
                {(i % labelEvery === 0 || i === data.length - 1) && (
                  <text x={x(i)} y={height - 8} textAnchor="middle" className={cn('text-[11px]', d.highlight ? 'fill-primary font-bold' : 'fill-slate-500')}>
                    {d.label}
                  </text>
                )}
              </g>
            ))}
            {target ? <line x1={pad.l} x2={width - pad.r} y1={y(target)} y2={y(target)} stroke="#64748b" strokeWidth={1.5} strokeDasharray="6 5" /> : null}
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            {linePts.length > 1 && (
              <path
                d={`${smoothPath(linePts)} L${linePts[linePts.length - 1][0]},${pad.t + innerH} L${linePts[0][0]},${pad.t + innerH} Z`}
                fill={`url(#${gid})`}
                className="pointer-events-none"
              />
            )}
            <path d={smoothPath(linePts)} fill="none" stroke="var(--color-primary)" strokeWidth={2.5} strokeLinecap="round" />
            {linePts.map(([px, py], i) => (
              <circle key={i} cx={px} cy={py} r={hover === i ? 5 : 0} fill="white" stroke="var(--color-primary)" strokeWidth={2.5} />
            ))}
            {data.map((_, i) => (
              <rect key={`h${i}`} x={pad.l + slot * i} y={pad.t} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
            ))}
          </svg>
        )}
        {hover !== null && data[hover] && (
          <Tooltip x={x(hover)} y={Math.min(y(data[hover].line), y(data[hover].bar))} width={width}>
            <div className="mb-1 font-semibold">{data[hover].label}</div>
            <div className="flex justify-between gap-4 tnum">
              <span className="text-slate-300">{lineLabel}</span>
              <span className="font-semibold">{formatValue(data[hover].line)}</span>
            </div>
            <div className="flex justify-between gap-4 tnum">
              <span className="text-slate-300">{barLabel}</span>
              <span className="font-semibold">{formatValue(data[hover].bar)}</span>
            </div>
            {data[hover].detail && <div className="mt-1 text-slate-300">{data[hover].detail}</div>}
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export const CHART_COLORS = ['#006948', '#316bf3', '#f59e0b', '#64748b', '#8b5cf6', '#ef4444', '#14b8a6', '#ec4899'];

export interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  size = 180,
  thickness = 22,
  className
}: {
  segments: DonutSegment[];
  centerValue?: ReactNode;
  centerLabel?: ReactNode;
  size?: number;
  thickness?: number;
  className?: string;
}) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-container)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s, i) => {
            const len = (Math.max(0, s.value) / total) * c;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={thickness}
                strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {centerValue && <span className="text-headline-md text-on-surface tnum">{centerValue}</span>}
        {centerLabel && <span className="text-body-sm text-on-surface-variant">{centerLabel}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Mapa de calor (ej. días × horas). values[fila][columna] */
export function Heatmap({
  rows,
  cols,
  values,
  formatValue = (v) => String(v),
  className
}: {
  rows: string[];
  cols: string[];
  values: number[][];
  formatValue?: (v: number) => string;
  className?: string;
}) {
  const max = Math.max(1, ...values.flat());
  const shade = (v: number) => {
    if (v <= 0) return 'bg-surface-container-low text-transparent';
    const t = v / max;
    if (t < 0.2) return 'bg-emerald-50 text-emerald-700';
    if (t < 0.4) return 'bg-emerald-100 text-emerald-800';
    if (t < 0.6) return 'bg-emerald-300 text-emerald-900';
    if (t < 0.8) return 'bg-emerald-500 text-white';
    return 'bg-primary text-white';
  };
  return (
    <div className={cn('overflow-x-auto scrollbar-thin', className)}>
      <table className="w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c} className="text-center text-label-sm font-semibold text-slate-500">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <td className="w-10 pr-2 text-label-md whitespace-nowrap text-slate-600">{r}</td>
              {cols.map((c, ci) => {
                const v = values[ri]?.[ci] ?? 0;
                return (
                  <td key={c} title={`${r} ${c}: ${formatValue(v)}`} className={cn('h-7 min-w-8 rounded-md text-center text-[10px] font-bold tnum', shade(v))}>
                    {v > 0 ? formatValue(v) : '·'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export interface BarListItem {
  label: ReactNode;
  value: number;
  /** Texto a la derecha (si no, se usa formatValue(value)). */
  display?: ReactNode;
  sub?: ReactNode;
  color?: string;
}

/** Lista con barras horizontales proporcionales (ej. categorías más vendidas). */
export function BarList({ items, formatValue = (v) => String(v), className }: { items: BarListItem[]; formatValue?: (v: number) => string; className?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-label-md text-on-surface">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: it.color ?? CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="truncate">{it.label}</span>
            </span>
            <span className="text-label-md text-on-surface tnum">{it.display ?? formatValue(it.value)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: it.color ?? CHART_COLORS[i % CHART_COLORS.length] }} />
          </div>
          {it.sub && <span className="text-body-sm text-on-surface-variant">{it.sub}</span>}
        </div>
      ))}
    </div>
  );
}
