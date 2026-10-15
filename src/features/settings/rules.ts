import type { InventorySettings } from '@/types';

export interface RuleStatus {
  id: keyof InventorySettings;
  label: string;
  active: boolean;
}

/** Reglas operativas que se derivan de la configuración de inventario/POS. */
export function ruleStatuses(s: InventorySettings): RuleStatus[] {
  return [
    { id: 'lowStockDefault', label: 'Stock mínimo por defecto', active: Number(s.lowStockDefault) > 0 },
    { id: 'allowNegativeStock', label: 'Bloqueo de venta sin stock', active: !s.allowNegativeStock },
    { id: 'requireCashSession', label: 'Caja abierta para cobrar', active: !!s.requireCashSession },
    { id: 'minMarginPct', label: 'Margen mínimo recomendado', active: Number(s.minMarginPct) > 0 },
    { id: 'maxDiscountPct', label: 'Tope de descuento por ticket', active: Number(s.maxDiscountPct) < 100 },
    { id: 'scanBeep', label: 'Sonido al escanear', active: !!s.scanBeep }
  ];
}

export function countActiveRules(s: InventorySettings) {
  const list = ruleStatuses(s);
  return { active: list.filter((r) => r.active).length, total: list.length, list };
}

/** Precio sugerido para lograr un margen bruto (sobre precio de venta) dado un costo. */
export function suggestedPrice(cost: number, marginPct: number): number | null {
  const m = Number(marginPct) / 100;
  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(m) || m >= 1 || m < 0) return null;
  return cost / (1 - m);
}
