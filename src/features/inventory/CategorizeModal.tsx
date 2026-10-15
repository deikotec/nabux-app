/**
 * Organizar categorías con IA: propone una categoría para productos que ya están en el inventario
 * (los que siguen en "General", todos o los seleccionados). Nada cambia hasta que confirmas, y
 * cada propuesta se puede corregir o desmarcar.
 */
import { useMemo, useState } from 'react';
import { Check, Loader2, Sparkles, Tags, TriangleAlert, WandSparkles } from 'lucide-react';
import { Badge, Button, Checkbox, Input, Modal, Pagination, ProgressBar, SearchInput, useToast } from '@/components/ui';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useOnline } from '@/hooks/data';
import { aiConfigured, AiError } from '@/lib/ai';
import { formatNumber } from '@/lib/format';
import { cn, errorMessage, normalize } from '@/lib/utils';
import { logActivity } from '@/services/activity';
import { saveCategories } from '@/services/business';
import { moveProductsToCategory } from '@/features/settings/productBatch';
import type { Product } from '@/types';
import { classifyNames, proposeCategories, type BusinessHints } from './import/aiImport';
import { assignByWords, canonicalCategory, categoryIndex, categoryKey, tidyCategory } from './import/categorize';

type Scope = 'general' | 'all' | 'selected';
type Step = 'pick' | 'working' | 'review' | 'saving';

const PAGE_SIZE = 50;

/** Sin categoría de verdad: vacía o "General". */
export function isUncategorized(p: Pick<Product, 'category'>) {
  const k = normalize(p.category);
  return !k || k === 'general' || k === 'sin categoria' || k === 'otros' || k === 'varios';
}

interface Proposal {
  product: Product;
  /** Categoría propuesta por la IA (o null si no encontró). */
  suggested: string | null;
}

export function CategorizeModal({ onClose, selected = [], initialScope }: { onClose: () => void; selected?: Product[]; initialScope?: Scope }) {
  const { business, businessId, actor, can } = useActiveBusiness();
  const { products, categories } = useCatalog();
  const online = useOnline();
  const toast = useToast();

  const uncategorized = useMemo(() => products.filter(isUncategorized), [products]);
  const [scope, setScope] = useState<Scope>(initialScope ?? (selected.length ? 'selected' : uncategorized.length ? 'general' : 'all'));
  const [step, setStep] = useState<Step>('pick');
  const [status, setStatus] = useState<{ label: string; done?: number; total?: number }>({ label: '' });
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [note, setNote] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const scoped = scope === 'selected' ? selected : scope === 'general' ? uncategorized : products;
  const hints: BusinessHints = {
    businessType: business.businessType,
    currency: business.currency,
    localCurrency: null,
    categories
  };

  const run = async () => {
    if (!scoped.length) return;
    setStep('working');
    setNote(null);
    try {
      setStatus({ label: 'La IA está revisando tus productos y proponiendo categorías…' });
      const rules = await proposeCategories(
        scoped.map((p) => p.name),
        hints
      );
      const byProduct = new Map<string, string>();
      for (const p of scoped) {
        const cat = rules.length ? assignByWords(p.name, rules) : null;
        if (cat) byProduct.set(p.id, cat);
      }
      const rest = scoped.filter((p) => !byProduct.has(p.id));
      const known = [...new Set([...rules.map((r) => r.name), ...categories])].filter((c) => categoryKey(c) !== 'general');
      if (rest.length && known.length) {
        setStatus({ label: `Clasificando ${formatNumber(rest.length)} productos…`, done: 0, total: rest.length });
        const { assigned, pending } = await classifyNames(
          rest.map((p) => p.name),
          known,
          hints,
          (done, total) => setStatus({ label: `Clasificando ${formatNumber(total)} productos…`, done, total })
        );
        for (const p of rest) {
          const cat = assigned.get(p.name.trim());
          if (cat) byProduct.set(p.id, cat);
        }
        if (pending) setNote(`${formatNumber(pending)} productos superan el tope de una pasada: vuelve a ejecutar la organización para ellos.`);
      }
      const index = categoryIndex(categories);
      const list = scoped.map((product) => {
        const s = byProduct.get(product.id);
        return { product, suggested: s ? canonicalCategory(s, index) : null };
      });
      // Por defecto se marcan los que no tenían categoría; recategorizar uno ya clasificado es decisión tuya.
      setChecked(new Set(list.filter((x) => x.suggested && categoryKey(x.suggested) !== categoryKey(x.product.category) && isUncategorized(x.product)).map((x) => x.product.id)));
      setOverrides({});
      setProposals(list);
      setStep('review');
    } catch (e) {
      toast.error(e instanceof AiError ? e.message : errorMessage(e));
      setStep('pick');
    }
  };

  const target = (x: Proposal) => tidyCategory(overrides[x.product.id] ?? x.suggested ?? '');
  const changes = proposals.filter((x) => {
    const t = target(x);
    return t && categoryKey(t) !== categoryKey(x.product.category);
  });
  const toApply = changes.filter((x) => checked.has(x.product.id));
  const known = useMemo(() => new Set(categories.map(categoryKey)), [categories]);
  const newCats = [...new Set(toApply.map(target).filter((t) => !known.has(categoryKey(t))))];
  const noSuggestion = proposals.filter((x) => !target(x)).length;

  const q = normalize(query);
  const shown = q ? changes.filter((x) => normalize(`${x.product.name} ${x.product.category} ${target(x)}`).includes(q)) : changes;
  const pageRows = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const groupCounts = new Map<string, number>();
  for (const x of toApply) groupCounts.set(target(x), (groupCounts.get(target(x)) ?? 0) + 1);
  const groups = [...groupCounts.entries()].sort((a, b) => b[1] - a[1]);

  const toggle = (id: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const apply = async () => {
    if (!toApply.length) return;
    if (!online) {
      toast.error('Necesitas conexión a internet para aplicar los cambios.');
      return;
    }
    setStep('saving');
    const byTarget = new Map<string, Product[]>();
    for (const x of toApply) {
      const t = target(x);
      byTarget.set(t, [...(byTarget.get(t) ?? []), x.product]);
    }
    let done = 0;
    setProgress({ done: 0, total: toApply.length });
    try {
      for (const [cat, list] of byTarget) {
        const base = done;
        await moveProductsToCategory(businessId, list, cat, (d) => setProgress({ done: base + d, total: toApply.length }));
        done += list.length;
      }
      if (newCats.length && can('settings')) {
        await saveCategories(businessId, [...business.categories, ...newCats]).catch((e) => console.warn('No se pudieron registrar las categorías', e));
      }
      logActivity(businessId, actor, {
        type: 'product_update',
        message: `Organizó con IA la categoría de ${toApply.length} producto${toApply.length === 1 ? '' : 's'}${newCats.length ? ` (nuevas: ${newCats.join(', ')})` : ''}`
      });
      toast.success(`${formatNumber(toApply.length)} ${toApply.length === 1 ? 'producto cambió' : 'productos cambiaron'} de categoría.`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
      setStep('review');
    } finally {
      setProgress(null);
    }
  };

  const busy = step === 'working' || step === 'saving';

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!busy}
      size={step === 'review' ? 'xl' : 'md'}
      icon={WandSparkles}
      iconTone="secondary"
      title="Organizar categorías con IA"
      subtitle={step === 'review' ? 'Revisa las propuestas: solo se aplican las marcadas.' : 'La IA propone una categoría para cada producto. Nada cambia hasta que confirmes.'}
      footer={
        step === 'review' ? (
          <>
            <Button variant="ghost" onClick={onClose} className="sm:mr-auto">
              Cancelar
            </Button>
            <Button icon={Check} onClick={apply} disabled={!toApply.length || !online}>
              {toApply.length ? `Aplicar a ${formatNumber(toApply.length)} ${toApply.length === 1 ? 'producto' : 'productos'}` : 'Aplicar'}
            </Button>
          </>
        ) : step === 'pick' ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button icon={Sparkles} onClick={run} disabled={!aiConfigured || !scoped.length}>
              Proponer categorías
            </Button>
          </>
        ) : undefined
      }
    >
      {step === 'pick' && (
        <div className="flex flex-col gap-3">
          {!aiConfigured && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-body-sm text-amber-900">
              <TriangleAlert className="mt-px size-4 shrink-0" />
              La IA no está activada en este negocio. Puedes cambiar la categoría de varios productos a la vez seleccionándolos en el inventario.
            </p>
          )}
          <span className="text-label-lg text-on-surface">¿Qué productos quieres organizar?</span>
          {selected.length > 0 && (
            <Checkbox
              bordered
              checked={scope === 'selected'}
              onChange={() => setScope('selected')}
              label={`Los seleccionados (${formatNumber(selected.length)})`}
            />
          )}
          <Checkbox
            bordered
            checked={scope === 'general'}
            onChange={() => setScope('general')}
            label={`Los que no tienen categoría o están en «General» (${formatNumber(uncategorized.length)})`}
            description="Lo más habitual después de importar o de cargar productos rápido."
          />
          <Checkbox
            bordered
            checked={scope === 'all'}
            onChange={() => setScope('all')}
            label={`Todo el inventario (${formatNumber(products.length)})`}
            description="Propone también para los que ya tienen categoría; esos cambios vienen desmarcados para que decidas."
          />
        </div>
      )}

      {step === 'working' && (
        <div className="flex flex-col items-center gap-4 py-10 text-center" role="status">
          <span className="flex size-14 items-center justify-center rounded-full bg-violet-50 text-violet-600">
            <Sparkles className="size-7 animate-pulse" />
          </span>
          <p className="text-body-lg text-on-surface">{status.label}</p>
          {status.total ? <ProgressBar value={status.done ?? 0} max={status.total} className="w-64" /> : <Loader2 className="size-5 animate-spin text-on-surface-variant" />}
        </div>
      )}

      {step === 'saving' && progress && (
        <div className="flex flex-col items-center gap-4 py-10 text-center" role="status">
          <p className="text-body-lg text-on-surface tnum">
            Actualizando productos… {formatNumber(progress.done)} de {formatNumber(progress.total)}
          </p>
          <ProgressBar value={progress.done} max={progress.total} className="w-64" />
        </div>
      )}

      {step === 'review' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-violet-900">
              <span className="text-headline-md tnum">{formatNumber(changes.length)}</span>
              <span className="text-body-sm">Con propuesta de cambio</span>
            </div>
            <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700">
              <span className="text-headline-md tnum">{formatNumber(proposals.length - changes.length - noSuggestion)}</span>
              <span className="text-body-sm">Ya estaban bien</span>
            </div>
            <div className="flex flex-col rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800">
              <span className="text-headline-md tnum">{formatNumber(noSuggestion)}</span>
              <span className="text-body-sm">Sin propuesta</span>
            </div>
          </div>

          {note && <p className="rounded-lg bg-surface-container-low px-3 py-2 text-body-sm text-on-surface-variant">{note}</p>}

          {groups.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {groups.map(([name, count]) => (
                <span
                  key={name}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-label-md',
                    known.has(categoryKey(name)) ? 'border-slate-200 bg-slate-50 text-on-surface' : 'border-primary/30 bg-primary-fixed/20 text-on-primary-fixed-variant'
                  )}
                >
                  <Tags className="size-3.5 opacity-60" />
                  {name}
                  <span className="rounded-full bg-white/70 px-1.5 text-[11px] tnum">{formatNumber(count)}</span>
                  {!known.has(categoryKey(name)) && <span className="text-[10px] font-bold uppercase tracking-wide text-primary">nueva</span>}
                </span>
              ))}
            </div>
          )}

          {changes.length === 0 ? (
            <p className="py-6 text-center text-body-md text-on-surface-variant">La IA no propone cambios para estos productos.</p>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Checkbox
                  checked={toApply.length === changes.length}
                  onChange={(on) => setChecked(on ? new Set(changes.map((x) => x.product.id)) : new Set())}
                  label={`Marcar todos (${formatNumber(changes.length)})`}
                />
                {changes.length > 10 && <SearchInput value={query} onChange={(v) => {
                      setQuery(v);
                      setPage(1);
                    }} placeholder="Buscar producto o categoría…" inputSize="sm" className="sm:w-64" />}
              </div>
              <div className="max-h-[44vh] overflow-auto rounded-xl border border-slate-200/80 scrollbar-thin">
                <table className="w-full min-w-[600px] border-collapse text-left">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="h-9 w-10 px-3" />
                      <th className="h-9 px-3 text-label-sm text-slate-500 uppercase">Producto</th>
                      <th className="h-9 px-3 text-label-sm text-slate-500 uppercase">Ahora</th>
                      <th className="h-9 px-3 text-label-sm text-slate-500 uppercase">Propuesta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((x) => (
                      <tr key={x.product.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-1.5">
                          <Checkbox checked={checked.has(x.product.id)} onChange={(on) => toggle(x.product.id, on)} />
                        </td>
                        <td className="max-w-64 truncate px-3 py-1.5 text-label-md text-on-surface">{x.product.name}</td>
                        <td className="px-3 py-1.5 text-body-sm text-on-surface-variant">{x.product.category || '—'}</td>
                        <td className="px-3 py-1.5">
                          <Input
                            inputSize="sm"
                            list="categorize-options"
                            value={overrides[x.product.id] ?? x.suggested ?? ''}
                            onChange={(e) => {
                              setOverrides((o) => ({ ...o, [x.product.id]: e.target.value }));
                              toggle(x.product.id, true);
                            }}
                            aria-label={`Categoría para ${x.product.name}`}
                            className="max-w-56"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <datalist id="categorize-options">
                {[...new Set([...categories, ...proposals.map((x) => x.suggested).filter((s): s is string => !!s)])].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {shown.length > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={shown.length} onChange={setPage} label="productos" />}
            </>
          )}

          {newCats.length > 0 && (
            <p className="flex items-start gap-2 text-body-sm text-on-surface-variant">
              <Badge size="xs" tone="primary">
                Nuevas
              </Badge>
              Se crearán: {newCats.join(', ')}.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
