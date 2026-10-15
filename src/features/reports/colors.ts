/**
 * Colores estables para las gráficas de reportes.
 * Paleta categórica validada (orden fijo, separable con daltonismo en pares adyacentes); el color
 * sigue a la entidad (forma de pago, moneda, fuente de tasa), nunca a su posición en el ranking.
 */
import type { RateSource } from '@/types';

const BLUE = '#2a78d6';
const ORANGE = '#eb6834';
const AQUA = '#1baf7a';
const YELLOW = '#eda100';
const MAGENTA = '#e87ba4';
const GREEN = '#008300';
const VIOLET = '#6250d6';
const RED = '#e34948';

const PALETTE = [BLUE, ORANGE, AQUA, YELLOW, MAGENTA, GREEN, VIOLET, RED];

/** Color neutro para "Otras" o formas de pago que ya no caben en la paleta. */
export const OTHER_COLOR = '#94a3b8';

/** Métodos de las primeras versiones: conservan los colores de siempre (efectivo, tarjeta, transferencia). */
const LEGACY: Record<string, string> = { cash: '#006948', card: '#316bf3', transfer: '#ffb95f' };

/** Formas de pago venezolanas predeterminadas: un color fijo cada una. */
const FIXED: Record<string, string> = {
  pago_movil: BLUE,
  punto: ORANGE,
  cash_usd: AQUA,
  cash_ves: YELLOW,
  usdt: MAGENTA,
  transfer_ves: GREEN,
  zelle: VIOLET,
  biopago: RED
};

/**
 * Devuelve una función id → color. Las formas de pago conocidas tienen color fijo; las personalizadas
 * toman, en el orden de la configuración del negocio, los colores que no usa ninguna otra configurada.
 */
export function buildMethodColors(configuredIds: string[]): (methodId: string) => string {
  const map = new Map<string, string>();
  const used = new Set<string>();
  for (const id of configuredIds) {
    if (FIXED[id]) {
      map.set(id, FIXED[id]);
      used.add(FIXED[id]);
    }
  }
  const free = PALETTE.filter((c) => !used.has(c));
  for (const id of configuredIds) if (!map.has(id) && !LEGACY[id]) map.set(id, free.shift() ?? OTHER_COLOR);
  return (id) => LEGACY[id] ?? map.get(id) ?? FIXED[id] ?? OTHER_COLOR;
}

/** Divisas ($) vs moneda local (Bs). */
export const CURRENCY_COLORS = { base: AQUA, local: BLUE } as const;

/** Series de la tasa de cambio. */
export const RATE_COLORS: Record<RateSource, string> = { bcv: BLUE, parallel: ORANGE, custom: AQUA };
