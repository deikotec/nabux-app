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
export function uploadProductImage(bid: string, productId: string, file: Blob) {
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

/* ------------------------------------------------------------------ */
/* Importación (Excel, CSV o fotos)                                    */
/* ------------------------------------------------------------------ */

/** Producto nuevo de una importación. `image` es una foto a subir (incrustada en el Excel o tomada). */
export interface ImportCreate {
  kind: 'create';
  input: ProductInput;
  image?: Blob | null;
}

/** Cambios sobre un producto existente: solo los campos que traía el archivo. */
export interface ImportUpdate {
  kind: 'update';
  product: Product;
  patch: Partial<ProductInput>;
  /** Cambio de stock con signo. */
  stockDelta?: number;
  /** "add" = entrada de mercancía; "set" = ajuste por conteo. */
  stockMode?: 'add' | 'set';
  image?: Blob | null;
}

export type ImportItem = ImportCreate | ImportUpdate;

export interface ImportProgress {
  /** Productos ya guardados. */
  done: number;
  total: number;
  /** Fotos subidas / por subir en el lote actual. */
  uploading?: { done: number; total: number };
}

export interface ImportResult {
  created: number;
  updated: number;
  /** Nombres de productos cuya foto no se pudo subir (se guardaron sin ella). */
  imageFailures: string[];
  /** Se canceló a mitad: lo guardado hasta ese momento se queda. */
  cancelled: boolean;
}

/** Productos por lote: con su movimiento de kardex son ≤ 2 escrituras cada uno (límite de 500 por lote). */
const IMPORT_CHUNK = 150;
const UPLOAD_CONCURRENCY = 4;

function cleanPatch(patch: Partial<ProductInput>) {
  const out: Record<string, unknown> = {};
  if (patch.name !== undefined) out.name = patch.name.trim();
  if (patch.barcode !== undefined) out.barcode = (patch.barcode ?? '').trim();
  if (patch.category !== undefined) out.category = patch.category.trim() || 'General';
  if (patch.brand !== undefined) out.brand = (patch.brand ?? '').trim();
  if (patch.unit !== undefined) out.unit = patch.unit || 'Unidad';
  if (patch.costPrice !== undefined) out.costPrice = round2(Number(patch.costPrice) || 0);
  if (patch.salePrice !== undefined) out.salePrice = round2(Number(patch.salePrice) || 0);
  if (patch.minStock !== undefined) out.minStock = Math.max(0, Number(patch.minStock) || 0);
  if (patch.location !== undefined) out.location = (patch.location ?? '').trim();
  if (patch.supplierId !== undefined) out.supplierId = patch.supplierId || null;
  if (patch.supplierName !== undefined) out.supplierName = patch.supplierName || null;
  if (patch.taxExempt !== undefined) out.taxExempt = !!patch.taxExempt;
  if (patch.imageUrl !== undefined) out.imageUrl = patch.imageUrl ?? null;
  if (patch.imagePath !== undefined) out.imagePath = patch.imagePath ?? null;
  return out;
}

/** Ejecuta `fn` sobre cada elemento con como mucho `limit` a la vez. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}

/**
 * Guarda una importación por lotes: en cada lote sube primero las fotos y luego escribe los
 * productos (con su movimiento de kardex) en un solo batch. Si se cancela, lo guardado hasta ese
 * lote se queda — que es lo que espera quien cancela — y nada queda a medias dentro de un lote.
 */
export async function importCatalog(
  bid: string,
  actor: Actor,
  items: ImportItem[],
  opts: { source: string; onProgress?: (p: ImportProgress) => void; isCancelled?: () => boolean }
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, imageFailures: [], cancelled: false };
  const total = items.length;
  const replacedImages: string[] = [];
  const reason = `Importación (${opts.source})`;

  for (let i = 0; i < total; i += IMPORT_CHUNK) {
    if (opts.isCancelled?.()) {
      result.cancelled = true;
      break;
    }
    const chunk = items.slice(i, i + IMPORT_CHUNK).map((item) => ({
      item,
      id: item.kind === 'create' ? newProductId(bid) : item.product.id,
      uploaded: null as { url: string; path: string } | null
    }));

    // 1. Fotos del lote.
    const withImage = chunk.filter((c) => c.item.image);
    if (withImage.length) {
      let up = 0;
      opts.onProgress?.({ done: i, total, uploading: { done: 0, total: withImage.length } });
      await pool(withImage, UPLOAD_CONCURRENCY, async (c) => {
        try {
          c.uploaded = await uploadProductImage(bid, c.id, c.item.image!);
        } catch (e) {
          console.warn('No se pudo subir la foto importada', e);
          result.imageFailures.push(c.item.kind === 'create' ? c.item.input.name : c.item.product.name);
        }
        opts.onProgress?.({ done: i, total, uploading: { done: ++up, total: withImage.length } });
      });
    }

    // 2. Productos del lote, en un solo batch.
    const batch = writeBatch(db);
    for (const { item, id, uploaded } of chunk) {
      if (item.kind === 'create') {
        const data = cleanInput({ ...item.input, ...(uploaded ? { imageUrl: uploaded.url, imagePath: uploaded.path } : {}) });
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
              reason,
              unitCost: data.costPrice
            })
          );
        }
      } else {
        const prev = item.product;
        const patch = cleanPatch({ ...item.patch, ...(uploaded ? { imageUrl: uploaded.url, imagePath: uploaded.path } : {}) });
        const merged = { ...prev, ...patch } as Product;
        const delta = Number(item.stockDelta) || 0;
        batch.update(refs.product(bid, id), {
          ...patch,
          searchText: buildSearchText(merged),
          updatedAt: serverTimestamp(),
          // Incremento: no pisa ventas hechas mientras se revisaba la importación.
          ...(delta ? { stock: increment(delta) } : {}),
          ...(delta > 0 ? { lastRestockAt: serverTimestamp() } : {})
        });
        if (delta) {
          const type: MovementType = item.stockMode === 'add' ? 'in' : 'adjust';
          batch.set(
            doc(refs.movements(bid)),
            movementDoc({ id, name: merged.name, sku: merged.sku }, actor, type, delta, {
              stockAfter: (Number(prev.stock) || 0) + delta,
              reason,
              unitCost: type === 'in' ? ((patch.costPrice as number | undefined) ?? prev.costPrice ?? null) : null
            })
          );
        }
        // Foto nueva (subida o enlace): la anterior de Storage ya no se usa.
        if (prev.imagePath && (uploaded || item.patch.imageUrl !== undefined)) replacedImages.push(prev.imagePath);
      }
    }
    await batch.commit();
    for (const { item } of chunk) {
      if (item.kind === 'create') result.created++;
      else result.updated++;
    }
    opts.onProgress?.({ done: Math.min(i + IMPORT_CHUNK, total), total });
  }

  replacedImages.forEach((path) => deleteImage(path));
  if (result.created || result.updated) {
    const parts = [
      result.created ? `${result.created} producto${result.created === 1 ? '' : 's'} nuevo${result.created === 1 ? '' : 's'}` : '',
      result.updated ? `actualizó ${result.updated}` : ''
    ].filter(Boolean);
    logActivity(bid, actor, {
      type: result.created ? 'product_create' : 'product_update',
      message: `Importó ${parts.join(' y ')} desde ${opts.source}${result.cancelled ? ' (cancelada a mitad)' : ''}`
    });
  }
  return result;
}
