import { useEffect, useMemo, useState } from 'react';
import { useSalesRange } from '@/hooks/data';
import { dayKey, eachDay, previousRange, rangeFromPreset, sameDay, WEEKDAY_SHORT, type DateRange } from '@/lib/dates';
import { formatDate, toDate } from '@/lib/format';
import type { Sale } from '@/types';

export type DashPreset = 'today' | 'week' | 'month';

export const PRESET_COPY: Record<DashPreset, { label: string; period: string; vs: string; file: string }> = {
  today: { label: 'Hoy', period: 'de hoy', vs: 'vs ayer a esta hora', file: 'hoy' },
  week: { label: 'Esta semana', period: 'de la semana', vs: 'vs período anterior', file: 'semana' },
  month: { label: 'Este mes', period: 'del mes', vs: 'vs período anterior', file: 'mes' }
};

/** Hora de cierre de jornada usada para la proyección del día. */
export const CLOSING_HOUR = 21;

export interface DaySeriesPoint {
  date: Date;
  label: string;
  value: number;
  count: number;
  isToday: boolean;
}

export interface CategoryShare {
  name: string;
  total: number;
  pct: number;
  topProduct: string | null;
  /** Agrupa las categorías fuera del top 5. */
  other?: boolean;
}

export interface DashboardMetrics {
  loading: boolean;
  error: Error | null;
  range: DateRange;
  /** Ventas del período (todas, incluidas anuladas) — para exportar. */
  periodSales: Sale[];
  total: number;
  count: number;
  avg: number;
  /** Variación % contra el mismo tramo del período anterior (null si no hay base). */
  delta: number | null;
  /** Ventas por día de los últimos 7 días. */
  spark: number[];
  series: DaySeriesPoint[];
  seriesTitle: string;
  seriesTotal: number;
  seriesCount: number;
  bestDay: DaySeriesPoint | null;
  peakHour: { hour: number; count: number; total: number } | null;
  /** Solo para "Hoy". */
  projection: { projected: number; perHour: number; ticketsPerHour: number; closed: boolean } | null;
  /** Promedio diario (semana / mes). */
  avgPerDay: number;
  categories: CategoryShare[];
}

/** Reloj que avanza cada `every` ms (para que proyecciones y rangos no queden congelados). */
function useNow(every: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

const ms = (s: Sale) => toDate(s.createdAt)?.getTime() ?? Date.now();

/**
 * Una sola suscripción que cubre el período elegido, el período anterior y los últimos 7 días;
 * todo lo demás se calcula en memoria.
 */
export function useDashboardMetrics(preset: DashPreset): DashboardMetrics {
  const now = useNow(60_000);
  const today = dayKey(new Date(now));

  // `today` en las dependencias fuerza recalcular los rangos al cambiar de día.
  const ranges = useMemo(() => {
    const range = rangeFromPreset(preset);
    const prev = previousRange(range);
    const last7 = rangeFromPreset('7d');
    const from = new Date(Math.min(range.from.getTime(), prev.from.getTime(), last7.from.getTime()));
    return { range, prev, last7, wide: { from, to: range.to } };
  }, [preset, today]);

  const { data, loading, error } = useSalesRange(ranges.wide);

  const metrics = useMemo(() => {
    const { range, prev, last7 } = ranges;
    const from = range.from.getTime();
    const to = range.to.getTime();

    const periodSales = data.filter((s) => {
      const t = ms(s);
      return t >= from && t <= to;
    });
    const current = periodSales.filter((s) => s.status === 'completed');
    const completed = data.filter((s) => s.status === 'completed');

    const total = current.reduce((a, s) => a + (Number(s.total) || 0), 0);
    const count = current.length;

    // Comparación justa: mismo tiempo transcurrido dentro del período anterior.
    const elapsed = Math.min(now, to) - from;
    const prevFrom = prev.from.getTime();
    const prevCut = Math.min(prev.to.getTime(), prevFrom + elapsed);
    const prevTotal = completed.reduce((a, s) => {
      const t = ms(s);
      return t >= prevFrom && t <= prevCut ? a + (Number(s.total) || 0) : a;
    }, 0);
    const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

    // Ventas por día
    const byDay = new Map<string, { total: number; count: number }>();
    for (const s of completed) {
      const key = dayKey(new Date(ms(s)));
      const e = byDay.get(key) ?? { total: 0, count: 0 };
      e.total += Number(s.total) || 0;
      e.count += 1;
      byDay.set(key, e);
    }
    const now0 = new Date(now);
    const spark = eachDay(last7.from, last7.to).map((d) => byDay.get(dayKey(d))?.total ?? 0);

    const monthDays = preset === 'month' ? eachDay(range.from, now0) : [];
    const useMonth = monthDays.length >= 7;
    const chartDays = useMonth ? monthDays : eachDay(last7.from, last7.to);
    const series: DaySeriesPoint[] = chartDays.map((d) => {
      const e = byDay.get(dayKey(d));
      const isToday = sameDay(d, now0);
      return {
        date: d,
        label: isToday ? 'Hoy' : useMonth ? formatDate(d, { day: 'numeric', month: 'short' }) : `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()}`,
        value: e?.total ?? 0,
        count: e?.count ?? 0,
        isToday
      };
    });
    const seriesTotal = series.reduce((a, p) => a + p.value, 0);
    const seriesCount = series.reduce((a, p) => a + p.count, 0);
    const bestDay = series.reduce<DaySeriesPoint | null>((best, p) => (p.value > 0 && (!best || p.value > best.value) ? p : best), null);
    const seriesTitle = useMonth
      ? `Ventas por día · ${formatDate(range.from, { month: 'long', year: 'numeric' })}`
      : 'Ventas por día · últimos 7 días';

    // Hora pico del período (por número de tickets; desempata el monto)
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, total: 0 }));
    for (const s of current) {
      const h = new Date(ms(s)).getHours();
      hours[h].count += 1;
      hours[h].total += Number(s.total) || 0;
    }
    const peak = hours.reduce((b, h) => (h.count > b.count || (h.count === b.count && h.total > b.total) ? h : b), hours[0]);
    const peakHour = peak.count > 0 ? peak : null;

    // Proyección al cierre (solo hoy): ritmo por hora desde la primera venta × horas restantes hasta el cierre.
    let projection: DashboardMetrics['projection'] = null;
    if (preset === 'today' && count > 0) {
      const first = Math.min(...current.map(ms));
      const elapsedH = Math.max(1, (now - first) / 3_600_000);
      const perHour = total / elapsedH;
      const nowH = now0.getHours() + now0.getMinutes() / 60;
      const left = Math.max(0, CLOSING_HOUR - nowH);
      projection = { projected: total + perHour * left, perHour, ticketsPerHour: count / elapsedH, closed: left === 0 };
    }

    const elapsedDays = Math.max(1, eachDay(range.from, new Date(Math.min(now, to))).length);
    const avgPerDay = total / elapsedDays;

    // Participación por categoría (importe de línea)
    const cats = new Map<string, { total: number; products: Map<string, number> }>();
    let catTotal = 0;
    for (const s of current) {
      for (const it of s.items ?? []) {
        const name = it.category?.trim() || 'Sin categoría';
        const amount = Number(it.total) || (Number(it.unitPrice) || 0) * (Number(it.qty) || 0);
        const e = cats.get(name) ?? { total: 0, products: new Map<string, number>() };
        e.total += amount;
        e.products.set(it.name, (e.products.get(it.name) ?? 0) + amount);
        cats.set(name, e);
        catTotal += amount;
      }
    }
    const sorted = Array.from(cats, ([name, e]) => ({
      name,
      total: e.total,
      pct: catTotal > 0 ? (e.total / catTotal) * 100 : 0,
      topProduct: Array.from(e.products).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    })).sort((a, b) => b.total - a.total);
    const categories: CategoryShare[] = sorted.slice(0, 5);
    if (sorted.length > 5) {
      const rest = sorted.slice(5).reduce((a, c) => a + c.total, 0);
      categories.push({ name: `Otras (${sorted.length - 5})`, total: rest, pct: catTotal > 0 ? (rest / catTotal) * 100 : 0, topProduct: null, other: true });
    }

    return {
      range,
      periodSales,
      total,
      count,
      avg: count ? total / count : 0,
      delta,
      spark,
      series,
      seriesTitle,
      seriesTotal,
      seriesCount,
      bestDay,
      peakHour,
      projection,
      avgPerDay,
      categories
    };
  }, [data, ranges, preset, now]);

  return { ...metrics, loading, error };
}
