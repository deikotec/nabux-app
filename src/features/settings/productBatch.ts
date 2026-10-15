import { serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { buildSearchText } from '@/lib/utils';
import { refs } from '@/services/refs';
import type { Product } from '@/types';

/** Firestore admite 500 escrituras por lote; dejamos margen. */
const CHUNK_SIZE = 400;

type ProductPatch = Partial<Pick<Product, 'category' | 'supplierId' | 'supplierName' | 'searchText'>>;

/**
 * Actualiza varios productos en lotes de 400 escrituras (requiere permiso "inventory" según firestore.rules).
 * Cada lote es atómico; si uno falla, los anteriores ya quedaron aplicados.
 */
export async function batchUpdateProducts(
  bid: string,
  updates: { id: string; patch: ProductPatch }[],
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const total = updates.length;
  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const { id, patch } of updates.slice(i, i + CHUNK_SIZE)) {
      batch.update(refs.product(bid, id), { ...patch, updatedAt: serverTimestamp() });
    }
    await batch.commit();
    onProgress?.(Math.min(i + CHUNK_SIZE, total), total);
  }
  return total;
}

/** Cambia la categoría de los productos (renombrar, combinar o vaciar una categoría). */
export function moveProductsToCategory(
  bid: string,
  products: Product[],
  category: string,
  onProgress?: (done: number, total: number) => void
) {
  return batchUpdateProducts(
    bid,
    products.map((p) => ({
      id: p.id,
      // El texto de búsqueda incluye la categoría: se recalcula para que el buscador siga funcionando.
      patch: { category, searchText: buildSearchText({ ...p, category }) }
    })),
    onProgress
  );
}

/** Asigna (o quita, con null) el proveedor de varios productos. */
export function setProductsSupplier(bid: string, products: Product[], supplier: { id: string; name: string } | null) {
  return batchUpdateProducts(
    bid,
    products.map((p) => ({ id: p.id, patch: { supplierId: supplier?.id ?? null, supplierName: supplier?.name ?? null } }))
  );
}
