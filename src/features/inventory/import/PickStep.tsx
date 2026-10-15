import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Camera, CloudUpload, Download, FileSpreadsheet, Images, Info, ScanText, Sparkles, type LucideIcon } from 'lucide-react';
import { Badge, Button, Segmented } from '@/components/ui';
import { cn } from '@/lib/utils';
import { csvColumns, type CsvOptions } from '../helpers';
import type { PhotoMode } from './aiImport';
import { MAX_PHOTOS, PHOTO_ACCEPT, TABLE_ACCEPT } from './sources';

export type PickMode = 'file' | 'photos';

function DropZone({ accept, multiple, onFiles, title, hint, icon: Icon = CloudUpload }: { accept: string; multiple?: boolean; onFiles: (files: File[]) => void; title: ReactNode; hint: ReactNode; icon?: LucideIcon }) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) onFiles(files);
  };
  return (
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
        onClick={() => ref.current?.click()}
        className="group flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant/70 bg-surface-container-low px-4 py-9 text-center transition-colors hover:border-primary"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors group-hover:text-primary">
          <Icon className="size-6" />
        </span>
        <span className="text-body-md text-on-surface-variant">
          <span className="text-label-lg text-primary">{title}</span> o arrástralo aquí
        </span>
        <span className="max-w-xl text-body-sm text-on-surface-variant/80">{hint}</span>
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}

function OptionCard({ selected, disabled, onClick, icon: Icon, title, children, badge }: { selected: boolean; disabled?: boolean; onClick: () => void; icon: LucideIcon; title: string; children: ReactNode; badge?: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        selected ? 'border-primary bg-primary-fixed/15 ring-1 ring-primary' : 'border-slate-200 bg-white hover:border-slate-300'
      )}
    >
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', selected ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant')}>
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2 text-label-lg text-on-surface">
          {title}
          {badge}
        </span>
        <span className="text-body-sm text-on-surface-variant">{children}</span>
      </span>
    </button>
  );
}

export function PickStep({
  mode,
  onMode,
  photoMode,
  onPhotoMode,
  onFiles,
  aiReady,
  csvOptions,
  onTemplate
}: {
  mode: PickMode;
  onMode: (m: PickMode) => void;
  photoMode: PhotoMode;
  onPhotoMode: (m: PhotoMode) => void;
  onFiles: (files: File[]) => void;
  aiReady: boolean;
  csvOptions: CsvOptions;
  onTemplate: () => void;
}) {
  const aiBadge = (
    <Badge size="xs" tone={aiReady ? 'violet' : 'neutral'} icon={Sparkles}>
      {aiReady ? 'IA' : 'Requiere IA'}
    </Badge>
  );

  return (
    <div className="flex flex-col gap-5">
      <Segmented
        value={mode}
        onChange={onMode}
        options={[
          { value: 'file', label: 'Excel o CSV', icon: FileSpreadsheet },
          { value: 'photos', label: 'Fotos', icon: Camera }
        ]}
        className="self-start"
      />

      {mode === 'file' ? (
        <>
          <DropZone
            accept={TABLE_ACCEPT}
            onFiles={onFiles}
            title="Haz clic para elegir tu Excel o CSV"
            hint={
              <>
                Excel (.xlsx), también con las <b>fotos de los productos</b> dentro, o CSV. Puede traer títulos, logos o totales: encontramos la tabla, las
                columnas y las categorías por ti.
              </>
            }
          />

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary-fixed text-secondary">
                <FileSpreadsheet className="size-5" />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-label-lg text-on-surface">Usa tu propia lista o nuestra plantilla</span>
                <span className="text-body-sm text-on-surface-variant">
                  Solo hacen falta el <b>nombre</b> y el <b>precio</b> (o el costo). Los productos que ya existen —mismo SKU, código de barras o nombre— se
                  pueden omitir o actualizar. Para fotos por enlace agrega una columna <b>imagen</b>.
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
            <Button variant="secondary" size="sm" icon={Download} onClick={onTemplate} className="self-start">
              Descargar plantilla
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Qué muestran las fotos">
            <OptionCard selected={photoMode === 'list'} disabled={!aiReady} onClick={() => onPhotoMode('list')} icon={ScanText} title="Lista, factura o catálogo" badge={aiBadge}>
              Una foto de tu lista de precios, de la factura de un proveedor o de un catálogo. La IA lee cada producto con su precio, costo y cantidad.
            </OptionCard>
            <OptionCard
              selected={photoMode === 'product'}
              onClick={() => onPhotoMode('product')}
              icon={Images}
              title="Una foto por producto"
              badge={aiReady ? aiBadge : undefined}
            >
              {aiReady
                ? 'La IA reconoce nombre, marca y categoría, y la foto queda como imagen del producto.'
                : 'La foto queda como imagen del producto y el nombre del archivo se usa como nombre, SKU o código de barras.'}{' '}
              También sirve para ponerle foto a productos que ya tienes.
            </OptionCard>
          </div>
          <DropZone
            accept={PHOTO_ACCEPT}
            multiple
            icon={Camera}
            onFiles={onFiles}
            title={photoMode === 'list' ? 'Elige las fotos de tu lista o factura' : 'Elige las fotos de tus productos'}
            hint={`JPG, PNG, WEBP o HEIC · hasta ${MAX_PHOTOS} fotos por vez. Mejor con buena luz, de frente y sin reflejos.`}
          />
        </>
      )}

      {!aiReady && (
        <p className="flex items-start gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-body-sm text-on-surface-variant">
          <Info className="mt-px size-4 shrink-0 text-secondary" />
          La IA (columnas y categorías sugeridas, lectura de fotos de listas y facturas) no está activada en este negocio. La importación funciona igual con
          reglas automáticas.
        </p>
      )}
    </div>
  );
}
