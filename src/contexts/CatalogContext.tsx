import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';
import { refs } from '@/services/refs';
import { normalize, stockStatus } from '@/lib/utils';
import type { Product, Supplier } from '@/types';
import { useBusiness } from './BusinessContext';

interface CatalogContextValue {
  /** Todos los productos del negocio (tiempo real, también sin conexión). */
  products: Product[];
  suppliers: Supplier[];
  loading: boolean;
  productsById: Map<string, Product>;
  /** Busca por código de barras o SKU exacto (para escáner). */
  findByCode: (code: string) => Product | undefined;
  /** Productos activos con stock en o por debajo del mínimo (incluye agotados). */
  lowStock: Product[];
  outOfStock: Product[];
  /** Categorías configuradas + las que aparecen en productos. */
  categories: string[];
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { businessId, business, status } = useBusiness();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setProducts([]);
    setSuppliers([]);
    setLoading(true);
    if (!businessId || status !== 'ready') return;
    const unsubP = onSnapshot(
      query(refs.products(businessId), orderBy('name')),
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as Omit<Product, 'id'>) })));
        setLoading(false);
      },
      (err) => {
        console.error('Error leyendo productos', err);
        setLoading(false);
      }
    );
    const unsubS = onSnapshot(
      query(refs.suppliers(businessId), orderBy('name')),
      (snap) => setSuppliers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Supplier, 'id'>) }))),
      (err) => console.error('Error leyendo proveedores', err)
    );
    return () => {
      unsubP();
      unsubS();
    };
  }, [businessId, status]);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const codeIndex = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) {
      if (p.barcode) m.set(normalize(p.barcode), p);
      if (p.sku) m.set(normalize(p.sku), p);
    }
    return m;
  }, [products]);

  const findByCode = useCallback((code: string) => codeIndex.get(normalize(code)), [codeIndex]);

  const { lowStock, outOfStock } = useMemo(() => {
    const active = products.filter((p) => p.active !== false);
    return {
      lowStock: active.filter((p) => stockStatus(p) !== 'ok').sort((a, b) => a.stock - a.minStock - (b.stock - b.minStock)),
      outOfStock: active.filter((p) => stockStatus(p) === 'out')
    };
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set<string>(business?.categories ?? []);
    products.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [business?.categories, products]);

  const value = useMemo(
    () => ({ products, suppliers, loading, productsById, findByCode, lowStock, outOfStock, categories }),
    [products, suppliers, loading, productsById, findByCode, lowStock, outOfStock, categories]
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog debe usarse dentro de <CatalogProvider>');
  return ctx;
}
