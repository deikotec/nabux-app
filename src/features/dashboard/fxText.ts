import { caracasToday } from '@/lib/fx';
import { formatDate } from '@/lib/format';
import type { FxRates, RateSource } from '@/types';

const rateFmt = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/** Tasa sin unidades: "36,5210". */
export function rateNumber(rate: number | null | undefined): string {
  return rate && rate > 0 ? rateFmt.format(rate) : '—';
}

/** Fecha de vigencia BCV (yyyy-mm-dd) en texto: "hoy", "mañana" o "jue, 15 oct". */
export function bcvDateText(bcvDate: string | null | undefined): string | null {
  if (!bcvDate) return null;
  const today = caracasToday();
  if (bcvDate === today) return 'hoy';
  const d = new Date(`${bcvDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return bcvDate;
  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (bcvDate === tomorrow.toLocaleDateString('en-CA')) return 'mañana';
  return formatDate(d, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Vigente hoy", "Vigente desde mañana", "Vigente desde el lun, 19 oct" (publicada por adelantado) o "Vigente del jue, 9 oct". */
export function bcvValidityText(bcvDate: string | null | undefined): string | null {
  const text = bcvDateText(bcvDate);
  if (!text || !bcvDate) return null;
  if (text === 'hoy') return 'Vigente hoy';
  if (bcvDate > caracasToday()) return text === 'mañana' ? 'Vigente desde mañana' : `Vigente desde el ${text}`;
  return `Vigente del ${text}`;
}

/** Fuente cuya tasa usa realmente el POS (si la elegida está vacía, cae a BCV como `effectiveRate`). */
export function usedRateSource(rates: FxRates | null | undefined, source: RateSource): RateSource | null {
  if (!rates) return null;
  if ((rates[source] ?? 0) > 0) return source;
  return (rates.bcv ?? 0) > 0 ? 'bcv' : null;
}
