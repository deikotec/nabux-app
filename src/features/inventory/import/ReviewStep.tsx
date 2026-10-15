import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Calculator, Check, Columns3, Eye, EyeOff, Info, Loader2, Pencil, RotateCcw, Sparkles, Tag, TriangleAlert, WandSparkles } from 'lucide-react';
import { Badge, Button, Checkbox, Input, NumberInput, Pagination, SearchInput, Segmented } from '@/components/ui';
import { UNITS } from '@/config/app';
import { formatNumber } from '@/lib/format';
import { cn, normalize } from '@/lib/utils';
import { cellText } from './numbers';
import { Thumb } from './Thumb';
import type { ValidationResult } from './drafts';
import type { DraftValues, FieldKey, ImportOptions, ImportRow, RowStatus } from './types';

const PAGE_SIZE = 50;

export interface AiStatus {
  state: 'off' | 'idle' | 'working' | 'done' | 'error';
  message?: string;
  progress?: { done: number; total: number };
}

type View = 'all' | RowStatus;

const STATUS: Record<RowStatus, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' }> = {
  new: { label: 'Nuevo', tone: 'success' },
  update: { label: 'Actualiza', tone: 'info' },
  skip: { label: 'Se omite', tone: 'warning' },
  error: { label: 'Con error', tone: 'danger' }
};

const SUMMARY: Record<RowStatus, { label: string; className: string }> = {
  new: { label: 'Productos nuevos', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  update: { label: 'Se actualizan', className: 'border-blue-200 bg-blue-50 text-blue-800' },
  skip: { label: 'Se omiten', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  error: { label: 'Con errores', className: 'border-red-200 bg-red-50 text-red-800' }
};

export function AiBar({ ai, onRetry }: { ai: AiStatus; onRetry?: () => void }) {
  if (ai.state === 'off' || ai.state === 'idle' || !ai.message) return null;
  const tone =
    ai.state === 'error' ? 'border-amber-200 bg-amber-50 text-amber-900' : ai.state === 'working' ? 'border-violet-200 bg-violet-50 text-violet-900' : 'border-violet-200 bg-violet-50/60 text-violet-900';
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-body-sm', tone)} role="status">
      {ai.state === 'working' ? (
        <Loader2 className="mt-px size-4 shrink-0 animate-spin" aria-hidden />
      ) : ai.state === 'error' ? (
        <TriangleAlert className="mt-px size-4 shrink-0 text-amber-600" aria-hidden />
      ) : (
        <Sparkles className="mt-px size-4 shrink-0 text-violet-600" aria-hidden />
      )}
      <span className="flex-1">
        {ai.message}
        {ai.progress && ai.state === 'working' && (
          <span className="tnum">
            {' '}
            ({formatNumber(ai.progress.done)} de {formatNumber(ai.progress.total)})
          </span>
        )}
      </span>
      {ai.state === 'error' && onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline-offset-2 hover:underline">
          Reintentar
        </button>
      )}
    </div>
  );
}

function RowEditor({
  row,
  edited,
  onEdit,
  onReset,
  onClose,
  categories,
  dual
}: {
  row: ImportRow;
  edited: boolean;
  onEdit: (values: DraftValues) => void;
  onReset: () => void;
  onClose: () => void;
  categories: string[];
  dual: boolean;
}) {
  const field = (key: FieldKey, label: string, opts: { list?: string; numeric?: boolean; span?: boolean; placeholder?: string } = {}) => {
    const id = `ed-${row.draft.id}-${key}`;
    return (
      <label htmlFor={id} className={cn('flex flex-col gap-1', opts.span && 'col-span-2')}>
        <span className="text-label-sm text-on-surface-variant">{label}</span>
        <Input
          id={id}
          inputSize="sm"
          value={cellText(row.values[key])}
          onChange={(e) => onEdit({ [key]: e.target.value })}
          inputMode={opts.numeric ? 'decimal' : undefined}
          list={opts.list}
          placeholder={opts.placeholder}
          autoComplete="off"
        />
      </label>
    );
  };
  const category = row.values.categoria !== undefined ? undefined : row.input.category;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary-fixed/10 p-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {field('nombre', 'Nombre', { span: true })}
        {field('categoria', 'Categoría', { list: 'import-categories', placeholder: category })}
        {field('marca', 'Marca')}
        {field('costo', dual ? 'Costo ($)' : 'Costo', { numeric: true })}
        {field('precio', dual ? 'Precio ($)' : 'Precio', { numeric: true, placeholder: row.fromLocal !== undefined || row.autoPriced ? String(row.input.salePrice) : undefined })}
        {field('stock', 'Stock / cantidad', { numeric: true })}
        {field('unidad', 'Unidad', { list: 'import-units', placeholder: row.input.unit })}
        {field('sku', 'SKU', { placeholder: row.existing ? row.existing.sku : row.input.sku })}
        {field('codigo_barras', 'Código de barras')}
      </div>
      <datalist id="import-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="import-units">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <div className="flex flex-wrap justify-end gap-2">
        {edited && (
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onReset}>
            Deshacer cambios
          </Button>
        )}
        <Button size="sm" icon={Check} onClick={onClose}>
          Listo
        </Button>
      </div>
    </div>
  );
}

export interface ReviewStepProps {
  source: ReactNode;
  onAdjustColumns?: () => void;
  result: ValidationResult;
  options: ImportOptions;
  onOptions: (patch: Partial<ImportOptions>) => void;
  defaultMargin: number;
  hasStockValues: boolean;
  aiCategoryCount: number;
  ai: AiStatus;
  onAiRetry?: () => void;
  /** Hay filas sin categoría que la IA podría clasificar. */
  onSuggestCategories?: () => void;
  onRenameCategory: (name: string) => void;
  edits: Record<string, DraftValues>;
  onEdit: (id: string, values: DraftValues) => void;
  onResetEdit: (id: string) => void;
  excluded: ReadonlySet<string>;
  onToggleExclude: (id: string) => void;
  notices: string[];
  money: (n: number) => string;
  local: ((usd: number | null | undefined) => string) | null;
  formatLocal: (bs: number) => string;
  rateLabel: string;
  categories: string[];
  dual: boolean;
  online: boolean;
}

export function ReviewStep(p: ReviewStepProps) {
  const { result } = p;
  const [view, setView] = useState<View>(() => (result.counts.error > 0 && result.counts.new + result.counts.update === 0 ? 'error' : 'all'));
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => setPage(1), [view, query]);

  const shown = useMemo(() => {
    const q = normalize(query);
    return result.rows.filter((r) => {
      if (view !== 'all' && r.status !== view) return false;
      if (!q) return true;
      return normalize(`${r.input.name} ${r.input.sku} ${r.input.barcode} ${r.input.category} ${r.draft.origin}`).includes(q);
    });
  }, [result.rows, view, query]);
  const pageRows = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const withoutCategory = result.rows.filter((r) => r.status === 'new' && r.categorySource === 'default').length;
  const fmt = (n: number) => formatNumber(n);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">{p.source}</div>
        {p.onAdjustColumns && (
          <Button variant="soft" size="sm" icon={Columns3} onClick={p.onAdjustColumns}>
            Ajustar columnas
          </Button>
        )}
      </div>

      <AiBar ai={p.ai} onRetry={p.onAiRetry} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['new', 'update', 'skip', 'error'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setView(view === s ? 'all' : s)}
            aria-pressed={view === s}
            className={cn('flex flex-col rounded-xl border px-3 py-2.5 text-left transition-shadow', SUMMARY[s].className, view === s && 'ring-2 ring-current/40')}
          >
            <span className="text-headline-md tnum">{fmt(result.counts[s])}</span>
            <span className="text-body-sm">{SUMMARY[s].label}</span>
          </button>
        ))}
      </div>

      {(result.matches > 0 || result.missingPriceWithCost > 0) && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
          {result.matches > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-label-lg text-on-surface">
                {fmt(result.matches)} {result.matches === 1 ? 'producto ya existe' : 'productos ya existen'} en tu inventario
                <span className="block text-body-sm font-normal text-on-surface-variant">Coinciden por SKU, código de barras o nombre.</span>
              </span>
              <Segmented
                size="sm"
                value={p.options.existing}
                onChange={(v) => p.onOptions({ existing: v })}
                options={[
                  { value: 'skip', label: 'Omitirlos' },
                  { value: 'update', label: 'Actualizarlos' }
                ]}
                className="self-start"
              />
            </div>
          )}
          {result.matches > 0 && p.options.existing === 'update' && p.hasStockValues && (
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-label-md text-on-surface">
                Cantidades del archivo en productos existentes
                <span className="block text-body-sm font-normal text-on-surface-variant">
                  {p.options.stockMode === 'add'
                    ? 'Se suman al stock como entrada de mercancía (ideal para facturas de compra).'
                    : p.options.stockMode === 'set'
                      ? 'Reemplazan el stock actual, como un conteo físico.'
                      : 'El stock de los productos existentes no cambia.'}
                </span>
              </span>
              <Segmented
                size="sm"
                value={p.options.stockMode}
                onChange={(v) => p.onOptions({ stockMode: v })}
                options={[
                  { value: 'keep', label: 'No tocar' },
                  { value: 'add', label: 'Sumar' },
                  { value: 'set', label: 'Reemplazar' }
                ]}
                className="self-start"
              />
            </div>
          )}
          {result.missingPriceWithCost > 0 && (
            <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', result.matches > 0 && 'border-t border-slate-100 pt-3')}>
              <Checkbox
                checked={p.options.autoPriceMargin !== null}
                onChange={(on) => p.onOptions({ autoPriceMargin: on ? p.defaultMargin : null })}
                label={`Calcular el precio de venta desde el costo (${fmt(result.missingPriceWithCost)} ${result.missingPriceWithCost === 1 ? 'producto' : 'productos'} sin precio)`}
                description="Con el margen que indiques sobre el precio de venta. Puedes corregir cualquier precio después."
              />
              {p.options.autoPriceMargin !== null && (
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="text-body-sm text-on-surface-variant">Margen</span>
                  <div className="w-16">
                    <NumberInput
                      inputSize="sm"
                      value={p.options.autoPriceMargin}
                      onValueChange={(v) => p.onOptions({ autoPriceMargin: v === '' ? 0 : Math.min(95, v) })}
                      className="text-right"
                      aria-label="Margen sobre el precio de venta"
                    />
                  </div>
                  <span className="text-body-sm text-on-surface-variant">%</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {result.converted > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-body-sm text-amber-900" role="status">
          <Calculator className="mt-px size-4 shrink-0 text-amber-600" aria-hidden />
          <span>
            {result.converted === 1 ? '1 precio venía' : `${fmt(result.converted)} precios venían`} solo en bolívares y se
            {result.converted === 1 ? ' convirtió' : ' convirtieron'} a $ con la tasa de hoy (<b className="tnum">{p.rateLabel}</b>). El precio se guarda en $.
          </span>
        </p>
      )}

      {p.notices.map((n) => (
        <p key={n} className="flex items-start gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-body-sm text-on-surface-variant">
          <Info className="mt-px size-4 shrink-0 text-secondary" aria-hidden />
          {n}
        </p>
      ))}

      {!p.online && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-body-sm text-amber-800" role="status">
          <TriangleAlert className="mt-px size-4 shrink-0" />
          Estás sin conexión. Podrás importar en cuanto se restablezca.
        </p>
      )}

      {/* Categorías */}
      {result.categories.length > 0 && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-label-lg text-on-surface">
              Categorías
              <span className="ml-1.5 text-body-sm font-normal text-on-surface-variant">
                {result.categories.filter((c) => c.isNew).length
                  ? `· ${fmt(result.categories.filter((c) => c.isNew).length)} nuevas se crearán`
                  : '· todas ya existen'}
                {' · toca una para renombrarla o unirla con otra'}
              </span>
            </span>
            {p.onSuggestCategories && withoutCategory > 0 && p.ai.state !== 'working' && (
              <Button variant="tonal" size="sm" icon={WandSparkles} onClick={p.onSuggestCategories}>
                Clasificar {fmt(withoutCategory)} sin categoría con IA
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.categories.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => p.onRenameCategory(c.name)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-label-md transition-colors',
                  c.isNew ? 'border-primary/30 bg-primary-fixed/20 text-on-primary-fixed-variant hover:bg-primary-fixed/40' : 'border-slate-200 bg-slate-50 text-on-surface hover:bg-slate-100'
                )}
                title={c.fromAi ? `${c.fromAi} sugerido(s) por la IA` : undefined}
              >
                {c.fromAi > 0 ? <Sparkles className="size-3.5 text-violet-600" aria-hidden /> : <Tag className="size-3.5 opacity-60" aria-hidden />}
                {c.name}
                <span className="rounded-full bg-white/70 px-1.5 text-[11px] tnum">{fmt(c.count)}</span>
                {c.isNew && <span className="text-[10px] font-bold uppercase tracking-wide text-primary">nueva</span>}
              </button>
            ))}
          </div>
          {p.aiCategoryCount > 0 && (
            <Checkbox
              checked={p.options.useAiCategories}
              onChange={(v) => p.onOptions({ useAiCategories: v })}
              label={`Usar las categorías sugeridas por la IA (${fmt(p.aiCategoryCount)} ${p.aiCategoryCount === 1 ? 'producto' : 'productos'})`}
              description="Solo para productos nuevos que no traen categoría en el archivo. Sin esto, quedan en «General»."
            />
          )}
        </div>
      )}

      {/* Filas */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'all', label: `Todas (${fmt(result.rows.length)})` },
            { value: 'new', label: `Nuevos (${fmt(result.counts.new)})` },
            { value: 'update', label: `Actualizan (${fmt(result.counts.update)})` },
            { value: 'skip', label: `Omitidas (${fmt(result.counts.skip)})` },
            { value: 'error', label: `Errores (${fmt(result.counts.error)})` }
          ]}
          className="no-scrollbar max-w-full self-start overflow-x-auto"
        />
        {result.rows.length > 10 && <SearchInput value={query} onChange={setQuery} placeholder="Buscar en el archivo…" inputSize="sm" className="sm:w-60" />}
      </div>

      <div className="max-h-[48vh] overflow-auto rounded-xl border border-slate-200/80 scrollbar-thin">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="h-9 w-12 px-3 text-label-sm text-slate-500 uppercase">
                <span className="sr-only">Foto</span>
              </th>
              <th className="h-9 px-3 text-label-sm text-slate-500 uppercase">Producto</th>
              <th className="h-9 px-3 text-label-sm text-slate-500 uppercase">Categoría</th>
              <th className="h-9 px-3 text-right text-label-sm text-slate-500 uppercase">Costo</th>
              <th className="h-9 px-3 text-right text-label-sm text-slate-500 uppercase">Precio</th>
              <th className="h-9 px-3 text-right text-label-sm text-slate-500 uppercase">Stock</th>
              <th className="h-9 px-3 text-label-sm text-slate-500 uppercase">Estado</th>
              <th className="h-9 w-20 px-2">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => {
              const id = r.draft.id;
              const isExcluded = p.excluded.has(id);
              const link = cellText(r.values.imagen);
              const stockCell = r.existing ? (
                r.stockDelta ? (
                  <span className="whitespace-nowrap">
                    {fmt(Number(r.existing.stock) || 0)} → <b>{fmt(r.input.stock)}</b>
                  </span>
                ) : (
                  fmt(Number(r.existing.stock) || 0)
                )
              ) : (
                fmt(r.input.stock)
              );
              return [
                <tr key={id} className={cn('border-b border-slate-100 align-top', r.status === 'error' && 'bg-red-50/40', isExcluded && 'opacity-60')}>
                  <td className="px-3 py-2">
                    <Thumb blob={r.draft.image?.blob} url={/^https?:\/\//i.test(link) ? link : null} fallbackUrl={r.existing?.imageUrl} />
                  </td>
                  <td className="max-w-64 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className={cn('truncate text-label-md', r.input.name ? 'text-on-surface' : 'text-on-surface-variant italic')}>{r.input.name || 'Sin nombre'}</span>
                      {r.draft.fromAi && <Sparkles className="size-3.5 shrink-0 text-violet-600" aria-label="Leído por la IA" />}
                      {r.input.taxExempt && (
                        <Badge size="xs" tone="info">
                          Exento
                        </Badge>
                      )}
                    </span>
                    <span className="block truncate text-body-sm text-on-surface-variant tnum">
                      {[r.input.sku, r.input.barcode].filter(Boolean).join(' · ') || '—'}
                    </span>
                    <span className="block truncate text-[11px] text-on-surface-variant/70">{r.draft.origin}</span>
                  </td>
                  <td className="px-3 py-2 text-body-sm">
                    <span className={cn('inline-flex items-center gap-1', r.categorySource === 'default' || r.categorySource === 'keep' ? 'text-on-surface-variant' : 'text-on-surface')}>
                      {r.categorySource === 'ai' && <Sparkles className="size-3.5 text-violet-600" aria-label="Sugerida por la IA" />}
                      {r.input.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-body-sm whitespace-nowrap text-on-surface tnum">{r.input.costPrice > 0 ? p.money(r.input.costPrice) : '—'}</td>
                  <td className="px-3 py-2 text-right text-body-sm text-on-surface tnum">
                    {r.input.salePrice > 0 ? (
                      <span className="flex flex-col items-end whitespace-nowrap">
                        <span className={cn((r.fromLocal !== undefined || r.autoPriced) && 'font-semibold text-amber-800')}>{p.money(r.input.salePrice)}</span>
                        {r.fromLocal !== undefined ? (
                          <span className="text-[11px] leading-4 text-on-surface-variant">desde {p.formatLocal(r.fromLocal)}</span>
                        ) : r.autoPriced ? (
                          <span className="text-[11px] leading-4 text-on-surface-variant">calculado</span>
                        ) : p.local ? (
                          <span className="text-[11px] leading-4 text-on-surface-variant">{p.local(r.input.salePrice)}</span>
                        ) : null}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-body-sm text-on-surface tnum">
                    {stockCell} <span className="text-on-surface-variant">{r.input.unit}</span>
                  </td>
                  <td className="max-w-64 px-3 py-2">
                    <Badge tone={STATUS[r.status].tone} dot size="xs">
                      {STATUS[r.status].label}
                    </Badge>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {r.status === 'update' && r.changes.length > 0 && <li className="text-body-sm text-blue-800">Cambia: {r.changes.join(', ')}</li>}
                      {r.problems.map((m) => (
                        <li key={m} className={cn('text-body-sm', r.status === 'error' ? 'text-red-700' : 'text-amber-800')}>
                          {m}
                        </li>
                      ))}
                      {r.notes.map((m) => (
                        <li key={m} className="text-body-sm text-on-surface-variant">
                          {m}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => setEditing(editing === id ? null : id)}
                        className={cn('rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface', editing === id && 'bg-surface-container text-primary')}
                        aria-label={`Corregir ${r.input.name || r.draft.origin}`}
                        title="Corregir datos"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => p.onToggleExclude(id)}
                        className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                        aria-label={isExcluded ? 'Volver a incluir' : 'Quitar de la importación'}
                        title={isExcluded ? 'Volver a incluir' : 'Quitar de la importación'}
                      >
                        {isExcluded ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </button>
                    </div>
                  </td>
                </tr>,
                editing === id ? (
                  <tr key={`${id}-edit`} className="border-b border-slate-100">
                    <td colSpan={8} className="px-3 py-2">
                      <RowEditor
                        row={r}
                        edited={!!p.edits[id]}
                        onEdit={(v) => p.onEdit(id, v)}
                        onReset={() => p.onResetEdit(id)}
                        onClose={() => setEditing(null)}
                        categories={p.categories}
                        dual={p.dual}
                      />
                    </td>
                  </tr>
                ) : null
              ];
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-body-md text-on-surface-variant">
                  No hay filas en esta vista.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {shown.length > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={shown.length} onChange={setPage} label="filas" />}
    </div>
  );
}
