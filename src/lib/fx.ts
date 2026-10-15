import type { FxRates, RateSource } from '@/types';
import { round2 } from './utils';

/** Tasa vigente según la fuente elegida (Bs por 1 $). Si la fuente no tiene valor, cae a BCV. */
export function effectiveRate(rates: FxRates | null | undefined, source: RateSource): number | null {
  if (!rates) return null;
  const v = rates[source] ?? null;
  if (v && v > 0) return v;
  return rates.bcv && rates.bcv > 0 ? rates.bcv : null;
}

/** Redondea al múltiplo de `step` más cercano (step 0.01 = céntimos). */
export function roundTo(n: number, step = 0.01): number {
  if (!step || step <= 0.01) return round2(n);
  return round2(Math.round(n / step) * step);
}

/** Redondea hacia arriba al múltiplo de `step` (para cobrar sin quedarse corto). */
export function ceilTo(n: number, step = 0.01): number {
  const s = step && step > 0 ? step : 0.01;
  return round2(Math.ceil(round2(n / s) - 1e-9) * s);
}

/** Moneda base → moneda local. */
export function toLocal(amountBase: number, rate: number | null | undefined, step = 0.01): number | null {
  if (!rate || rate <= 0) return null;
  return roundTo((Number(amountBase) || 0) * rate, step);
}

/** Moneda local → moneda base. */
export function fromLocal(amountLocal: number, rate: number | null | undefined): number | null {
  if (!rate || rate <= 0) return null;
  return (Number(amountLocal) || 0) / rate;
}

/** Fecha de hoy en Caracas (yyyy-mm-dd): la tasa BCV vigente cambia por día hábil. */
export function caracasToday(): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * ¿La tasa BCV está desactualizada? El BCV no publica en fines de semana ni feriados, por eso se
 * considera vieja solo si su fecha de vigencia tiene más de 3 días (o si no hay tasa).
 */
export function isRateStale(rates: FxRates | null | undefined): boolean {
  if (!rates?.bcv) return true;
  const limit = new Date(`${caracasToday()}T12:00:00`);
  limit.setDate(limit.getDate() - 3);
  if (rates.bcvDate) return rates.bcvDate < limit.toISOString().slice(0, 10);
  // Sin fecha de vigencia: se usa la fecha de la última actualización.
  const updated = rates.updatedAt && typeof rates.updatedAt.toDate === 'function' ? rates.updatedAt.toDate() : null;
  return !updated || updated < limit;
}

export interface FetchedRates {
  bcv: number | null;
  parallel: number | null;
  bcvDate: string | null;
  parallelUpdatedAt: string | null;
}

/**
 * Consulta las tasas del dólar en Venezuela (BCV oficial y paralelo) en ve.dolarapi.com.
 * Lanza un error si no hay conexión o el servicio no responde.
 */
export async function fetchVenezuelaRates(timeoutMs = 9000): Promise<FetchedRates> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares', { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`El servicio de tasas respondió ${res.status}.`);
    const list = (await res.json()) as { fuente?: string; promedio?: number | null; venta?: number | null; fechaActualizacion?: string }[];
    const pick = (fuente: string) => list.find((x) => x.fuente === fuente);
    const ofi = pick('oficial');
    const par = pick('paralelo');
    const value = (x?: { promedio?: number | null; venta?: number | null }) => {
      const v = Number(x?.promedio ?? x?.venta);
      return Number.isFinite(v) && v > 0 ? Math.round(v * 10000) / 10000 : null;
    };
    return {
      bcv: value(ofi),
      parallel: value(par),
      bcvDate: ofi?.fechaActualizacion ? ofi.fechaActualizacion.slice(0, 10) : null,
      parallelUpdatedAt: par?.fechaActualizacion ?? null
    };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('El servicio de tasas tardó demasiado en responder.');
    throw e instanceof Error ? e : new Error('No se pudieron consultar las tasas.');
  } finally {
    clearTimeout(timer);
  }
}

/** Formato de tasa: "879,12 Bs/$". */
export function formatRate(rate: number | null | undefined, localSymbol = 'Bs', baseSymbol = '$'): string {
  if (!rate) return '—';
  return `${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(rate)} ${localSymbol}/${baseSymbol}`;
}
