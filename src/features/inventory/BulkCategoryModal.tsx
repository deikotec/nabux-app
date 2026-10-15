import { useState } from 'react';
import { Tags } from 'lucide-react';
import { Button, Field, Input, Modal, Select, useToast } from '@/components/ui';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { formatNumber } from '@/lib/format';
import { errorMessage } from '@/lib/utils';
import { logActivity } from '@/services/activity';
import { saveCategories } from '@/services/business';
import { moveProductsToCategory } from '@/features/settings/productBatch';
import type { Product } from '@/types';
import { canonicalCategory, categoryIndex, tidyCategory } from './import/categorize';

const NEW = '__new__';

/** Cambia la categoría de varios productos a la vez. */
export function BulkCategoryModal({ products, onClose, onDone }: { products: Product[]; onClose: () => void; onDone?: () => void }) {
  const { business, businessId, actor, can } = useActiveBusiness();
  const { categories } = useCatalog();
  const toast = useToast();
  const [target, setTarget] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const finalName = target === NEW ? canonicalCategory(tidyCategory(newName), categoryIndex(categories)) : target;
  const changing = products.filter((p) => p.category !== finalName);

  const apply = async () => {
    if (!finalName || !changing.length) return;
    setBusy(true);
    try {
      await moveProductsToCategory(businessId, changing, finalName, (done, total) => setProgress({ done, total }));
      if (!categories.includes(finalName) && can('settings')) {
        await saveCategories(businessId, [...business.categories, finalName]).catch((e) => console.warn('No se pudo registrar la categoría', e));
      }
      logActivity(businessId, actor, { type: 'product_update', message: `Movió ${changing.length} producto(s) a la categoría “${finalName}”` });
      toast.success(`${formatNumber(changing.length)} ${changing.length === 1 ? 'producto movido' : 'productos movidos'} a “${finalName}”.`);
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!busy}
      size="sm"
      icon={Tags}
      iconTone="secondary"
      title="Cambiar categoría"
      subtitle={`${formatNumber(products.length)} ${products.length === 1 ? 'producto seleccionado' : 'productos seleccionados'}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button icon={Tags} onClick={apply} loading={busy} disabled={!finalName || !changing.length}>
            Mover {formatNumber(changing.length)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nueva categoría" required htmlFor="bulk-cat">
          <Select id="bulk-cat" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Selecciona una categoría" disabled={busy}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={NEW}>+ Nueva categoría…</option>
          </Select>
        </Field>
        {target === NEW && (
          <Field label="Nombre" required htmlFor="bulk-cat-new" hint={finalName && categories.includes(finalName) ? `Ya existe: se usará “${finalName}”.` : undefined}>
            <Input id="bulk-cat-new" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} autoFocus disabled={busy} />
          </Field>
        )}
        {progress && (
          <p className="text-body-sm text-on-surface-variant tnum">
            Actualizando… {formatNumber(progress.done)} de {formatNumber(progress.total)}
          </p>
        )}
      </div>
    </Modal>
  );
}
