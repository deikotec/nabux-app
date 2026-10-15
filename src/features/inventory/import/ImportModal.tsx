/**
 * Importar productos: desde Excel (con o sin fotos dentro), CSV o fotos de listas, facturas y productos.
 *
 * Pasos: elegir → (leer) → columnas, solo si hace falta → revisar → guardar → listo.
 * La IA (si está activada) propone qué es cada columna, las categorías, y lee las fotos; todo lo
 * que propone se puede ver y corregir antes de guardar, y sin ella el importador funciona igual.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Ban, Camera, CircleCheck, FileSpreadsheet, FileUp, ImageOff, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import { Badge, Button, Modal, ProgressBar, useConfirm, useToast } from '@/components/ui';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useOnline } from '@/hooks/data';
import { aiConfigured, AiError } from '@/lib/ai';
import { formatNumber } from '@/lib/format';
import { downloadFile, errorMessage } from '@/lib/utils';
import { saveCategories } from '@/services/business';
import { importCatalog, type ImportItem, type ImportProgress, type ImportResult } from '@/services/products';
import { templateCsv, type CsvOptions } from '../helpers';
import { useInventoryFx } from '../useInventoryFx';
import { analyzeTable, classifyNames, readPhoto, type BusinessHints, type PhotoMode } from './aiImport';
import { assignByWords, categoryKey, tidyCategory, type CategoryRule } from './categorize';
import { ColumnsStep } from './ColumnsStep';
import { tableToDrafts, validateDrafts, type ValidateContext } from './drafts';
import { analyzeColumns, autoMap, availableFields, mergeAiMapping, missingRequired } from './fields';
import { cellText } from './numbers';
import { PickStep, type PickMode } from './PickStep';
import { ReviewStep, type AiStatus } from './ReviewStep';
import { fileNameDraft, isImageFile, isTableFile, MAX_PHOTOS, photoDrafts, readTableFile, type TableSource } from './sources';
import type { ColumnInfo, ColumnMapping, Draft, DraftValues, ImportOptions, Target } from './types';

/** Plantilla de importación: con `precio_bs` si el negocio es bimonetario y `exento` en Venezuela. */
export function downloadImportTemplate(opts: CsvOptions = {}) {
  downloadFile('plantilla-productos.csv', templateCsv(opts));
}

type Step = 'pick' | 'reading' | 'columns' | 'review' | 'saving' | 'done';

type Source = { kind: 'table'; src: TableSource; tableIndex: number } | { kind: 'photos'; files: string[]; mode: PhotoMode };

const DEFAULT_OPTIONS: ImportOptions = { existing: 'skip', stockMode: 'keep', autoPriceMargin: null, useAiCategories: true, renames: {} };

/** La IA no puede dejar la pantalla colgada: si tarda demasiado se sigue sin ella. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new AiError('network', 'La IA tardó demasiado en responder.')), ms))]);
}

const aiMessage = (e: unknown) => (e instanceof AiError ? e.message : errorMessage(e));

export function ImportModal({ onClose }: { onClose: () => void }) {
  const { business, businessId, actor, money, can } = useActiveBusiness();
  const { products, suppliers, categories } = useCatalog();
  const ifx = useInventoryFx();
  const online = useOnline();
  const toast = useToast();
  const { prompt } = useConfirm();
  const csvOptions: CsvOptions = { dual: ifx.dual, exempt: ifx.exemptUi };
  const fields = useMemo(() => availableFields({ dual: ifx.dual, exempt: ifx.exemptUi }), [ifx.dual, ifx.exemptUi]);
  const hints: BusinessHints = useMemo(
    () => ({ businessType: business.businessType, currency: business.currency, localCurrency: ifx.dual ? (business.fx?.localCurrency ?? 'VES') : null, categories }),
    [business.businessType, business.currency, business.fx?.localCurrency, ifx.dual, categories]
  );

  const [step, setStep] = useState<Step>('pick');
  const [pickMode, setPickMode] = useState<PickMode>('file');
  const [photoMode, setPhotoMode] = useState<PhotoMode>(aiConfigured ? 'list' : 'product');
  const [reading, setReading] = useState<{ label: string; done?: number; total?: number } | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [infos, setInfos] = useState<ColumnInfo[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [edits, setEdits] = useState<Record<string, DraftValues>>({});
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_OPTIONS);
  const [notices, setNotices] = useState<string[]>([]);
  const [ai, setAi] = useState<AiStatus>({ state: aiConfigured ? 'idle' : 'off' });
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  /** Resumen tomado al guardar (después, los productos ya existen y la validación cambia). */
  const [summary, setSummary] = useState<{ newCategories: string[]; errors: number } | null>(null);
  const skuCache = useRef(new Map<string, string>()).current;
  /** Nombre → categoría que ya respondió la IA: volver a las columnas no vuelve a pagar la clasificación. */
  const classified = useRef(new Map<string, string>()).current;
  const cancelRef = useRef(false);
  /** Cambia cada vez que se carga algo nuevo: las respuestas tardías de la IA de una carga anterior se ignoran. */
  const generation = useRef(0);

  const table = source?.kind === 'table' ? source.src.tables[source.tableIndex] : null;

  /* ---------- Validación (se recalcula con cada corrección) ---------- */

  const vctx: ValidateContext = useMemo(
    () => ({
      products,
      suppliers,
      categories,
      settings: business.settings,
      dual: ifx.dual,
      rate: ifx.rate,
      tax: ifx.tax,
      money,
      formatLocal: (bs: number) => ifx.formatLocal(bs),
      rateText: `${ifx.sourceLabel} · ${ifx.rateText}`,
      skuCache
    }),
    [products, suppliers, categories, business.settings, ifx, money, skuCache]
  );
  const validation = useMemo(() => validateDrafts(drafts, edits, excluded, vctx, options), [drafts, edits, excluded, vctx, options]);
  const toImport = validation.counts.new + validation.counts.update;

  /* ---------- Categorías con IA ---------- */

  /** Coloca por palabras clave y, lo que no encaje, se lo pregunta a la IA en lotes. */
  const classifyRest = useCallback(
    async (list: Draft[], ruleList: CategoryRule[], gen: number) => {
      const pending = list.filter((d) => !cellText(d.values.categoria) && !d.aiCategory && cellText(d.values.nombre) && !classified.has(cellText(d.values.nombre)));
      const known = [...new Set([...ruleList.map((r) => r.name), ...categories])].filter((c) => categoryKey(c) !== 'general');
      if (!pending.length || !known.length || !aiConfigured) return;
      setAi({ state: 'working', message: `La IA está clasificando ${formatNumber(pending.length)} productos sin categoría…` });
      try {
        const { assigned, pending: left } = await classifyNames(
          pending.map((d) => cellText(d.values.nombre)),
          known,
          hints,
          (done, total) => gen === generation.current && setAi((a) => ({ ...a, progress: { done, total } }))
        );
        for (const [name, cat] of assigned) classified.set(name, cat);
        if (gen !== generation.current) return;
        setDrafts((ds) =>
          ds.map((d) => {
            if (d.aiCategory || cellText(d.values.categoria)) return d;
            const cat = assigned.get(cellText(d.values.nombre));
            return cat ? { ...d, aiCategory: cat } : d;
          })
        );
        const placed = assigned.size;
        setAi({
          state: 'done',
          message: `La IA sugirió categoría para ${formatNumber(placed)} de ${formatNumber(pending.length)} productos sin categoría${
            left ? ` (los ${formatNumber(left)} restantes superan el tope por importación)` : ''
          }. Revísalas abajo.`
        });
      } catch (e) {
        if (gen === generation.current) setAi({ state: 'error', message: `No se pudieron clasificar con IA: ${aiMessage(e)}` });
      }
    },
    [categories, hints, classified]
  );

  /** Borradores a partir del mapeo, con las categorías por palabras clave ya puestas. */
  const buildDrafts = useCallback(
    (tbl: NonNullable<typeof table>, map: ColumnMapping[], cols: ColumnInfo[], ruleList: CategoryRule[]) =>
      tableToDrafts(tbl, map, cols).map((d) => {
        if (cellText(d.values.categoria)) return d;
        const name = cellText(d.values.nombre);
        const cat = (ruleList.length ? assignByWords(name, ruleList) : null) ?? classified.get(name);
        return cat ? { ...d, aiCategory: cat } : d;
      }),
    [classified]
  );

  const goReview = (tbl: NonNullable<typeof table>, map: ColumnMapping[], cols: ColumnInfo[], ruleList: CategoryRule[]) => {
    const list = buildDrafts(tbl, map, cols, ruleList);
    setDrafts(list);
    setStep('review');
    const gen = generation.current;
    const byWords = list.filter((d) => d.aiCategory).length;
    if (ruleList.length) {
      setAi({ state: 'done', message: `La IA propuso ${ruleList.length} categorías y colocó ${formatNumber(byWords)} productos por palabras clave.` });
    }
    void classifyRest(list, ruleList, gen);
  };

  /* ---------- Archivo (Excel / CSV) ---------- */

  const openTable = async (src: TableSource, tableIndex: number) => {
    const gen = ++generation.current;
    const tbl = src.tables[tableIndex];
    const cols = analyzeColumns(tbl);
    let map = autoMap(cols, fields);
    let ruleList: CategoryRule[] = [];
    const notes: string[] = [];
    if (tbl.confidence === 'heuristic' || tbl.confidence === 'first-row') {
      notes.push(`Tomamos la fila ${tbl.headerLine}${tbl.sheet ? ` de «${tbl.sheet}»` : ''} como encabezados. Si no es así, revisa las columnas.`);
    }
    if (tbl.dropped.length) notes.push(`Se descartó ${tbl.dropped.length === 1 ? 'la fila' : 'las filas'} ${tbl.dropped.join(', ')} por parecer un total.`);
    if (tbl.images.size) notes.push(`El archivo trae ${formatNumber(tbl.images.size)} foto(s) de productos: se subirán como imagen de cada uno.`);

    setSource({ kind: 'table', src, tableIndex });
    setInfos(cols);
    setEdits({});
    setExcluded(new Set());
    setOptions(DEFAULT_OPTIONS);
    skuCache.clear();
    classified.clear();

    if (aiConfigured) {
      setReading({ label: 'La IA está revisando las columnas y proponiendo categorías…' });
      try {
        const nameCol = map.findIndex((m) => m.target === 'nombre');
        const names = nameCol >= 0 ? tbl.rows.map((r) => cellText(r.cells[nameCol])) : [];
        const analysis = await withTimeout(analyzeTable({ infos: cols, names, fields, hints }), 60_000);
        if (gen !== generation.current) return;
        map = mergeAiMapping(map, analysis.mapping, cols, fields);
        ruleList = analysis.rules;
        setAi({ state: 'idle' });
      } catch (e) {
        if (gen !== generation.current) return;
        setAi({ state: 'error', message: `IA no disponible: ${aiMessage(e)} Se usaron reglas automáticas.` });
      }
    }
    setMapping(map);
    setRules(ruleList);
    setNotices(notes);
    setReading(null);
    if (missingRequired(map, { dual: ifx.dual }).length) setStep('columns');
    else goReview(tbl, map, cols, ruleList);
  };

  const loadTableFile = async (file: File) => {
    setStep('reading');
    setReading({ label: `Leyendo «${file.name}»…` });
    try {
      const src = await readTableFile(file);
      await openTable(src, 0);
    } catch (e) {
      toast.error(errorMessage(e));
      setReading(null);
      setStep('pick');
    }
  };

  /* ---------- Fotos ---------- */

  const loadPhotos = async (all: File[]) => {
    const files = all.filter(isImageFile);
    if (!files.length) {
      toast.error('Elige fotos (JPG, PNG, WEBP o HEIC).');
      return;
    }
    if (files.length > MAX_PHOTOS) toast.warning(`Se usarán las primeras ${MAX_PHOTOS} fotos.`);
    const list = files.slice(0, MAX_PHOTOS);
    const mode = photoMode;
    if (mode === 'list' && !aiConfigured) {
      toast.error('Leer listas y facturas requiere la IA activada.');
      return;
    }
    const gen = ++generation.current;
    setStep('reading');
    setEdits({});
    setExcluded(new Set());
    setOptions({ ...DEFAULT_OPTIONS, existing: mode === 'product' ? 'update' : 'skip' });
    skuCache.clear();
    setSource({ kind: 'photos', files: list.map((f) => f.name), mode });
    setInfos([]);
    setMapping([]);
    setRules([]);

    const out: Draft[] = [];
    const notes: string[] = [];
    let aiDown: AiError | null = null;
    const kinds = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      setReading({ label: aiConfigured && !aiDown ? `La IA está leyendo la foto ${i + 1} de ${list.length}…` : 'Preparando las fotos…', done: i, total: list.length });
      if (aiConfigured && !aiDown) {
        try {
          const r = await withTimeout(readPhoto(file, file.name, mode, hints), 90_000);
          if (gen !== generation.current) return;
          kinds.add(r.kind);
          const { drafts: ds, notes: ns } = photoDrafts(r, file, i, mode, { dual: ifx.dual, localCurrency: hints.localCurrency ?? null, rate: ifx.rate });
          notes.push(...ns);
          if (ds.length) out.push(...ds);
          else {
            notes.push(`${file.name}: no se reconoció ningún producto.`);
            if (mode === 'product') out.push(fileNameDraft(file, i));
          }
          continue;
        } catch (e) {
          const err = e instanceof AiError ? e : new AiError('unknown', errorMessage(e));
          if (['not-configured', 'app-check', 'not-enabled', 'billing', 'quota', 'network'].includes(err.kind)) aiDown = err;
          else notes.push(`${file.name}: ${err.message}`);
        }
      }
      if (mode === 'product') out.push(fileNameDraft(file, i));
    }
    if (gen !== generation.current) return;
    // Una foto que este navegador no sabe abrir (HEIC en Chrome/Windows) sirve para que la IA la lea,
    // pero guardada como imagen del producto no se vería: se importa sin foto y se avisa.
    for (const d of out) {
      if (!d.image) continue;
      const ok = await createImageBitmap(d.image.blob).then(
        (b) => {
          b.close();
          return true;
        },
        () => false
      );
      if (!ok) {
        notes.push(`${d.image.name}: este navegador no puede convertir la foto (¿HEIC?), así que el producto se importará sin imagen.`);
        d.image = null;
      }
    }
    setReading(null);
    if (aiDown) setAi({ state: 'error', message: `IA no disponible: ${aiDown.message}${mode === 'product' ? ' Se usó el nombre de cada archivo.' : ''}` });
    else if (aiConfigured) {
      const read = out.filter((d) => d.fromAi).length;
      setAi({ state: 'done', message: `La IA leyó ${formatNumber(read)} ${read === 1 ? 'producto' : 'productos'} de ${list.length === 1 ? 'la foto' : `${list.length} fotos`}. Revisa nombres y precios antes de importar.` });
    }
    if (!out.length) {
      toast.error(aiDown ? aiDown.message : 'No encontramos productos en las fotos. Prueba con una foto más nítida y de frente.');
      setStep('pick');
      return;
    }
    // Facturas: lo normal es sumar la mercancía a lo que ya hay.
    if (kinds.has('factura')) setOptions((o) => ({ ...o, existing: 'update', stockMode: 'add' }));
    setNotices(notes);
    setDrafts(out);
    setStep('review');
  };

  const onFiles = (files: File[]) => {
    const tableFile = files.find(isTableFile);
    if (tableFile && !files.some(isImageFile)) {
      void loadTableFile(tableFile);
      return;
    }
    if (files.some(isImageFile)) {
      if (pickMode === 'file') setPickMode('photos');
      void loadPhotos(files);
      return;
    }
    toast.error('Formato no admitido. Usa Excel (.xlsx), CSV o fotos.');
  };

  /* ---------- Columnas ---------- */

  const changeColumn = (index: number, target: Target) => {
    setMapping((prev) =>
      prev.map((m, i) => {
        if (i === index) {
          const header = infos[i]?.header ?? '';
          return { target, source: 'user', rateLike: target === 'exento' && /iva|impuesto|alicuota|tax/i.test(header) && !/exent/i.test(header) };
        }
        // Cada campo en una sola columna: la que lo tenía pasa a "No importar".
        return target !== 'ignorar' && m.target === target ? { target: 'ignorar', source: 'user' } : m;
      })
    );
  };

  const missing = missingRequired(mapping, { dual: ifx.dual });

  /* ---------- Revisión ---------- */

  const renameCategory = async (name: string) => {
    const input = await prompt({
      title: `Renombrar «${name}»`,
      message: 'Se aplicará a todos los productos de esta importación con esa categoría. Si escribes una categoría que ya existe, se unen.',
      inputLabel: 'Nombre de la categoría',
      defaultValue: name,
      required: true,
      confirmLabel: 'Aplicar',
      tone: 'primary'
    });
    if (input === null) return;
    const next = tidyCategory(input);
    if (!next || next === name) return;
    setOptions((o) => {
      const renames = { ...o.renames };
      // Renombres encadenados: lo que antes iba a "name" ahora va a "next".
      for (const [k, v] of Object.entries(renames)) if (categoryKey(v) === categoryKey(name)) renames[k] = next;
      renames[categoryKey(name)] = next;
      return { ...o, renames };
    });
  };

  const editRow = (id: string, values: DraftValues) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...values } }));
  const resetRow = (id: string) =>
    setEdits((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });
  const toggleExclude = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const aiCategoryCount = useMemo(() => drafts.filter((d) => d.aiCategory && !cellText(d.values.categoria)).length, [drafts]);
  const hasStockValues = useMemo(() => drafts.some((d) => d.values.stock !== undefined), [drafts]);

  const reset = () => {
    generation.current++;
    setStep('pick');
    setSource(null);
    setDrafts([]);
    setNotices([]);
    setReading(null);
    setAi({ state: aiConfigured ? 'idle' : 'off' });
  };

  /* ---------- Guardar ---------- */

  const sourceLabel = source?.kind === 'table' ? `${source.src.format === 'xlsx' ? 'Excel' : 'CSV'} «${source.src.fileName}»` : source?.kind === 'photos' ? 'fotos' : 'archivo';

  const runImport = async () => {
    if (!toImport) return;
    if (!online) {
      toast.error('Necesitas conexión a internet para importar productos.');
      return;
    }
    const items: ImportItem[] = [];
    for (const r of validation.rows) {
      const link = cellText(r.values.imagen);
      const linkImage = !r.draft.image && /^https?:\/\//i.test(link) ? { imageUrl: link, imagePath: null } : {};
      if (r.status === 'new') items.push({ kind: 'create', input: { ...r.input, ...linkImage }, image: r.draft.image?.blob ?? null });
      else if (r.status === 'update' && r.existing) {
        items.push({
          kind: 'update',
          product: r.existing,
          patch: { ...r.patch, ...linkImage },
          stockDelta: r.stockDelta,
          stockMode: options.stockMode === 'add' ? 'add' : 'set',
          image: r.draft.image?.blob ?? null
        });
      }
    }
    const newCategories = validation.categories.filter((c) => c.isNew).map((c) => c.name);
    cancelRef.current = false;
    setProgress({ done: 0, total: items.length });
    setStep('saving');
    try {
      const res = await importCatalog(businessId, actor, items, { source: sourceLabel, onProgress: setProgress, isCancelled: () => cancelRef.current });
      // Las categorías nuevas se registran en la lista del negocio (si se puede; si no, aparecen igual desde los productos).
      if (newCategories.length && can('settings') && (res.created || res.updated)) {
        await saveCategories(businessId, [...business.categories, ...newCategories]).catch((e) => console.warn('No se pudieron registrar las categorías', e));
      }
      setResult(res);
      setSummary({ newCategories, errors: validation.counts.error });
      setStep('done');
    } catch (e) {
      toast.error(errorMessage(e));
      setStep('review');
    } finally {
      setProgress(null);
    }
  };

  /* ---------- Render ---------- */

  const sourceLine =
    source?.kind === 'table' && table ? (
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 text-label-lg text-on-surface">
          <FileSpreadsheet className="size-[18px] shrink-0 text-secondary" />
          <span className="truncate">{source.src.fileName}</span>
          {table.images.size > 0 && (
            <Badge size="xs" tone="info" icon={Camera}>
              {formatNumber(table.images.size)} fotos
            </Badge>
          )}
        </span>
        <span className="text-body-sm text-on-surface-variant">
          {table.sheet ? `Hoja «${table.sheet}» · ` : ''}
          {formatNumber(table.rows.length)} filas · encabezados en la fila {table.headerLine}
        </span>
      </div>
    ) : source?.kind === 'photos' ? (
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 text-label-lg text-on-surface">
          <Camera className="size-[18px] shrink-0 text-secondary" />
          {source.files.length === 1 ? source.files[0] : `${source.files.length} fotos`}
        </span>
        <span className="text-body-sm text-on-surface-variant">{source.mode === 'list' ? 'Lista, factura o catálogo' : 'Una foto por producto'}</span>
      </div>
    ) : null;

  const busy = step === 'reading' || step === 'saving';
  const title =
    step === 'columns' ? 'Revisa las columnas' : step === 'review' ? 'Revisa antes de importar' : step === 'done' ? 'Importación terminada' : 'Importar productos';
  const subtitle =
    step === 'pick'
      ? 'Desde Excel (con fotos), CSV o fotos de tu lista o factura. Revisas todo antes de guardar.'
      : step === 'columns'
        ? 'Dinos qué dato trae cada columna de tu archivo.'
        : step === 'review'
          ? 'Corrige lo que haga falta: nada se guarda hasta que confirmes.'
          : undefined;

  const footer =
    step === 'pick' ? (
      <Button variant="ghost" onClick={onClose}>
        Cancelar
      </Button>
    ) : step === 'reading' ? (
      <Button variant="ghost" onClick={reset}>
        Cancelar
      </Button>
    ) : step === 'columns' ? (
      <>
        <Button variant="ghost" icon={ArrowLeft} onClick={reset} className="sm:mr-auto">
          Elegir otro archivo
        </Button>
        <Button icon={CircleCheck} disabled={missing.length > 0} onClick={() => table && goReview(table, mapping, infos, rules)}>
          Continuar
        </Button>
      </>
    ) : step === 'review' ? (
      <>
        <Button variant="ghost" onClick={onClose} className="sm:mr-auto">
          Cancelar
        </Button>
        <Button variant="secondary" icon={RefreshCw} onClick={reset}>
          {source?.kind === 'photos' ? 'Otras fotos' : 'Otro archivo'}
        </Button>
        <Button icon={CircleCheck} onClick={runImport} disabled={!toImport || !online} title={!online ? 'Sin conexión' : undefined}>
          {toImport
            ? validation.counts.update && validation.counts.new
              ? `Importar ${formatNumber(validation.counts.new)} y actualizar ${formatNumber(validation.counts.update)}`
              : validation.counts.update
                ? `Actualizar ${formatNumber(validation.counts.update)} ${validation.counts.update === 1 ? 'producto' : 'productos'}`
                : `Importar ${formatNumber(validation.counts.new)} ${validation.counts.new === 1 ? 'producto' : 'productos'}`
            : 'Importar'}
        </Button>
      </>
    ) : step === 'saving' ? (
      <Button variant="ghost" icon={Ban} onClick={() => (cancelRef.current = true)}>
        Detener
      </Button>
    ) : (
      <>
        <Button variant="secondary" icon={RefreshCw} onClick={reset} className="sm:mr-auto">
          Importar más
        </Button>
        <Button onClick={onClose}>Cerrar</Button>
      </>
    );

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!busy}
      size={step === 'review' ? '2xl' : 'xl'}
      icon={FileUp}
      iconTone="secondary"
      title={title}
      subtitle={subtitle}
      badge={
        aiConfigured && step !== 'done' ? (
          <Badge size="xs" tone="violet" icon={Sparkles}>
            Con IA
          </Badge>
        ) : undefined
      }
      footer={footer}
    >
      {step === 'pick' && (
        <PickStep
          mode={pickMode}
          onMode={setPickMode}
          photoMode={photoMode}
          onPhotoMode={setPhotoMode}
          onFiles={onFiles}
          aiReady={aiConfigured}
          csvOptions={csvOptions}
          onTemplate={() => downloadImportTemplate(csvOptions)}
        />
      )}

      {step === 'reading' && (
        <div className="flex flex-col items-center gap-4 py-12 text-center" role="status">
          <span className="flex size-14 items-center justify-center rounded-full bg-violet-50 text-violet-600">
            <Sparkles className="size-7 animate-pulse" />
          </span>
          <p className="text-body-lg text-on-surface">{reading?.label ?? 'Leyendo…'}</p>
          {reading?.total ? <ProgressBar value={reading.done ?? 0} max={reading.total} className="w-64" /> : null}
          <p className="max-w-md text-body-sm text-on-surface-variant">Nada se guarda todavía: primero vas a revisar el resultado.</p>
        </div>
      )}

      {step === 'columns' && source?.kind === 'table' && table && (
        <ColumnsStep
          table={table}
          tables={source.src.tables}
          tableIndex={source.tableIndex}
          onTable={(i) => {
            setStep('reading');
            void openTable(source.src, i);
          }}
          infos={infos}
          mapping={mapping}
          onChange={changeColumn}
          fields={fields}
          missing={missing}
          dual={ifx.dual}
          taxName={ifx.taxName}
        />
      )}

      {step === 'review' && (
        <ReviewStep
          source={sourceLine}
          onAdjustColumns={source?.kind === 'table' ? () => setStep('columns') : undefined}
          result={validation}
          options={options}
          onOptions={(patch) => setOptions((o) => ({ ...o, ...patch }))}
          defaultMargin={business.settings.minMarginPct > 0 && business.settings.minMarginPct < 95 ? business.settings.minMarginPct : 30}
          hasStockValues={hasStockValues}
          aiCategoryCount={aiCategoryCount}
          ai={ai}
          onAiRetry={source?.kind === 'table' ? () => classifyRest(drafts, rules, generation.current) : undefined}
          onSuggestCategories={aiConfigured ? () => classifyRest(drafts, rules, generation.current) : undefined}
          onRenameCategory={renameCategory}
          edits={edits}
          onEdit={editRow}
          onResetEdit={resetRow}
          excluded={excluded}
          onToggleExclude={toggleExclude}
          notices={notices}
          money={money}
          local={ifx.local}
          formatLocal={(bs) => ifx.formatLocal(bs)}
          rateLabel={`${ifx.sourceLabel} · ${ifx.rateText}`}
          categories={categories}
          dual={ifx.dual}
          online={online}
        />
      )}

      {step === 'saving' && progress && (
        <div className="flex flex-col items-center gap-4 py-12 text-center" role="status">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary-fixed/40 text-primary">
            <FileUp className="size-7 animate-pulse" />
          </span>
          <p className="text-body-lg text-on-surface tnum">
            {progress.uploading
              ? `Subiendo fotos… ${formatNumber(progress.uploading.done)} de ${formatNumber(progress.uploading.total)}`
              : `Guardando productos… ${formatNumber(progress.done)} de ${formatNumber(progress.total)}`}
          </p>
          <ProgressBar value={progress.done} max={Math.max(1, progress.total)} className="w-72" />
          <p className="max-w-md text-body-sm text-on-surface-variant">
            No cierres esta ventana. Si la detienes, lo guardado hasta ese momento se queda.
          </p>
        </div>
      )}

      {step === 'done' && result && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CircleCheck className="size-8" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-headline-md text-on-surface">
              {result.created ? `${formatNumber(result.created)} ${result.created === 1 ? 'producto nuevo' : 'productos nuevos'}` : ''}
              {result.created && result.updated ? ' y ' : ''}
              {result.updated ? `${formatNumber(result.updated)} ${result.updated === 1 ? 'actualizado' : 'actualizados'}` : ''}
              {!result.created && !result.updated ? 'No se guardó ningún producto' : ''}
            </p>
            {result.cancelled && <p className="text-body-md text-amber-800">Detuviste la importación: lo anterior quedó guardado y el resto no se importó.</p>}
            {!!summary?.newCategories.length && (result.created > 0 || result.updated > 0) && (
              <p className="text-body-md text-on-surface-variant">Categorías nuevas: {summary.newCategories.join(', ')}.</p>
            )}
          </div>
          {result.imageFailures.length > 0 && (
            <p className="flex max-w-lg items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-body-sm text-amber-900">
              <ImageOff className="mt-px size-4 shrink-0" />
              <span>
                No se pudo subir la foto de {formatNumber(result.imageFailures.length)} producto(s) (se guardaron sin ella):{' '}
                {result.imageFailures.slice(0, 8).join(', ')}
                {result.imageFailures.length > 8 ? '…' : ''}
              </span>
            </p>
          )}
          {!!summary?.errors && (
            <p className="flex max-w-lg items-start gap-2 text-left text-body-sm text-on-surface-variant">
              <TriangleAlert className="mt-px size-4 shrink-0 text-amber-600" />
              {formatNumber(summary.errors)} fila(s) con errores no se importaron. Corrígelas en tu archivo y vuelve a importarlo: los productos ya
              guardados se reconocerán y no se duplicarán.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
