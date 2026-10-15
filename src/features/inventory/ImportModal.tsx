import { useRef, useState, type DragEvent } from 'react';
import { Calculator, CircleCheck, CloudUpload, Download, FileSpreadsheet, FileUp, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import { Badge, Button, Modal, Segmented, useToast } from '@/components/ui';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useOnline } from '@/hooks/data';
import { formatNumber } from '@/lib/format';
import { cn, downloadFile, errorMessage } from '@/lib/utils';
import { importProducts } from '@/services/products';
import { LocalLine } from './FxBits';
import { csvColumns, templateCsv, type CsvOptions } from './helpers';
import { buildImportRows, readTextFile, type ImportParseResult, type ImportStatus } from './importCsv';
import { useInventoryFx } from './useInventoryFx';

const PREVIEW_LIMIT = 60;

type View = 'all' | ImportStatus;

const STATUS_BADGE: Record<ImportStatus, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  valid: { label: 'Lista', tone: 'success' },
  skip: { label: 'Se omite', tone: 'warning' },
  error: { label: 'Con error', tone: 'danger' }
};

/** Plantilla de importación: con `precio_bs` si el negocio es bimonetario y `exento` en Venezuela. */
export function downloadImportTemplate(opts: CsvOptions = {}) {
  downloadFile('plantilla-productos.csv', templateCsv(opts));
}

export function ImportModal({ onClose }: { onClose: () => void }) {
  const { business, businessId, actor, money } = useActiveBusiness();
  const { products, suppliers, categories } = useCatalog();
  const ifx = useInventoryFx();
  const csvOptions: CsvOptions = { dual: ifx.dual, exempt: ifx.exemptUi };
  const online = useOnline();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportParseResult | null>(null);
  const [view, setView] = useState<View>('all');
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fmt = (n: number) => formatNumber(n, business.locale);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name) && !/csv|text\/plain/.test(file.type)) {
      toast.error('Selecciona un archivo .csv (puedes exportarlo desde Excel o Google Sheets).');
      return;
    }
    setReading(true);
    try {
      const text = await readTextFile(file);
      const parsed = buildImportRows(text, {
        products,
        suppliers,
        categories,
        settings: business.settings,
        dual: ifx.dual,
        rate: ifx.rate,
        exempt: ifx.exemptUi,
        money,
        formatLocal: ifx.formatLocal,
        rateText: `${ifx.sourceLabel} ${ifx.rateText}`
      });
      setFileName(file.name);
      setResult(parsed);
      setView(parsed.counts.error > 0 ? 'error' : 'all');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setReading(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const validRows = result?.rows.filter((r) => r.status === 'valid') ?? [];

  const runImport = async () => {
    if (!validRows.length) return;
    if (!online) {
      // La importación escribe en lotes secuenciales: sin conexión quedaría a medias.
      toast.error('Necesitas conexión a internet para importar productos.');
      return;
    }
    setImporting(true);
    try {
      await importProducts(
        businessId,
        actor,
        validRows.map((r) => r.input)
      );
      toast.success(validRows.length === 1 ? 'Se importó 1 producto.' : `Se importaron ${fmt(validRows.length)} productos.`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
      setImporting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setFileName(null);
    setView('all');
  };

  const shown = (result?.rows ?? []).filter((r) => view === 'all' || r.status === view);

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!importing}
      size="xl"
      icon={FileUp}
      iconTone="secondary"
      title="Importar productos desde CSV"
      subtitle="Carga tu catálogo de una sola vez. Revisa la vista previa antes de confirmar."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={importing} className="sm:mr-auto">
            Cancelar
          </Button>
          {result && (
            <Button variant="secondary" icon={RefreshCw} onClick={reset} disabled={importing}>
              Elegir otro archivo
            </Button>
          )}
          <Button icon={CircleCheck} onClick={runImport} loading={importing} disabled={!validRows.length || !online} title={!online ? 'Sin conexión' : undefined}>
            {validRows.length ? `Importar ${fmt(validRows.length)} ${validRows.length === 1 ? 'producto' : 'productos'}` : 'Importar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {!result ? (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn('rounded-xl transition-colors', dragging && 'bg-primary-fixed/20 ring-2 ring-primary')}
            >
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={reading}
                className="group flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant/70 bg-surface-container-low px-4 py-10 text-center transition-colors hover:border-primary disabled:opacity-60"
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors group-hover:text-primary">
                  {reading ? <RefreshCw className="size-6 animate-spin" /> : <CloudUpload className="size-6" />}
                </span>
                <span className="text-body-md text-on-surface-variant">
                  <span className="text-label-lg text-primary">Haz clic para elegir tu archivo CSV</span> o arrástralo aquí
                </span>
                <span className="text-body-sm text-on-surface-variant/80">Separado por comas o punto y coma, con encabezados en la primera fila.</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary-fixed text-secondary">
                  <FileSpreadsheet className="size-5" />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-label-lg text-on-surface">¿Primera vez? Usa la plantilla</span>
                  <span className="text-body-sm text-on-surface-variant">
                    Solo <b>nombre</b> y <b>precio</b> son obligatorios. Si falta el SKU lo generamos; el proveedor se vincula por nombre. Los SKU que ya existen se omiten.
                    {ifx.dual && (
                      <>
                        {' '}
                        Los precios van en <b>$</b>; si solo tienes el precio en bolívares, usa <b>precio_bs</b> y lo convertimos con la tasa actual.
                      </>
                    )}
                    {ifx.exemptUi && (
                      <>
                        {' '}
                        En <b>exento</b> escribe <b>si</b> o <b>no</b> (también 1/0, x).
                      </>
                    )}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {csvColumns(csvOptions).map((h) => (
                      <code key={h} className="rounded bg-surface-container px-1.5 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                        {h}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
              <Button variant="secondary" size="sm" icon={Download} onClick={() => downloadImportTemplate(csvOptions)} className="self-start">
                Descargar plantilla
              </Button>
            </div>
          </>
        ) : result.missing.length ? (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" />
            <div className="flex flex-col gap-1">
              <span className="text-label-lg">No pudimos leer «{fileName}»</span>
              <span className="text-body-sm">
                {result.rows.length === 0 && result.detected.length === 0 && result.ignored.length === 0
                  ? 'El archivo está vacío.'
                  : `Faltan columnas obligatorias: ${result.missing.join(', ')}. Revisa los encabezados o descarga la plantilla.`}
              </span>
              <Button variant="secondary" size="sm" icon={Download} onClick={() => downloadImportTemplate(csvOptions)} className="mt-2 self-start">
                Descargar plantilla
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-label-lg text-on-surface">
                <FileSpreadsheet className="size-[18px] text-secondary" />
                {fileName}
              </span>
              <span className="text-body-sm text-on-surface-variant">
                {fmt(result.rows.length)} filas · columnas detectadas: {result.detected.join(', ')}
                {result.ignored.length > 0 && ` · se ignoran: ${result.ignored.join(', ')}`}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['valid', 'skip', 'error'] as const).map((s) => (
                <div
                  key={s}
                  className={cn(
                    'flex flex-col rounded-xl border px-3 py-2.5',
                    s === 'valid' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
                    s === 'skip' && 'border-amber-200 bg-amber-50 text-amber-800',
                    s === 'error' && 'border-red-200 bg-red-50 text-red-800'
                  )}
                >
                  <span className="text-headline-md tnum">{fmt(result.counts[s])}</span>
                  <span className="text-body-sm">{s === 'valid' ? 'Listas para importar' : s === 'skip' ? 'Omitidas (SKU existente)' : 'Con errores'}</span>
                </div>
              ))}
            </div>

            {result.converted > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-body-sm text-amber-900" role="status">
                <Calculator className="mt-px size-4 shrink-0 text-amber-600" aria-hidden />
                <span>
                  {result.converted === 1 ? '1 precio venía' : `${fmt(result.converted)} precios venían`} solo en bolívares y se
                  {result.converted === 1 ? ' convirtió' : ' convirtieron'} a $ con la tasa de hoy (
                  <b className="tnum">
                    {ifx.sourceLabel} · {ifx.rateText}
                  </b>
                  ). Revisa la columna Precio antes de importar: el precio se guarda en $.
                </span>
              </p>
            )}

            {result.counts.error > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-body-sm text-on-surface-variant">
                <Info className="mt-px size-4 shrink-0 text-secondary" />
                Las filas con errores no se importarán. Corrígelas en tu archivo y vuelve a cargarlo si las necesitas.
              </p>
            )}

            {!online && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-body-sm text-amber-800" role="status">
                <TriangleAlert className="mt-px size-4 shrink-0" />
                Estás sin conexión. Podrás importar en cuanto se restablezca.
              </p>
            )}

            <Segmented
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: 'all', label: `Todas (${result.rows.length})` },
                { value: 'valid', label: `Listas (${result.counts.valid})` },
                { value: 'skip', label: `Omitidas (${result.counts.skip})` },
                { value: 'error', label: `Errores (${result.counts.error})` }
              ]}
              className="no-scrollbar max-w-full self-start overflow-x-auto"
            />

            <div className="max-h-[42vh] overflow-auto rounded-xl border border-slate-200/80 scrollbar-thin">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="h-9 px-3 text-label-sm text-slate-500 uppercase">Fila</th>
                    <th className="h-9 px-3 text-label-sm text-slate-500 uppercase">Producto</th>
                    <th className="h-9 px-3 text-label-sm text-slate-500 uppercase">Categoría</th>
                    <th className="h-9 px-3 text-right text-label-sm text-slate-500 uppercase">Precio</th>
                    <th className="h-9 px-3 text-right text-label-sm text-slate-500 uppercase">Stock</th>
                    <th className="h-9 px-3 text-label-sm text-slate-500 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, PREVIEW_LIMIT).map((r) => (
                    <tr key={r.line} className={cn('border-b border-slate-100 align-top last:border-0', r.status === 'error' && 'bg-red-50/40')}>
                      <td className="px-3 py-2 text-body-sm text-on-surface-variant tnum">{r.line}</td>
                      <td className="max-w-56 px-3 py-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-label-md text-on-surface">{r.input.name || '—'}</span>
                          {r.input.taxExempt && (
                            <Badge size="xs" tone="info">
                              Exento
                            </Badge>
                          )}
                        </span>
                        <span className="block truncate text-body-sm text-on-surface-variant tnum">
                          {r.input.sku}
                          {r.input.barcode ? ` · ${r.input.barcode}` : ''}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-body-sm text-on-surface">{r.input.category}</td>
                      <td className="px-3 py-2 text-right text-body-sm text-on-surface tnum">
                        {r.input.salePrice > 0 ? (
                          <span className="flex flex-col items-end whitespace-nowrap">
                            <span className={cn(r.fromLocal !== undefined && 'font-semibold text-amber-800')}>{money(r.input.salePrice)}</span>
                            {r.fromLocal !== undefined ? (
                              <span className="text-[11px] leading-4 text-on-surface-variant">desde {ifx.formatLocal(r.fromLocal)}</span>
                            ) : (
                              <LocalLine usd={r.input.salePrice} local={ifx.local} />
                            )}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-body-sm text-on-surface tnum">
                        {fmt(r.input.stock)} <span className="text-on-surface-variant">{r.input.unit}</span>
                      </td>
                      <td className="max-w-64 px-3 py-2">
                        <Badge tone={STATUS_BADGE[r.status].tone} dot size="xs">
                          {STATUS_BADGE[r.status].label}
                        </Badge>
                        {[...r.problems, ...r.notes].length > 0 && (
                          <ul className="mt-1 flex flex-col gap-0.5">
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
                        )}
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-body-md text-on-surface-variant">
                        No hay filas en esta vista.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {shown.length > PREVIEW_LIMIT && (
              <span className="text-body-sm text-on-surface-variant">
                Mostrando las primeras {PREVIEW_LIMIT} de {fmt(shown.length)} filas.
              </span>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
