import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Funnel, Info, ListChecks, Percent, Tags, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react';
import { Button, Field, Modal, NumberInput, Segmented, Select, useConfirm, useToast } from '@/components/ui';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useOnline } from '@/hooks/data';
import { formatNumber } from '@/lib/format';
import { cn, errorMessage, normalize } from '@/lib/utils';
import { bulkAdjustPrices, type BulkPriceInput } from '@/services/products';
import type { Product } from '@/types';
import { LocalLine, RateChip } from './FxBits';
import { adjustPrice, commitWrite, marginOf, ROUNDING_STEPS } from './helpers';
import { useInventoryFx } from './useInventoryFx';

export type BulkScope = 'selected' | 'filtered' | 'category';
type PriceField = BulkPriceInput['field'];
type Direction = 'up' | 'down';

const PREVIEW_LIMIT = 6;
/** Sin conexión, `bulkAdjustPrices` solo deja en cola el primer lote (400) hasta reconectar. */
const MAX_OFFLINE = 400;
const QUICK_PCTS = [5, 10, 15, 20, 30, 50];

const FIELD_OPTIONS: { value: PriceField; label: string }[] = [
  { value: 'salePrice', label: 'Precio de venta' },
  { value: 'costPrice', label: 'Costo' },
  { value: 'both', label: 'Ambos' }
];

interface Props {
  /** Productos marcados en la tabla. */
  selected: Product[];
  /** Resultado de la búsqueda y filtros actuales. */
  filtered: Product[];
  /** Catálogo completo (para el alcance por categoría). */
  all: Product[];
  categories: string[];
  filtersActive: boolean;
  initialScope: BulkScope;
  initialCategory?: string;
  onClose: () => void;
  /** Se llama tras aplicar el ajuste (ej. para limpiar la selección). */
  onDone?: (scope: BulkScope) => void;
}

/** Ajuste masivo de precios por porcentaje (inflación, cambio de lista del proveedor…). */
export function BulkPriceModal({ selected, filtered, all, categories, filtersActive, initialScope, initialCategory, onClose, onDone }: Props) {
  const { business, businessId, actor, money, currencySymbol } = useActiveBusiness();
  const ifx = useInventoryFx();
  const online = useOnline();
  const toast = useToast();
  const { confirm } = useConfirm();
  const locale = business.locale;
  const minMargin = business.settings.minMarginPct;
  const fmt = (n: number) => formatNumber(n, locale);

  const [scope, setScope] = useState<BulkScope>(initialScope === 'selected' && !selected.length ? 'filtered' : initialScope);
  const [category, setCategory] = useState(initialCategory || categories[0] || '');
  const [field, setField] = useState<PriceField>('salePrice');
  const [dir, setDir] = useState<Direction>('up');
  const [pctAbs, setPctAbs] = useState<number | ''>('');
  const [step, setStep] = useState<number>(0.01);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    const names = new Map<string, string>();
    for (const c of categories) names.set(normalize(c), c);
    for (const p of all) {
      const k = normalize(p.category || 'General');
      counts.set(k, (counts.get(k) ?? 0) + 1);
      if (!names.has(k)) names.set(k, p.category || 'General');
    }
    return Array.from(names.entries())
      .sort((a, b) => a[1].localeCompare(b[1], 'es'))
      .map(([k, c]) => ({ value: c, label: `${c} (${formatNumber(counts.get(k) ?? 0, locale)})` }));
  }, [all, categories, locale]);

  const targets = useMemo(() => {
    if (scope === 'selected') return selected;
    if (scope === 'filtered') return filtered;
    const key = normalize(category);
    return key ? all.filter((p) => normalize(p.category || 'General') === key) : [];
  }, [scope, selected, filtered, all, category]);

  const pct = pctAbs === '' ? 0 : dir === 'up' ? pctAbs : -pctAbs;
  const touchesSale = field === 'salePrice' || field === 'both';
  const touchesCost = field === 'costPrice' || field === 'both';

  let error: string | null = null;
  if (!targets.length) error = scope === 'category' ? 'Esa categoría no tiene productos.' : 'No hay productos en este alcance.';
  else if (pctAbs === '' || pctAbs <= 0) error = 'Escribe el porcentaje del ajuste.';
  else if (dir === 'down' && pctAbs >= 100) error = 'La reducción debe ser menor a 100 %.';
  else if (dir === 'up' && pctAbs > 1000) error = 'El aumento máximo es de 1000 %.';

  const after = (p: Product) => ({
    sale: touchesSale ? adjustPrice(p.salePrice, pct, step) : Number(p.salePrice) || 0,
    cost: touchesCost ? adjustPrice(p.costPrice, pct, step) : Number(p.costPrice) || 0
  });

  // Efecto del ajuste sobre los márgenes (sobre todo al subir solo el costo).
  const stats = { belowCost: 0, belowMin: 0, unchanged: 0 };
  if (pct && !error) {
    for (const p of targets) {
      const a = after(p);
      if (a.sale === (Number(p.salePrice) || 0) && a.cost === (Number(p.costPrice) || 0)) stats.unchanged++;
      if (a.sale <= 0) continue;
      const m = marginOf(a.cost, a.sale, p.taxExempt, ifx.tax);
      if (m <= 0) stats.belowCost++;
      else if (m < minMargin) stats.belowMin++;
    }
  }

  const stepFormatter = useMemo(() => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [locale]);
  const pctText = `${pct > 0 ? '+' : '−'}${formatNumber(Math.abs(pct), locale)} %`;
  const whatText = field === 'both' ? 'el precio de venta y el costo' : field === 'salePrice' ? 'el precio de venta' : 'el costo';
  const n = targets.length;

  const submit = async () => {
    setTouched(true);
    if (error) return;
    if (!online && n > MAX_OFFLINE) {
      toast.error(`Sin conexión puedes ajustar hasta ${fmt(MAX_OFFLINE)} productos a la vez. Conéctate a internet para continuar.`);
      return;
    }
    const ok = await confirm({
      title: `Ajustar ${n === 1 ? '1 producto' : `${fmt(n)} productos`}`,
      message: (
        <>
          Se aplicará <b className="text-on-surface tnum">{pctText}</b> a {whatText} con redondeo a{' '}
          <b className="text-on-surface tnum">{stepFormatter.format(step)}</b>.
          {stats.belowCost > 0 && (
            <span className="mt-2 block text-red-700">
              {stats.belowCost === 1 ? '1 producto quedará' : `${fmt(stats.belowCost)} productos quedarán`} con un precio que no cubre su costo.
            </span>
          )}
          <span className="mt-2 block">Esta acción no se puede deshacer automáticamente.</span>
        </>
      ),
      confirmLabel: 'Aplicar ajuste',
      tone: 'primary'
    });
    if (!ok) return;
    setSaving(true);
    try {
      await commitWrite(bulkAdjustPrices(businessId, actor, targets, { pct, field, rounding: step }), online, (e) => toast.error(errorMessage(e)));
      toast.success(
        online
          ? `Precios actualizados: ${n === 1 ? '1 producto' : `${fmt(n)} productos`} (${pctText}).`
          : 'Ajuste guardado. Se sincronizará al recuperar la conexión.'
      );
      onDone?.(scope);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
      setSaving(false);
    }
  };

  const scopes: { value: BulkScope; label: string; description: string; icon: LucideIcon; disabled?: boolean }[] = [
    {
      value: 'selected',
      label: 'Seleccionados',
      description: selected.length ? `${fmt(selected.length)} ${selected.length === 1 ? 'producto marcado' : 'productos marcados'}` : 'No hay productos marcados',
      icon: ListChecks,
      disabled: !selected.length
    },
    {
      value: 'filtered',
      label: filtersActive ? 'Todos los filtrados' : 'Todo el catálogo',
      description: `${fmt(filtered.length)} ${filtered.length === 1 ? 'producto' : 'productos'}${filtersActive ? ' en la lista actual' : ''}`,
      icon: Funnel
    },
    { value: 'category', label: 'Una categoría', description: 'Todos los de una categoría', icon: Tags }
  ];

  const preview = targets.slice(0, PREVIEW_LIMIT);

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="lg"
      icon={Percent}
      title="Ajustar precios"
      subtitle="Sube o baja precios y costos por porcentaje, por ejemplo para seguir la inflación o la nueva lista del proveedor."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving} className="sm:mr-auto">
            Cancelar
          </Button>
          <Button icon={Percent} onClick={submit} loading={saving} disabled={saving || (touched && !!error)}>
            {n ? `Aplicar a ${n === 1 ? '1 producto' : `${fmt(n)} productos`}` : 'Aplicar ajuste'}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {/* Alcance */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-label-md text-slate-700">¿A qué productos?</legend>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Alcance del ajuste">
            {scopes.map((s) => {
              const active = scope === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={s.disabled}
                  onClick={() => setScope(s.value)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:flex-col sm:items-start',
                    active ? 'border-primary bg-primary-fixed/20 text-primary' : 'border-slate-200 bg-white text-on-surface hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  <s.icon className="size-5 shrink-0" aria-hidden />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-label-md">{s.label}</span>
                    <span className={cn('text-body-sm tnum', active ? 'opacity-80' : 'text-on-surface-variant')}>{s.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {scope === 'category' && (
            <Field label="Categoría" htmlFor="bulk-category" className="mt-1 sm:max-w-xs">
              <Select id="bulk-category" value={category} onChange={(e) => setCategory(e.target.value)} options={categoryOptions} placeholder={categoryOptions.length ? undefined : 'Sin categorías'} />
            </Field>
          )}
        </fieldset>

        {/* Qué ajustar */}
        <div className="flex flex-col gap-1.5">
          <span className="text-label-md text-slate-700">¿Qué quieres ajustar?</span>
          <Segmented options={FIELD_OPTIONS} value={field} onChange={setField} className="self-start" />
          <span className="text-body-sm text-slate-500">
            {field === 'costPrice'
              ? 'Solo cambia el costo: útil cuando el proveedor sube su lista y aún no quieres mover el precio al público.'
              : field === 'both'
                ? 'Precio de venta y costo suben o bajan en el mismo porcentaje: el margen se mantiene.'
                : 'Cambia el precio que se cobra en caja.'}
          </span>
        </div>

        {/* Porcentaje */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bulk-pct" className="text-label-md text-slate-700">
            Porcentaje<span className="ml-0.5 text-error">*</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              options={[
                { value: 'up' as Direction, label: 'Aumentar', icon: TrendingUp },
                { value: 'down' as Direction, label: 'Reducir', icon: TrendingDown }
              ]}
              value={dir}
              onChange={setDir}
            />
            <NumberInput
              id="bulk-pct"
              data-autofocus
              value={pctAbs}
              onValueChange={setPctAbs}
              suffix="%"
              placeholder="0"
              className="w-32"
              invalid={touched && !!error && (pctAbs === '' || pctAbs <= 0 || (dir === 'down' && pctAbs >= 100) || pctAbs > 1000)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Porcentajes rápidos">
            {QUICK_PCTS.filter((q) => dir === 'up' || q < 100).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setPctAbs(q)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-label-sm tnum transition-colors',
                  pctAbs === q ? 'border-primary bg-primary-fixed/30 text-primary' : 'border-slate-200 bg-white text-on-surface-variant hover:border-slate-300 hover:text-on-surface'
                )}
              >
                {dir === 'up' ? '+' : '−'}
                {q} %
              </button>
            ))}
          </div>
        </div>

        {/* Redondeo */}
        <div className="flex flex-col gap-1.5">
          <span className="text-label-md text-slate-700">Redondeo del resultado (en {currencySymbol})</span>
          <Segmented
            size="sm"
            options={ROUNDING_STEPS.map((s) => ({ value: String(s), label: stepFormatter.format(s) }))}
            value={String(step)}
            onChange={(v) => setStep(Number(v))}
            className="no-scrollbar max-w-full self-start overflow-x-auto"
          />
          <span className="text-body-sm text-slate-500">
            Al múltiplo más cercano. Ej.: con {stepFormatter.format(0.5)}, un resultado de {money(10.37)} queda en {money(10.5)}.
          </span>
        </div>

        {/* Vista previa */}
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-surface-container-low p-3" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-label-lg text-on-surface">Vista previa</span>
            <span className="flex flex-wrap items-center gap-2">
              <RateChip ifx={ifx} />
              <span className="text-body-sm text-on-surface-variant tnum">
                {n === 0 ? 'Sin productos' : n <= PREVIEW_LIMIT ? `${fmt(n)} ${n === 1 ? 'producto' : 'productos'}` : `${fmt(PREVIEW_LIMIT)} de ${fmt(n)} productos`}
              </span>
            </span>
          </div>

          {pct !== 0 && !error && (stats.belowCost > 0 || stats.belowMin > 0 || stats.unchanged > 0) && (
            <ul className="flex flex-col gap-1 text-body-sm">
              {stats.belowCost > 0 && (
                <li className="flex items-start gap-1.5 text-red-700">
                  <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
                  {stats.belowCost === 1 ? '1 producto quedaría' : `${fmt(stats.belowCost)} productos quedarían`} vendiéndose sin ganancia (el costo iguala o supera el precio).
                </li>
              )}
              {stats.belowMin > 0 && (
                <li className="flex items-start gap-1.5 text-amber-800">
                  <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
                  {stats.belowMin === 1 ? '1 producto quedaría' : `${fmt(stats.belowMin)} productos quedarían`} por debajo del margen mínimo ({minMargin}%).
                </li>
              )}
              {stats.unchanged > 0 && (
                <li className="flex items-start gap-1.5 text-on-surface-variant">
                  <Info className="mt-px size-4 shrink-0" aria-hidden />
                  {stats.unchanged === 1 ? '1 producto no cambia' : `${fmt(stats.unchanged)} productos no cambian`} (precio en 0 o el redondeo absorbe el ajuste).
                </li>
              )}
            </ul>
          )}

          {preview.length === 0 ? (
            <p className="py-4 text-center text-body-md text-on-surface-variant">{error ?? 'Sin productos.'}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-200/70 rounded-lg border border-slate-200/80 bg-white">
              {preview.map((p) => {
                const a = after(p);
                const lines: { key: string; label: string; before: number; after: number }[] = [];
                if (touchesSale) lines.push({ key: 's', label: 'Venta', before: Number(p.salePrice) || 0, after: a.sale });
                if (touchesCost) lines.push({ key: 'c', label: 'Costo', before: Number(p.costPrice) || 0, after: a.cost });
                return (
                  <li key={p.id} className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-label-md text-on-surface" title={p.name}>
                        {p.name}
                      </span>
                      <span className="truncate text-body-sm text-on-surface-variant tnum">
                        {p.sku} · {p.category || 'General'}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      {lines.map((l) => (
                        <div key={l.key} className="grid grid-cols-[3.25rem_1fr_auto_1fr] items-center gap-x-2 text-body-sm tnum sm:grid-cols-[3.25rem_auto_auto_auto] sm:justify-end">
                          <span className="text-on-surface-variant">{l.label}</span>
                          <span className="flex flex-col items-end">
                            <span className="text-on-surface-variant">{money(l.before)}</span>
                            <LocalLine usd={l.before} local={ifx.local} className="text-on-surface-variant/80" />
                          </span>
                          <ArrowRight className="size-3.5 text-on-surface-variant" aria-hidden />
                          <span className="flex flex-col items-end">
                            <span
                              className={cn(
                                'font-semibold',
                                l.after > l.before ? 'text-on-surface' : l.after < l.before ? 'text-error' : 'text-on-surface-variant'
                              )}
                            >
                              {pct ? money(l.after) : '—'}
                            </span>
                            {pct ? <LocalLine usd={l.after} local={ifx.local} /> : null}
                          </span>
                        </div>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {touched && error && (
          <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-body-sm text-red-800" role="alert">
            <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
