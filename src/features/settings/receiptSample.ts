import { Timestamp } from 'firebase/firestore';
import { VE_PAYMENT_METHODS } from '@/config/app';
import { applyPayments, baseToMethod, methodCurrency } from '@/lib/payments';
import { computeTotals } from '@/lib/totals';
import { round2 } from '@/lib/utils';
import type { FxSettings, PaymentMethodConfig, RateSource, Sale, SaleItem } from '@/types';

/** Tasa ficticia para la vista previa cuando aún no hay tasa cargada (se rotula como ejemplo). */
export const EXAMPLE_RATE = 100;

type SampleItem = Pick<SaleItem, 'name' | 'qty' | 'unitPrice' | 'unitCost' | 'taxExempt'>;

/** Artículos ficticios SOLO para la vista previa del ticket (no se guardan). */
const SAMPLE_ITEMS: SampleItem[] = [
  { name: 'Artículo de ejemplo 1', qty: 2, unitPrice: 25, unitCost: 15 },
  { name: 'Artículo de ejemplo 2', qty: 1, unitPrice: 48.5, unitCost: 31 },
  { name: 'Artículo de ejemplo 3', qty: 3, unitPrice: 12.9, unitCost: 7.5 }
];

/** Versión en dólares, con un artículo exento de IVA para mostrar la marca "(E)". */
const SAMPLE_ITEMS_USD: SampleItem[] = [
  { name: 'Artículo de ejemplo 1', qty: 2, unitPrice: 2.5, unitCost: 1.6 },
  { name: 'Artículo de ejemplo 2', qty: 1, unitPrice: 4.85, unitCost: 3.1 },
  { name: 'Artículo exento de ejemplo', qty: 3, unitPrice: 1.2, unitCost: 0.8, taxExempt: true }
];

interface SampleBase {
  taxRate: number;
  pricesIncludeTax: boolean;
  actor: { uid: string; name: string };
}

function lines(items: SampleItem[]): SaleItem[] {
  return items.map((i) => ({ ...i, productId: null, total: round2(i.unitPrice * i.qty) }));
}

/** Venta de ejemplo de una sola moneda, pagada en efectivo con cambio. */
export function sampleSingleCurrencySale({ taxRate, pricesIncludeTax, actor }: SampleBase): Sale {
  const items = lines(SAMPLE_ITEMS);
  const totals = computeTotals({ items, discount: 0, taxRate, pricesIncludeTax });
  const cashReceived = Math.ceil(totals.total / 50) * 50 || totals.total;
  return {
    ...totals,
    id: 'ejemplo',
    folio: 'EJEMPLO',
    number: null,
    items,
    productIds: [],
    paymentMethod: 'cash',
    cashReceived,
    change: round2(cashReceived - totals.total),
    cashierId: actor.uid,
    cashierName: actor.name,
    status: 'completed',
    createdAt: Timestamp.now()
  };
}

/**
 * Venta de ejemplo bimonetaria: parte en bolívares por pago móvil (con referencia) y el resto con
 * un billete en $ (con IGTF si aplica); el excedente se devuelve como vuelto.
 */
export function sampleDualCurrencySale({
  taxRate,
  pricesIncludeTax,
  actor,
  currency,
  fx,
  methods,
  rate,
  rateSource
}: SampleBase & { currency: string; fx: FxSettings; methods: PaymentMethodConfig[]; rate: number; rateSource: RateSource }): Sale {
  const items = lines(SAMPLE_ITEMS_USD);
  const totals = computeTotals({ items, discount: 0, taxRate, pricesIncludeTax });
  const total = totals.total;

  const active = methods.filter((m) => m.active);
  const find = (...preds: ((m: PaymentMethodConfig) => boolean)[]) => {
    for (const p of preds) {
      const hit = active.find(p) ?? VE_PAYMENT_METHODS.find(p);
      if (hit) return hit;
    }
    return VE_PAYMENT_METHODS[0];
  };
  const local = find(
    (m) => m.currency === 'local' && m.kind === 'mobile',
    (m) => m.currency === 'local'
  );
  const cash = find(
    (m) => m.currency === 'base' && m.kind === 'cash',
    (m) => m.currency === 'base'
  );

  const biz = { currency, fx };
  const cashCover = total > 10 ? 5 : round2(total / 2);
  const igtfF = fx.enabled && fx.igtfEnabled && cash.igtf ? Math.max(0, fx.igtfRate || 0) / 100 : 0;
  const needed = cashCover * (1 + igtfF);
  let bill = Math.ceil(needed / 5) * 5;
  if (bill - needed < 0.5) bill += 5;

  const res = applyPayments({
    total,
    drafts: [
      { methodId: local.id, amount: round2((total - cashCover) * rate), reference: local.requiresReference ? '004512' : undefined },
      { methodId: cash.id, amount: bill }
    ],
    methods: [local, cash],
    business: biz,
    rate
  });
  const changeMethod = local.allowsChange ? local : cash;
  const changeAmount = res.excess > 0 ? baseToMethod(res.excess, changeMethod, rate) : null;

  return {
    ...totals,
    id: 'ejemplo',
    folio: 'EJEMPLO',
    number: null,
    items,
    productIds: [],
    paymentMethod: 'mixed',
    payments: res.lines,
    currency,
    localCurrency: fx.localCurrency,
    rate,
    rateSource,
    totalLocal: round2(total * rate),
    igtf: res.igtf,
    amountDue: res.amountDue,
    changeMethodId: res.excess > 0 ? changeMethod.id : null,
    changeCurrency: res.excess > 0 ? methodCurrency(changeMethod, biz) : null,
    changeAmount,
    change: res.excess,
    cashierId: actor.uid,
    cashierName: actor.name,
    status: 'completed',
    createdAt: Timestamp.now()
  };
}
