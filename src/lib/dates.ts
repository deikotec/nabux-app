export function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function startOfWeek(d = new Date()): Date {
  // Semana que inicia en lunes
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7;
  return addDays(x, -day);
}

export function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Clave yyyy-mm-dd en hora local, útil para agrupar ventas por día. */
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Lista de días [from, to] inclusive. */
export function eachDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  let cur = startOfDay(from);
  const end = startOfDay(to);
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export type RangePreset = 'today' | 'yesterday' | 'week' | '7d' | 'month' | '30d' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
}

export function rangeFromPreset(preset: RangePreset, custom?: DateRange): DateRange {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const y = addDays(now, -1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case 'week':
      return { from: startOfWeek(now), to: endOfDay(now) };
    case '7d':
      return { from: startOfDay(addDays(now, -6)), to: endOfDay(now) };
    case 'month':
      return { from: startOfMonth(now), to: endOfDay(now) };
    case '30d':
      return { from: startOfDay(addDays(now, -29)), to: endOfDay(now) };
    case 'custom':
      return custom ?? { from: startOfDay(now), to: endOfDay(now) };
  }
}

/** Rango anterior de igual duración (para comparar vs período anterior). */
export function previousRange(r: DateRange): DateRange {
  const ms = r.to.getTime() - r.from.getTime();
  const to = new Date(r.from.getTime() - 1);
  return { from: new Date(to.getTime() - ms), to };
}

export const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function toInputDate(d: Date): string {
  return dayKey(d);
}

export function fromInputDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
