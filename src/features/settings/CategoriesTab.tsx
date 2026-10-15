import { useMemo, useState } from 'react';
import { ChartColumn, FolderInput, Lock, Pencil, Plus, Tag, Tags, Trash2, WandSparkles } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { BarList } from '@/components/charts';
import { CategorizeModal, isUncategorized } from '@/features/inventory/CategorizeModal';
import { aiConfigured } from '@/lib/ai';
import { formatNumber } from '@/lib/format';
import { errorMessage, normalize } from '@/lib/utils';
import { logActivity } from '@/services/activity';
import { saveCategories } from '@/services/business';
import type { Product } from '@/types';
import { Badge, Button, EmptyState, Field, IconButton, Input, Modal, SearchInput, Select, useConfirm, useToast } from '@/components/ui';
import { moveProductsToCategory } from './productBatch';
import { Callout, SettingsCard } from './SettingsUI';

const NAME_MAX = 40;

interface CategoryRow {
  name: string;
  /** Está en la lista configurada del negocio (si no, solo aparece en productos). */
  registered: boolean;
  products: Product[];
  activeCount: number;
}

export function CategoriesTab() {
  const { business, businessId, actor, can } = useActiveBusiness();
  const { products, loading } = useCatalog();
  const toast = useToast();
  const { confirm, prompt } = useConfirm();
  const canInventory = can('inventory');

  const [newName, setNewName] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  const [organizing, setOrganizing] = useState(false);

  const registered = business.categories;

  const rows = useMemo<CategoryRow[]>(() => {
    const byCat = new Map<string, Product[]>();
    for (const p of products) {
      const c = (p.category ?? '').trim();
      if (!c) continue;
      const list = byCat.get(c) ?? [];
      list.push(p);
      byCat.set(c, list);
    }
    const names = new Set<string>([...registered, ...byCat.keys()]);
    return Array.from(names)
      .map((name) => {
        const list = byCat.get(name) ?? [];
        return { name, registered: registered.includes(name), products: list, activeCount: list.filter((p) => p.active !== false).length };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [products, registered]);

  const uncategorized = useMemo(() => products.filter((p) => !(p.category ?? '').trim()).length, [products]);
  const inGeneral = useMemo(() => products.filter(isUncategorized).length, [products]);
  const visible = query ? rows.filter((r) => normalize(r.name).includes(normalize(query))) : rows;
  const orphanCount = rows.filter((r) => !r.registered).length;

  const exists = (name: string, except?: string) => rows.find((r) => r.name !== except && normalize(r.name) === normalize(name));

  const persistList = async (next: string[], message: string) => {
    await saveCategories(businessId, next);
    logActivity(businessId, actor, { type: 'settings_update', message });
  };

  const add = async () => {
    const name = newName.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (name.length > NAME_MAX) return toast.error(`Máximo ${NAME_MAX} caracteres.`);
    const dup = exists(name);
    if (dup?.registered) return toast.warning(`Ya existe la categoría “${dup.name}”.`);
    setBusy('__add');
    try {
      await persistList([...registered, dup ? dup.name : name], `Agregó la categoría “${dup ? dup.name : name}”`);
      setNewName('');
      toast.success(`Categoría “${dup ? dup.name : name}” agregada`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const register = async (row: CategoryRow) => {
    setBusy(row.name);
    try {
      await persistList([...registered, row.name], `Registró la categoría “${row.name}”`);
      toast.success(`“${row.name}” ahora está en tu lista de categorías`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const runMove = async (list: Product[], target: string) => {
    setProgress({ done: 0, total: list.length });
    try {
      await moveProductsToCategory(businessId, list, target, (done, total) => setProgress({ done, total }));
    } finally {
      setProgress(null);
    }
  };

  const rename = async (row: CategoryRow) => {
    if (row.products.length > 0 && !canInventory) {
      toast.warning('Esta categoría tiene productos. Para renombrarla necesitas el permiso “Gestionar inventario”.');
      return;
    }
    const input = await prompt({
      title: `Renombrar “${row.name}”`,
      message:
        row.products.length > 0
          ? `También se actualizarán ${formatNumber(row.products.length)} producto(s) que usan esta categoría.`
          : 'La categoría no tiene productos todavía.',
      inputLabel: 'Nuevo nombre',
      defaultValue: row.name,
      required: true,
      confirmLabel: 'Renombrar',
      tone: 'primary'
    });
    if (input === null) return;
    const name = input.trim().replace(/\s+/g, ' ');
    if (!name || name === row.name) return;
    if (name.length > NAME_MAX) return toast.error(`Máximo ${NAME_MAX} caracteres.`);

    const target = exists(name, row.name);
    if (target) {
      const ok = await confirm({
        title: 'La categoría ya existe',
        message: `Ya tienes “${target.name}”. ¿Quieres combinar “${row.name}” con ella? Sus productos pasarán a “${target.name}”.`,
        confirmLabel: 'Combinar',
        tone: 'primary'
      });
      if (!ok) return;
    }
    const finalName = target ? target.name : name;

    setBusy(row.name);
    try {
      if (row.products.length) await runMove(row.products, finalName);
      const next = target
        ? registered.filter((c) => c !== row.name).concat(target.registered ? [] : [finalName])
        : row.registered
          ? registered.map((c) => (c === row.name ? finalName : c))
          : [...registered, finalName];
      await persistList(next, target ? `Combinó la categoría “${row.name}” con “${finalName}”` : `Renombró la categoría “${row.name}” a “${finalName}”`);
      toast.success(target ? `Categorías combinadas en “${finalName}”` : `Categoría renombrada a “${finalName}”`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (row: CategoryRow) => {
    if (row.products.length > 0) {
      if (!canInventory) {
        toast.warning('Esta categoría tiene productos. Para moverlos y eliminarla necesitas el permiso “Gestionar inventario”.');
        return;
      }
      setDeleting(row);
      return;
    }
    const ok = await confirm({ title: `Eliminar “${row.name}”`, message: 'La categoría no tiene productos. Se quitará de tu lista.', confirmLabel: 'Eliminar' });
    if (!ok) return;
    setBusy(row.name);
    try {
      await persistList(
        registered.filter((c) => c !== row.name),
        `Eliminó la categoría “${row.name}”`
      );
      toast.success(`Categoría “${row.name}” eliminada`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const moveAndDelete = async (row: CategoryRow, target: string) => {
    setBusy(row.name);
    try {
      await runMove(row.products, target);
      const next = registered.filter((c) => c !== row.name);
      if (!next.includes(target)) next.push(target);
      await persistList(next, `Eliminó la categoría “${row.name}” y movió ${row.products.length} producto(s) a “${target}”`);
      toast.success(`${formatNumber(row.products.length)} producto(s) movidos a “${target}” y categoría eliminada`);
      setDeleting(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const distribution = useMemo(
    () =>
      rows
        .filter((r) => r.products.length > 0)
        .sort((a, b) => b.products.length - a.products.length)
        .slice(0, 6)
        .map((r) => ({ label: r.name, value: r.products.length, display: formatNumber(r.products.length) })),
    [rows]
  );

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      <div className="lg:col-span-8">
        <SettingsCard
          icon={Tags}
          title="Categorías de productos"
          subtitle="Organizan tu catálogo, los filtros del POS y los reportes por categoría."
          badge={<Badge tone="primary">{formatNumber(rows.length)} en total</Badge>}
        >
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nueva categoría, ej. Bebidas"
              maxLength={NAME_MAX}
              icon={Tag}
              className="flex-1"
              aria-label="Nombre de la nueva categoría"
            />
            <Button type="submit" icon={Plus} loading={busy === '__add'} disabled={!newName.trim() || !!busy}>
              Agregar
            </Button>
          </form>

          {rows.length > 8 && <SearchInput value={query} onChange={setQuery} placeholder="Buscar categoría…" inputSize="sm" />}

          {progress && (
            <Callout title={`Actualizando productos… ${formatNumber(progress.done)} de ${formatNumber(progress.total)}`}>
              No cierres esta ventana hasta que termine.
            </Callout>
          )}

          {rows.length === 0 && !loading ? (
            <EmptyState icon={Tags} title="Aún no tienes categorías" description="Agrega tu primera categoría para organizar tus productos." className="py-8" />
          ) : visible.length === 0 ? (
            <p className="py-6 text-center text-body-md text-on-surface-variant">No hay categorías que coincidan con “{query}”.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80">
              {visible.map((row) => (
                <li key={row.name} className="flex items-center gap-3 bg-white px-3 py-2.5 transition-colors hover:bg-slate-50/80 sm:px-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                    <Tag className="size-4" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-label-lg text-on-surface">{row.name}</span>
                      {!row.registered && (
                        <Badge tone="warning" size="xs">
                          Solo en productos
                        </Badge>
                      )}
                    </span>
                    <span className="text-body-sm text-on-surface-variant tnum">
                      {row.products.length === 0
                        ? 'Sin productos'
                        : `${formatNumber(row.products.length)} producto${row.products.length === 1 ? '' : 's'}${
                            row.activeCount !== row.products.length ? ` · ${formatNumber(row.activeCount)} activo${row.activeCount === 1 ? '' : 's'}` : ''
                          }`}
                    </span>
                    {!row.registered && (
                      <button
                        type="button"
                        onClick={() => register(row)}
                        disabled={!!busy}
                        className="self-start text-body-sm font-semibold text-secondary hover:underline disabled:opacity-50 sm:hidden"
                      >
                        Registrar en mi lista
                      </button>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!row.registered && (
                      <span className="hidden sm:block">
                        <Button size="sm" variant="tonal" onClick={() => register(row)} disabled={!!busy}>
                          Registrar
                        </Button>
                      </span>
                    )}
                    <IconButton icon={Pencil} label={`Renombrar ${row.name}`} size="icon-sm" onClick={() => rename(row)} disabled={!!busy} />
                    <IconButton
                      icon={Trash2}
                      label={`Eliminar ${row.name}`}
                      size="icon-sm"
                      onClick={() => remove(row)}
                      disabled={!!busy}
                      className="hover:bg-red-50 hover:text-red-700"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {uncategorized > 0 && (
            <p className="text-body-sm text-on-surface-variant">
              <b className="tnum">{formatNumber(uncategorized)}</b> producto(s) no tienen categoría asignada.
            </p>
          )}
        </SettingsCard>
      </div>

      <div className="flex flex-col gap-5 lg:col-span-4 lg:gap-6">
        <SettingsCard icon={ChartColumn} iconTone="secondary" title="Distribución" subtitle="Categorías con más productos.">
          {distribution.length ? (
            <BarList items={distribution} />
          ) : (
            <p className="text-body-sm text-on-surface-variant">Cuando asignes productos a tus categorías verás aquí su distribución.</p>
          )}
        </SettingsCard>

        {canInventory && aiConfigured && products.length > 0 && (
          <SettingsCard icon={WandSparkles} iconTone="secondary" title="Organizar con IA" subtitle="Propone una categoría para cada producto; tú revisas y apruebas.">
            <p className="text-body-sm text-on-surface-variant">
              {inGeneral > 0 ? (
                <>
                  Tienes <b className="text-on-surface tnum">{formatNumber(inGeneral)}</b> producto(s) sin categoría o en «General».
                </>
              ) : (
                'Todos tus productos tienen categoría. También puedes pedirle a la IA que revise el catálogo completo.'
              )}
            </p>
            <Button variant="tonal" icon={WandSparkles} onClick={() => setOrganizing(true)} className="self-start">
              Proponer categorías
            </Button>
          </SettingsCard>
        )}

        {orphanCount > 0 && (
          <Callout tone="warning" title={`${orphanCount} categoría(s) solo existen en productos`}>
            Se crearon desde el inventario o una importación. Regístralas para que aparezcan siempre en tu lista, aunque se queden sin productos.
          </Callout>
        )}

        {!canInventory && (
          <Callout icon={Lock} title="Permiso limitado">
            Puedes agregar categorías vacías. Renombrar o eliminar categorías con productos requiere el permiso “Gestionar inventario”.
          </Callout>
        )}

        <Callout title="¿Cómo funciona?">
          Al renombrar una categoría se actualizan todos sus productos. Para eliminar una categoría con productos, primero eliges a cuál moverlos.
        </Callout>
      </div>

      {organizing && <CategorizeModal onClose={() => setOrganizing(false)} />}

      <DeleteCategoryModal
        key={deleting?.name ?? 'none'}
        row={deleting}
        options={rows.filter((r) => r.name !== deleting?.name).map((r) => r.name)}
        busy={!!busy}
        progress={progress}
        onClose={() => !busy && setDeleting(null)}
        onConfirm={moveAndDelete}
      />
    </div>
  );
}

function DeleteCategoryModal({
  row,
  options,
  busy,
  progress,
  onClose,
  onConfirm
}: {
  row: CategoryRow | null;
  options: string[];
  busy: boolean;
  progress: { done: number; total: number } | null;
  onClose: () => void;
  onConfirm: (row: CategoryRow, target: string) => void;
}) {
  const [target, setTarget] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const NEW = '__new__';
  const finalTarget = target === NEW ? newTarget.trim().replace(/\s+/g, ' ') : target;
  const invalidNew = target === NEW && (!!options.find((o) => normalize(o) === normalize(finalTarget)) || finalTarget.length > NAME_MAX);

  return (
    <Modal
      open={!!row}
      onClose={onClose}
      dismissible={!busy}
      title={row ? `Eliminar “${row.name}”` : ''}
      subtitle={row ? `Tiene ${formatNumber(row.products.length)} producto(s). Elige a qué categoría moverlos antes de eliminarla.` : undefined}
      icon={FolderInput}
      iconTone="warning"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="danger" icon={Trash2} loading={busy} disabled={!row || !finalTarget || invalidNew} onClick={() => row && onConfirm(row, finalTarget)}>
            Mover y eliminar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Mover productos a" required htmlFor="cat-target">
          <Select id="cat-target" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Selecciona una categoría" disabled={busy}>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
            <option value={NEW}>+ Nueva categoría…</option>
          </Select>
        </Field>
        {target === NEW && (
          <Field label="Nombre de la nueva categoría" required htmlFor="cat-new" error={invalidNew ? 'Ese nombre ya existe o es muy largo; elígelo de la lista.' : undefined}>
            <Input id="cat-new" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} maxLength={NAME_MAX} autoFocus disabled={busy} invalid={invalidNew} />
          </Field>
        )}
        {progress && (
          <p className="text-body-sm text-on-surface-variant tnum">
            Actualizando productos… {formatNumber(progress.done)} de {formatNumber(progress.total)}
          </p>
        )}
      </div>
    </Modal>
  );
}
