import { doc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { deleteImage, uploadImage } from '@/lib/image';
import { buildSearchText, round2 } from '@/lib/utils';
import type { MovementType, Product, ProductInput } from '@/types';
import { logActivity, logActivityIn } from './activity';
import { refs, type Actor } from './refs';

function cleanInput(input: ProductInput) {
  const data = {
    name: input.name.trim(),
    sku: input.sku.trim().toUpperCase(),
    barcode: (input.barcode ?? '').trim(),
    category: input.category.trim() || 'General',
    brand: (input.brand ?? '').trim(),
    unit: input.unit || 'Unidad',
    costPrice: round2(Number(input.costPrice) || 0),
    salePrice: round2(Number(input.salePrice) || 0),
    stock: Number(input.stock) || 0,
    minStock: Math.max(0, Number(input.minStock) || 0),
    location: (input.location ?? '').trim(),
    supplierId: input.supplierId || null,
    supplierName: input.supplierName || null,
    imageUrl: input.imageUrl ?? null,
    imagePath: input.imagePath ?? null,
    active: input.active !== false,
    taxExempt: !!input.taxExempt
  };
  return { ...data, searchText: buildSearchText(data) };
}

function movementDoc(
  product: Pick<Product, 'id' | 'name' | 'sku'>,
  actor: Actor,
  type: MovementType,
  qty: number,
  extra: { stockAfter?: number | null; reason?: string; refId?: string | null; unitCost?: number | null } = {}
) {
  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku ?? '',
    type,
    qty,
    stockAfter: extra.stockAfter ?? null,
    reason: extra.reason ?? '',
    refId: extra.refId ?? null,
    unitCost: extra.unitCost ?? null,
    userId: actor.uid,
    userName: actor.name,
    createdAt: serverTimestamp()
  };
}

export function newProductId(bid: string) {
  return doc(refs.products(bid)).id;
}

/** Sube la foto de un producto a Storage: businesses/{bid}/products/{pid}/… */
export function uploadProductImage(bid: string, productId: string, file: File) {
  return uploadImage(file, `businesses/${bid}/products/${productId}`, 800);
}

export async function createProduct(bid: string, actor: Actor, input: ProductInput, productId = newProductId(bid)) {
  const data = cleanInput(input);
  const batch = writeBatch(db);
  batch.set(refs.product(bid, productId), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastRestockAt: data.stock > 0 ? serverTimestamp() : null
  });
  if (data.stock !== 0) {
    batch.set(
      doc(refs.movements(bid)),
      movementDoc({ id: productId, name: data.name, sku: data.sku }, actor, 'initial', data.stock, {
        stockAfter: data.stock,
        reason: 'Stock inicial',
        unitCost: data.costPrice
      })
    );
  }
  logActivityIn(batch, bid, actor, { type: 'product_create', message: `Registró el producto "${data.name}"`, refId: productId });
  await batch.commit();
  return productId;
}

export async function updateProduct(bid: string, actor: Actor, previous: Product, input: ProductInput) {
  const data = cleanInput(input);
  const delta = data.stock - (Number(previous.stock) || 0);
  const batch = writeBatch(db);
  batch.update(refs.product(bid, previous.id), {
    ...data,
    // El stock se actualiza con increment para no pisar ventas simultáneas.
    stock: increment(delta),
    updatedAt: serverTimestamp(),
    ...(delta > 0 ? { lastRestockAt: serverTimestamp() } : {})
  });
  if (delta !== 0) {
    batch.set(
      doc(refs.movements(bid)),
      movementDoc({ id: previous.id, name: data.name, sku: data.sku }, actor, 'adjust', delta, {
        stockAfter: data.stock,
        reason: 'Edición de ficha de producto'
      })
    );
  }
  logActivityIn(batch, bid, actor, { type: 'product_update', message: `Editó el producto "${data.name}"`, refId: previous.id });
  await batch.commit();
  if (previous.imagePath && previous.imagePath !== data.imagePath) deleteImage(previous.imagePath);
}

export async function deleteProduct(bid: string, actor: Actor, product: Product) {
  const batch = writeBatch(db);
  batch.delete(refs.product(bid, product.id));
  logActivityIn(batch, bid, actor, { type: 'product_delete', message: `Eliminó el producto "${product.name}" (${product.sku})`, refId: product.id });
  await batch.commit();
  deleteImage(product.imagePath);
}

export async function setProductActive(bid: string, product: Product, active: boolean) {
  const batch = writeBatch(db);
  batch.update(refs.product(bid, product.id), { active, updatedAt: serverTimestamp() });
  await batch.commit();
}

export interface StockAdjustInput {
  /** Cambio con signo: +10 entrada, -3 salida/merma. */
  delta: number;
  type: Extract<MovementType, 'in' | 'out' | 'adjust'>;
  reason: string;
  /** En entradas de mercancía: costo unitario actualizado (opcional). */
  unitCost?: number | null;
}

/** Entrada de mercancía, salida/merma o ajuste por conteo físico. */
export async function adjustStock(bid: string, actor: Actor, product: Product, input: StockAdjustInput) {
  const delta = Number(input.delta) || 0;
  if (!delta) return;
  const stockAfter = (Number(product.stock) || 0) + delta;
  const batch = writeBatch(db);
  const patch: Record<string, unknown> = { stock: increment(delta), updatedAt: serverTimestamp() };
  if (input.type === 'in') patch.lastRestockAt = serverTimestamp();
  if (input.type === 'in' && input.unitCost != null && input.unitCost > 0) patch.costPrice = round2(input.unitCost);
  batch.update(refs.product(bid, product.id), patch);
  batch.set(
    doc(refs.movements(bid)),
    movementDoc(product, actor, input.type, delta, { stockAfter, reason: input.reason, unitCost: input.unitCost ?? null })
  );
  const verb = input.type === 'in' ? 'Entrada de' : input.type === 'out' ? 'Salida de' : 'Ajuste de';
  logActivityIn(batch, bid, actor, {
    type: input.type === 'in' ? 'stock_in' : 'stock_adjust',
    message: `${verb} ${Math.abs(delta)} ${product.unit || 'uds'} · ${product.name}${input.reason ? ` (${input.reason})` : ''}`,
    refId: product.id
  });
  await batch.commit();
}

/** Ajusta el stock al valor contado físicamente. */
export function setStockCount(bid: string, actor: Actor, product: Product, counted: number, reason = 'Conteo físico') {
  return adjustStock(bid, actor, product, { delta: counted - (Number(product.stock) || 0), type: 'adjust', reason });
}

export interface BulkPriceInput {
  /** Porcentaje a aplicar (ej. 10 = +10 %, -5 = -5 %). */
  pct: number;
  /** Qué precio ajustar. */
  field: 'salePrice' | 'costPrice' | 'both';
  /** Redondeo del precio resultante (0.01, 0.05, 0.1, 0.5, 1). */
  rounding?: number;
}

/**
 * Ajuste masivo de precios (ej. por inflación o cambio de proveedor). Escribe en lotes de 400
 * y deja un registro en la bitácora.
 */
export async function bulkAdjustPrices(bid: string, actor: Actor, products: Product[], input: BulkPriceInput) {
  const factor = 1 + (Number(input.pct) || 0) / 100;
  if (factor <= 0 || !products.length) return 0;
  const step = input.rounding && input.rounding > 0 ? input.rounding : 0.01;
  const round = (n: number) => round2(Math.max(0, Math.round((n * factor) / step) * step));
  const batches = [];
  for (let i = 0; i < products.length; i += 400) {
    const batch = writeBatch(db);
    for (const p of products.slice(i, i + 400)) {
      const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (input.field === 'salePrice' || input.field === 'both') patch.salePrice = round(Number(p.salePrice) || 0);
      if (input.field === 'costPrice' || input.field === 'both') patch.costPrice = round(Number(p.costPrice) || 0);
      batch.update(refs.product(bid, p.id), patch);
    }
    batches.push(batch);
  }
  // Todos los lotes se envían a la vez: sin conexión quedan en cola completos.
  await Promise.all(batches.map((b) => b.commit()));
  const what = input.field === 'both' ? 'precio y costo' : input.field === 'salePrice' ? 'precio de venta' : 'costo';
  logActivity(bid, actor, {
    type: 'product_update',
    message: `Ajustó el ${what} de ${products.length} productos en ${input.pct > 0 ? '+' : ''}${input.pct}%`
  });
  return products.length;
}

/** Importación masiva (CSV). Escribe en lotes de 200 productos (en paralelo). */
export async function importProducts(bid: string, actor: Actor, items: ProductInput[]) {
  const chunkSize = 200;
  const batches = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const input of items.slice(i, i + chunkSize)) {
      const id = newProductId(bid);
      const data = cleanInput(input);
      batch.set(refs.product(bid, id), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastRestockAt: data.stock > 0 ? serverTimestamp() : null
      });
      if (data.stock !== 0) {
        batch.set(
          doc(refs.movements(bid)),
          movementDoc({ id, name: data.name, sku: data.sku }, actor, 'initial', data.stock, {
            stockAfter: data.stock,
            reason: 'Importación CSV',
            unitCost: data.costPrice
          })
        );
      }
    }
    batches.push(batch);
  }
  await Promise.all(batches.map((b) => b.commit()));
  logActivity(bid, actor, { type: 'product_create', message: `Importó ${items.length} productos desde CSV` });
}
