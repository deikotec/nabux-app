import { useCallback, useMemo, useRef, useState } from 'react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useToast } from '@/components/ui';
import { FREE_AMOUNT_ITEM_NAME } from '@/config/app';
import { computeTotals } from '@/lib/totals';
import { formatNumber } from '@/lib/format';
import { beep, round2 } from '@/lib/utils';
import type { PaymentMethod, Product, SaleItem } from '@/types';
import { allowsDecimalQty, discountToAmount, newId, roundQty } from '../posUtils';
import type { CartLine, TicketDiscount } from '../types';

export interface TicketHighlight {
  key: string;
  /** Cambia en cada toque para re-disparar el resaltado. */
  nonce: number;
}

export interface TicketSnapshot {
  lines: CartLine[];
  discount: TicketDiscount | null;
  customerName: string;
}

/**
 * Estado del ticket en curso: líneas, descuento, cliente y pago.
 * Las validaciones de stock usan una referencia sincrónica para soportar
 * ráfagas de escaneo (varios Enter antes de que React re-renderice).
 */
export function useTicket() {
  const { business, can } = useActiveBusiness();
  const { productsById } = useCatalog();
  const toast = useToast();

  const [lines, setLines] = useState<CartLine[]>([]);
  const linesRef = useRef<CartLine[]>([]);
  const [discount, setDiscount] = useState<TicketDiscount | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<number | ''>('');
  const [highlight, setHighlight] = useState<TicketHighlight | null>(null);
  const nonceRef = useRef(0);

  const allowNegative = !!business.settings.allowNegativeStock;
  const scanBeep = business.settings.scanBeep !== false;
  const canDiscount = can('discounts');
  const maxDiscountPct = canDiscount ? Math.max(0, Number(business.settings.maxDiscountPct) || 0) : 0;

  const commit = useCallback((next: CartLine[]) => {
    linesRef.current = next;
    setLines(next);
  }, []);

  const touch = useCallback((key: string) => {
    nonceRef.current += 1;
    setHighlight({ key, nonce: nonceRef.current });
  }, []);

  const productStock = useCallback((productId: string) => Number(productsById.get(productId)?.stock) || 0, [productsById]);

  /** Agrega (o suma) un producto del catálogo. Devuelve true si se agregó. */
  const addProduct = useCallback(
    (product: Product, qty = 1): boolean => {
      if (product.active === false) {
        toast.error(`“${product.name}” está desactivado y no se puede vender.`);
        return false;
      }
      if (!(qty > 0)) return false;
      if (!allowsDecimalQty(product.unit) && !Number.isInteger(qty)) {
        toast.error(`“${product.name}” se vende por unidades enteras.`);
        return false;
      }
      const current = linesRef.current;
      const idx = current.findIndex((l) => l.productId === product.id);
      const inCart = idx >= 0 ? current[idx].qty : 0;
      const nextQty = roundQty(inCart + qty);
      const stock = Number(product.stock) || 0;
      if (!allowNegative && nextQty > stock) {
        toast.warning(
          stock <= 0
            ? `“${product.name}” está agotado.`
            : `Stock insuficiente de “${product.name}”: hay ${formatNumber(stock)}${inCart ? ` y ya llevas ${formatNumber(inCart)} en el ticket` : ''}.`
        );
        if (scanBeep) beep(220, 180);
        return false;
      }
      const next =
        idx >= 0
          ? current.map((l, i) => (i === idx ? { ...l, qty: nextQty } : l))
          : [
              ...current,
              {
                key: product.id,
                productId: product.id,
                name: product.name,
                sku: product.sku ?? '',
                category: product.category ?? '',
                unit: product.unit ?? '',
                unitPrice: round2(Number(product.salePrice) || 0),
                unitCost: round2(Number(product.costPrice) || 0),
                qty: roundQty(qty)
              }
            ];
      commit(next);
      touch(product.id);
      if (scanBeep) beep();
      return true;
    },
    [allowNegative, scanBeep, commit, touch, toast]
  );

  /** Agrega un artículo no catalogado (monto libre). */
  const addFreeAmount = useCallback(
    (name: string, amount: number) => {
      const price = round2(amount);
      if (!(price > 0)) return false;
      const key = newId('free-');
      commit([
        ...linesRef.current,
        {
          key,
          productId: null,
          name: name.trim() || FREE_AMOUNT_ITEM_NAME,
          sku: '',
          category: '',
          unit: '',
          unitPrice: price,
          unitCost: 0,
          qty: 1
        }
      ]);
      touch(key);
      if (scanBeep) beep();
      return true;
    },
    [commit, touch, scanBeep]
  );

  const remove = useCallback(
    (key: string) => {
      const next = linesRef.current.filter((l) => l.key !== key);
      commit(next);
      // Ticket vacío: el descuento y el efectivo capturados ya no aplican.
      if (!next.length) {
        setDiscount(null);
        setCashReceived('');
      }
    },
    [commit]
  );

  /** Fija la cantidad de una línea respetando el stock (si no se permite negativo). */
  const setQty = useCallback(
    (key: string, value: number) => {
      const line = linesRef.current.find((l) => l.key === key);
      if (!line) return;
      let qty = roundQty(value);
      if (!allowsDecimalQty(line.unit)) qty = Math.round(qty);
      if (!(qty > 0)) {
        remove(key);
        return;
      }
      if (line.productId && !allowNegative) {
        const stock = productStock(line.productId);
        if (qty > stock) {
          toast.warning(stock > 0 ? `Solo hay ${formatNumber(stock)} disponibles de “${line.name}”.` : `“${line.name}” está agotado.`);
          if (stock <= 0) return;
          qty = stock;
        }
      }
      if (qty === line.qty) return;
      commit(linesRef.current.map((l) => (l.key === key ? { ...l, qty } : l)));
    },
    [allowNegative, productStock, commit, remove, toast]
  );

  const increment = useCallback(
    (key: string, delta: number) => {
      const line = linesRef.current.find((l) => l.key === key);
      if (!line) return;
      const next = roundQty(line.qty + delta);
      if (next <= 0) return;
      setQty(key, next);
      touch(key);
    },
    [setQty, touch]
  );

  const clear = useCallback(() => {
    commit([]);
    setDiscount(null);
    setCustomerName('');
    setPaymentMethod('cash');
    setCashReceived('');
    setHighlight(null);
  }, [commit]);

  const load = useCallback(
    (snap: TicketSnapshot) => {
      commit(snap.lines);
      setDiscount(canDiscount ? snap.discount : null);
      setCustomerName(snap.customerName);
      setPaymentMethod('cash');
      setCashReceived('');
      setHighlight(null);
    },
    [commit, canDiscount]
  );

  const items: SaleItem[] = useMemo(
    () =>
      lines.map((l) => ({
        productId: l.productId,
        name: l.name,
        sku: l.sku,
        category: l.category,
        qty: l.qty,
        unitPrice: l.unitPrice,
        unitCost: l.unitCost,
        total: round2(l.unitPrice * l.qty)
      })),
    [lines]
  );

  const gross = useMemo(() => round2(items.reduce((acc, i) => acc + i.unitPrice * i.qty, 0)), [items]);
  const discountAmount = discountToAmount(discount, gross, maxDiscountPct);

  const totals = useMemo(
    () =>
      computeTotals({
        items,
        discount: discountAmount,
        taxRate: business.taxRate,
        pricesIncludeTax: business.pricesIncludeTax
      }),
    [items, discountAmount, business.taxRate, business.pricesIncludeTax]
  );

  /** Total si se aplicara otro descuento (para la vista previa del modal). */
  const previewTotal = useCallback(
    (amount: number) =>
      computeTotals({ items, discount: amount, taxRate: business.taxRate, pricesIncludeTax: business.pricesIncludeTax }).total,
    [items, business.taxRate, business.pricesIncludeTax]
  );

  const received = paymentMethod === 'cash' ? (cashReceived === '' ? totals.total : round2(cashReceived)) : totals.total;
  const change = round2(received - totals.total);

  const snapshot = useCallback(
    (): TicketSnapshot => ({ lines: linesRef.current, discount, customerName }),
    [discount, customerName]
  );

  return {
    lines,
    items,
    totals,
    gross,
    discount,
    discountAmount,
    maxDiscountPct,
    canDiscount,
    allowNegative,
    customerName,
    paymentMethod,
    cashReceived,
    received,
    change,
    highlight,
    setDiscount,
    setCustomerName,
    setPaymentMethod,
    setCashReceived,
    addProduct,
    addFreeAmount,
    setQty,
    increment,
    remove,
    clear,
    load,
    snapshot,
    previewTotal
  };
}

export type TicketApi = ReturnType<typeof useTicket>;
