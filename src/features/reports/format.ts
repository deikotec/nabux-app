import type { TS } from '@/types';
import { toDate } from '@/lib/format';

/** Hora en formato 24 h ("15:42"), más compacta que "03:42 p.m." para tablas y encabezados. */
export function hhmm(value: TS | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "1 agotado" / "3 agotados". */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}
