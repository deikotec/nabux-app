import { useMemo } from 'react';
import { RATE_SOURCE_LABELS } from '@/config/app';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useFx } from '@/contexts/FxContext';
import { formatRate } from '@/lib/fx';
import { round2 } from '@/lib/utils';
import type { TaxCtx } from './helpers';

/** Lo que la pantalla de inventario necesita del modo bimonetario y del IVA venezolano. */
export interface InventoryFx {
  /** Modo bimonetario activo: precios en $ y equivalentes en Bs. */
  dual: boolean;
  /** Tasa vigente (Bs por $) o null. */
  rate: number | null;
  /** Bimonetario pero todavía sin tasa: los equivalentes en Bs no están disponibles. */
  missingRate: boolean;
  /** La tasa BCV no es reciente. */
  stale: boolean;
  /** "Bs. 1.234,56" a partir de un monto en $. Es null si no hay modo bimonetario o tasa: no se muestra nada. */
  local: ((usd: number | null | undefined) => string) | null;
  /** $ → Bs numérico (para el CSV), o null sin tasa. */
  toLocal: (usd: number) => number | null;
  /** Bs → $ redondeado a centavos, o null sin tasa. */
  fromLocal: (bs: number) => number | null;
  /** Formatea un monto ya expresado en Bs. */
  formatLocal: (bs: number | null | undefined) => string;
  /** "BCV (oficial)". */
  sourceLabel: string;
  /** "36,52 Bs/$". */
  rateText: string;
  /** Controles de IVA exento (negocios en Venezuela). */
  exemptUi: boolean;
  /** Impuesto para calcular márgenes sobre el precio sin IVA (null = margen sobre el precio de venta, como siempre). */
  tax: TaxCtx | null;
  taxName: string;
  taxRate: number;
}

export function useInventoryFx(): InventoryFx {
  const { business } = useActiveBusiness();
  const fx = useFx();
  const taxRate = Number(business.taxRate) || 0;
  const taxName = business.taxName || 'IVA';
  // El IVA exento es una necesidad venezolana: fuera de VE la pantalla se ve igual que antes.
  const exemptUi = fx.enabled || business.country === 'VE';
  const included = business.pricesIncludeTax;

  return useMemo<InventoryFx>(() => {
    const dual = fx.enabled;
    const rate = dual ? fx.rate : null;
    return {
      dual,
      rate,
      missingRate: dual && !fx.loading && !rate,
      stale: dual && !!rate && fx.stale,
      local: dual && rate ? (usd) => fx.moneyLocal(usd) : null,
      toLocal: (usd) => (dual ? fx.toLocal(usd) : null),
      fromLocal: (bs) => {
        const v = dual ? fx.fromLocal(bs) : null;
        return v === null ? null : round2(v);
      },
      formatLocal: fx.formatLocal,
      sourceLabel: RATE_SOURCE_LABELS[fx.rateSource] ?? 'Tasa',
      rateText: formatRate(rate),
      exemptUi,
      tax: exemptUi && taxRate > 0 ? { rate: taxRate, included, name: taxName } : null,
      taxName,
      taxRate
    };
  }, [fx, exemptUi, taxRate, included, taxName]);
}
