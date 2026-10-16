import type { Business, CashRegister } from '@/types';

/** Caja que tienen todos los negocios mientras no configuren otras. */
export const DEFAULT_REGISTER: CashRegister = { id: 'main', name: 'Caja principal', active: true };

/** Todas las cajas del negocio (incluye inactivas). */
export function registersOf(business: Pick<Business, 'registers'> | null | undefined): CashRegister[] {
  return business?.registers?.length ? business.registers : [DEFAULT_REGISTER];
}

/** Cajas en uso. Siempre hay al menos una. */
export function activeRegisters(business: Pick<Business, 'registers'> | null | undefined): CashRegister[] {
  const all = registersOf(business);
  const active = all.filter((r) => r.active);
  return active.length ? active : all.slice(0, 1);
}

/** Id corto y estable para una caja nueva (se usa en la ruta de Firestore y en las ventas). */
export function newRegisterId(existing: CashRegister[]): string {
  let n = existing.length + 1;
  while (existing.some((r) => r.id === `caja${n}`)) n++;
  return `caja${n}`;
}
