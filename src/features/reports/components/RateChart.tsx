import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { RateSource } from '@/types';
import { rateGap, type RatePoint } from '../analytics';
import { plainPct } from '../format';

export interface RateSeriesDef {
  key: RateSource;
  label: string;
  color: string;
}

/** Ancho real del contenedor para dibujar el SVG en píxeles. */
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

function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / exp;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * exp;
}

/** Dominio "bonito" que no arranca en cero (las tasas varían pocos puntos porcentuales). */
function domain(values: number[]) {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < hi * 0.004) {
    lo = lo * 0.99;
    hi = hi * 1.01;
  }
  const step = niceStep((hi - lo) / 4);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { lo: start, hi: end === start ? start + step : end, ticks };
}

/**
 * Gráfico de líneas sencillo con varias series (BCV, paralelo, propia), un solo eje Y,
 * cruz al pasar el cursor y tooltip con todos los valores y la brecha.
 */
export function RateChart({
  points,
  series,
  height = 240,
  formatValue,
  className
}: {
  points: RatePoint[];
  series: RateSeriesDef[];
  height?: number;
  formatValue: (v: number) => string;
  className?: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const values = points.flatMap((p) => series.map((s) => p[s.key])).filter((v): v is number => v !== null);
  const pad = { l: 52, r: 14, t: 12, b: 26 };
  const innerW = Math.max(0, width - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;
  const n = points.length;
  const { lo, hi, ticks } = values.length ? domain(values) : { lo: 0, hi: 1, ticks: [0, 1] };
  const x = (i: number) => pad.l + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const y = (v: number) => pad.t + innerH - ((v - lo) / (hi - lo || 1)) * innerH;
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / 64))));
  const slot = innerW / Math.max(1, n);
  const axisFmt = (v: number) => new Intl.NumberFormat('es-VE', { maximumFractionDigits: hi - lo < 5 ? 2 : hi - lo < 50 ? 1 : 0 }).format(v);

  /** Trazo de una serie, partido donde no hay dato. */
  const path = (key: RateSource) => {
    let d = '';
    let pen = false;
    points.forEach((p, i) => {
      const v = p[key];
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };

  const lastIndex = (key: RateSource) => {
    for (let i = n - 1; i >= 0; i--) if (points[i][key] !== null) return i;
    return -1;
  };

  const hp = hover !== null ? points[hover] : null;
  const gap = hp ? rateGap(hp.bcv, hp.parallel) : null;
  const tipLeft = hover !== null ? x(hover) : 0;

  return (
    <div
      ref={ref}
      className={cn('relative w-full touch-pan-y select-none', className)}
      style={{ height }}
      onMouseLeave={() => setHover(null)}
      role="img"
      aria-label={`Evolución de la tasa: ${series.map((s) => s.label).join(', ')}`}
    >
      {width > 0 && values.length > 0 && (
        <svg width={width} height={height} className="overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="#eef2f7" />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-400 text-[10px] tnum">
                {axisFmt(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text
                key={p.key}
                x={x(i)}
                y={height - 8}
                textAnchor={n > 1 && i === n - 1 ? 'end' : n > 1 && i === 0 ? 'start' : 'middle'}
                className={cn('text-[11px]', p.label === 'Hoy' ? 'fill-primary font-bold' : 'fill-slate-500')}
              >
                {p.label}
              </text>
            ) : null
          )}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + innerH} stroke="#94a3b8" strokeDasharray="3 3" />}
          {series.map((s) => (
            <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {series.map((s) => {
            const i = hover ?? lastIndex(s.key);
            const v = i >= 0 ? points[i]?.[s.key] : null;
            if (v === null || v === undefined) return null;
            return <circle key={s.key} cx={x(i)} cy={y(v)} r={4.5} fill={s.color} stroke="white" strokeWidth={2} />;
          })}
          {points.map((p, i) => (
            <rect
              key={`h${p.key}`}
              x={x(i) - slot / 2}
              y={pad.t}
              width={Math.max(slot, 8)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onPointerDown={() => setHover(i)}
            />
          ))}
        </svg>
      )}
      {hp && hover !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-lg bg-inverse-surface px-3 py-2 text-body-sm whitespace-nowrap text-white shadow-overlay"
          style={
            width >= 560
              ? tipLeft < width / 2
                ? { left: tipLeft + 10 }
                : { left: tipLeft - 10, transform: 'translateX(-100%)' }
              : tipLeft < width / 2
                ? { right: pad.r }
                : { left: pad.l }
          }
        >
          <div className="mb-1 font-semibold">
            {hp.longLabel}
            {hp.carried && hp.key !== 'base' ? <span className="font-normal text-slate-300"> · sin cambios</span> : null}
          </div>
          {series.map((s) => {
            const v = hp[s.key];
            return (
              <div key={s.key} className="flex items-center justify-between gap-4 tnum">
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <span className="size-2 rounded-full" style={{ background: s.color }} /> {s.label}
                </span>
                <span className="font-semibold">{v === null ? '—' : formatValue(v)}</span>
              </div>
            );
          })}
          {gap !== null && (
            <div className="mt-1 flex justify-between gap-4 border-t border-white/15 pt-1 tnum">
              <span className="text-slate-300">Brecha</span>
              <span className="font-semibold">{plainPct(gap)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
