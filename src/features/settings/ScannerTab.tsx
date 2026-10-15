import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Bluetooth,
  Check,
  CircleCheck,
  CircleX,
  CornerDownLeft,
  Eraser,
  Keyboard,
  Lightbulb,
  ScanBarcode,
  Timer,
  Usb,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { formatNumber, formatTime } from '@/lib/format';
import { beep, cn, normalize } from '@/lib/utils';
import type { Product } from '@/types';
import { Badge, Button, Input, ProductThumb, StatusDot, StockBadge } from '@/components/ui';
import type { SettingsTabId } from './settingsState';
import { SettingsCard } from './SettingsUI';

/** Por debajo de este promedio entre teclas consideramos que fue un lector (los humanos rara vez bajan de ~60 ms). */
const SCANNER_MS_PER_CHAR = 35;

const SYMBOLOGIES = [
  { code: 'EAN-13', hint: 'Abarrotes y productos de consumo (13 dígitos)' },
  { code: 'UPC-A', hint: 'Productos de EE. UU. y Canadá (12 dígitos)' },
  { code: 'Code 128', hint: 'Alfanumérico: SKU internos y etiquetas propias' },
  { code: 'QR', hint: 'Requiere lector 2D (imager)' }
];

interface ScanResult {
  id: number;
  code: string;
  product: Product | null;
  matchedBy: 'barcode' | 'sku' | null;
  totalMs: number;
  msPerChar: number;
  source: 'scanner' | 'manual';
  at: Date;
}

export function ScannerTab({ onNavigate }: { onNavigate: (tab: SettingsTabId) => void }) {
  const { business, money } = useActiveBusiness();
  const { products, findByCode, loading } = useCatalog();
  const scanBeep = business.settings.scanBeep;

  const inputRef = useRef<HTMLInputElement>(null);
  const firstKeyAt = useRef<number | null>(null);
  const idRef = useRef(0);
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const last = history[0] ?? null;

  const coverage = useMemo(() => {
    const active = products.filter((p) => p.active !== false);
    return { active: active.length, withBarcode: active.filter((p) => (p.barcode ?? '').trim()).length };
  }, [products]);

  const submit = () => {
    const code = value.trim();
    const started = firstKeyAt.current;
    firstKeyAt.current = null;
    setValue('');
    if (!code) return;

    const totalMs = started === null ? 0 : Math.max(0, Math.round(performance.now() - started));
    const msPerChar = code.length > 1 ? totalMs / (code.length - 1) : totalMs;
    const source: ScanResult['source'] = code.length >= 4 && msPerChar < SCANNER_MS_PER_CHAR ? 'scanner' : 'manual';
    const product = findByCode(code) ?? null;
    const matchedBy: ScanResult['matchedBy'] = product ?(product.barcode && normalize(product.barcode) === normalize(code) ? 'barcode' : 'sku') : null;

    if (scanBeep) {
      if (product) beep();
      else beep(330, 160);
    }

    setHistory((h) => [{ id: ++idRef.current, code, product, matchedBy, totalMs, msPerChar, source, at: new Date() }, ...h].slice(0, 8));
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      {/* Consola de prueba */}
      <div className="flex flex-col gap-5 lg:col-span-7 lg:gap-6">
        <SettingsCard
          icon={ScanBarcode}
          title="Consola de prueba de lectura"
          subtitle="Escanea un producto para comprobar que tu lector funciona y que el código está registrado."
          badge={
            <Badge tone={focused ? 'primary' : 'neutral'}>
              <StatusDot tone={focused ? 'success' : 'neutral'} pulse={focused} />
              {focused ? 'Esperando escaneo…' : 'En pausa'}
            </Badge>
          }
        >
          <div className="flex flex-col gap-3 rounded-xl bg-surface-container p-4">
            <div className="relative">
              <Input
                ref={inputRef}
                icon={ScanBarcode}
                inputSize="lg"
                autoFocus
                value={value}
                placeholder="Escanea o escribe un código"
                aria-label="Código a probar"
                autoComplete="off"
                spellCheck={false}
                className="text-data-mono tnum"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (!e.target.value) firstKeyAt.current = null;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submit();
                    return;
                  }
                  if (e.key.length === 1 && firstKeyAt.current === null) firstKeyAt.current = performance.now();
                }}
                suffix={
                  <span className="hidden items-center gap-1 rounded bg-surface-container px-1.5 py-0.5 text-[11px] font-semibold text-on-surface-variant sm:inline-flex">
                    <CornerDownLeft className="size-3" /> Enter
                  </span>
                }
              />
            </div>
            {!focused && (
              <button type="button" onClick={() => inputRef.current?.focus()} className="self-start text-body-sm font-semibold text-secondary hover:underline">
                Haz clic aquí para activar la consola y vuelve a escanear
              </button>
            )}

            {last ? <ResultCard result={last} money={money} /> : <p className="text-body-sm text-on-surface-variant">Aún no hay lecturas. El resultado aparecerá aquí al presionar Enter.</p>}
          </div>

          {history.length > 1 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-label-md text-on-surface">Lecturas recientes</span>
                <Button size="sm" variant="ghost" icon={Eraser} onClick={() => setHistory([])}>
                  Limpiar
                </Button>
              </div>
              <ul className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200/80">
                {history.slice(1).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-body-sm">
                    {r.product ? <CircleCheck className="size-4 shrink-0 text-primary" /> : <CircleX className="size-4 shrink-0 text-error" />}
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-data-mono text-on-surface tnum">{r.code}</span>
                      <span className="text-on-surface-variant"> · {r.product ? r.product.name : 'No encontrado'}</span>
                    </span>
                    <span className="shrink-0 text-on-surface-variant tnum">{formatNumber(r.totalMs, 'es-MX', 0)} ms</span>
                    <span className="hidden shrink-0 text-on-surface-variant sm:inline tnum">{formatTime(r.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
              {scanBeep ? <Volume2 className="size-5 shrink-0 text-primary" /> : <VolumeX className="size-5 shrink-0 text-on-surface-variant" />}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-label-md text-on-surface">Sonido al escanear: {scanBeep ? 'activado' : 'desactivado'}</span>
                <button type="button" onClick={() => onNavigate('reglas')} className="self-start text-body-sm font-semibold text-secondary hover:underline">
                  Cambiar en Reglas de inventario
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
              <ScanBarcode className="size-5 shrink-0 text-primary" />
              <div className="flex min-w-0 flex-col">
                <span className="text-label-md text-on-surface tnum">
                  {loading ? '…' : `${formatNumber(coverage.withBarcode)} de ${formatNumber(coverage.active)}`} productos con código
                </span>
                <span className="text-body-sm text-on-surface-variant">Los demás se pueden buscar por SKU o nombre.</span>
              </div>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          icon={ScanBarcode}
          iconTone="secondary"
          title="Simbologías soportadas"
          subtitle="Nabux recibe el texto que entrega el lector y lo busca por código de barras o SKU exacto."
        >
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SYMBOLOGIES.map((s) => (
              <li key={s.code} className="flex flex-col items-start gap-1.5 rounded-xl bg-surface-container-low p-3">
                <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-label-sm text-on-primary shadow-card">
                  <Check className="size-3.5" />
                  {s.code}
                </span>
                <span className="text-body-sm text-on-surface-variant">{s.hint}</span>
              </li>
            ))}
          </ul>
        </SettingsCard>
      </div>

      {/* Guía */}
      <div className="flex flex-col gap-5 lg:col-span-5 lg:gap-6">
        <SettingsCard icon={Usb} title="Cómo funcionan los lectores" subtitle="Lectores USB y Bluetooth, sin instalar nada." badge={<Badge tone="primary">Modo teclado</Badge>}>
          <ol className="flex flex-col gap-3">
            <Step icon={Usb} title="Conecta el lector USB">
              Funciona como un teclado (modo HID): la computadora lo reconoce al instante, sin controladores.
            </Step>
            <Step icon={Bluetooth} title="O empareja uno Bluetooth">
              En celular o tablet, emparéjalo desde los ajustes de Bluetooth en modo HID / teclado.
            </Step>
            <Step icon={Keyboard} title="“Teclea” el código muy rápido">
              Al escanear, el lector escribe los dígitos en el campo activo en pocos milisegundos, mucho más rápido que una persona.
            </Step>
            <Step icon={CornerDownLeft} title="Termina con Enter">
              Configura el sufijo <b>Enter (CR)</b> en el lector; así Nabux agrega el producto al ticket en cuanto lo lees.
            </Step>
          </ol>
        </SettingsCard>

        <SettingsCard icon={Lightbulb} iconTone="tertiary" title="Si algo no funciona">
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body-sm text-on-surface-variant">
            <li>Asegúrate de que el cursor esté en el campo de búsqueda o en esta consola antes de escanear.</li>
            <li>Si aparecen letras o símbolos cambiados, configura el lector con la misma distribución de teclado que tu equipo (Español o EE. UU.).</li>
            <li>Si el código se lee pero dice “No encontrado”, regístralo en el campo “Código de barras” del producto.</li>
            <li>Un tiempo mayor a ~{SCANNER_MS_PER_CHAR} ms por carácter indica tecleo manual o un lector con retardo configurado.</li>
          </ul>
        </SettingsCard>
      </div>
    </div>
  );
}

function Step({ icon: Icon, title, children }: { icon: typeof Usb; title: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-label-lg text-on-surface">{title}</span>
        <span className="text-body-sm text-on-surface-variant">{children}</span>
      </div>
    </li>
  );
}

function ResultCard({ result, money }: { result: ScanResult; money: (n: number) => string }) {
  const { product } = result;
  const isScanner = result.source === 'scanner';
  return (
    <div
      key={result.id}
      className={cn(
        'flex animate-pop-in flex-col gap-3 rounded-xl border bg-white p-3 sm:p-4',
        product ? 'border-primary/30' : 'border-red-200'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn('inline-flex items-center gap-1.5 text-label-md', product ? 'text-primary' : 'text-error')}>
          {product ? <CircleCheck className="size-4" /> : <CircleX className="size-4" />}
          {product ? `Encontrado por ${result.matchedBy === 'barcode' ? 'código de barras' : 'SKU'}` : 'Código no encontrado'}
        </span>
        <span className="inline-flex items-center gap-2">
          <Badge tone={isScanner ? 'success' : 'warning'} icon={isScanner ? ScanBarcode : Keyboard}>
            {isScanner ? 'Lector' : 'Tecleo manual'}
          </Badge>
          <span className="inline-flex items-center gap-1 text-label-md text-on-surface tnum">
            <Timer className="size-4 text-on-surface-variant" />
            {formatNumber(result.totalMs, 'es-MX', 0)} ms
          </span>
        </span>
      </div>

      {product ? (
        <div className="flex items-center gap-3">
          <ProductThumb product={product} size="md" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-label-lg text-on-surface">{product.name}</span>
            <span className="truncate text-body-sm text-on-surface-variant tnum">
              SKU {product.sku || '—'}
              {product.barcode ? ` · ${product.barcode}` : ''}
              {product.active === false ? ' · Inactivo' : ''}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-headline-sm text-on-surface tnum">{money(product.salePrice)}</span>
            <StockBadge product={product} />
          </div>
        </div>
      ) : (
        <p className="text-body-sm text-on-surface-variant">
          <span className="text-data-mono text-on-surface tnum">{result.code}</span> no coincide con el código de barras ni con el SKU de ningún producto.
        </p>
      )}

      <p className="text-body-sm text-on-surface-variant tnum">
        {result.code.length} caracteres en {formatNumber(result.totalMs, 'es-MX', 0)} ms ({formatNumber(result.msPerChar, 'es-MX', 1)} ms por carácter) · desde la primera tecla hasta Enter.
      </p>
    </div>
  );
}
