import { ArrowLeftRight, CalendarDays, CalendarRange, ChartLine, ChevronDown, Coins, FileSpreadsheet, Package, Share, TriangleAlert, Wallet } from 'lucide-react';
import { Button, Input, MenuItem, PageHeader, Popover, Segmented, StatusDot, type TabOption } from '@/components/ui';
import { hhmm } from '../format';
import { cn } from '@/lib/utils';

export type ReportPreset = 'today' | '7d' | 'month' | '30d' | 'custom';
export type ExportKind = 'sales' | 'products' | 'payments' | 'cash' | 'daily' | 'rates';

export interface CustomRangeInput {
  from: string;
  to: string;
}

const PRESET_OPTIONS: TabOption<ReportPreset>[] = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: 'month', label: 'Este mes' },
  { value: '30d', label: '30 días' },
  { value: 'custom', label: 'Rango', icon: CalendarRange }
];

const EXPORTS: { kind: ExportKind; label: string; icon: typeof Package; dualOnly?: boolean }[] = [
  { kind: 'sales', label: 'Ventas detalladas', icon: FileSpreadsheet },
  { kind: 'products', label: 'Rendimiento por producto', icon: Package },
  { kind: 'payments', label: 'Formas de pago', icon: Coins },
  { kind: 'cash', label: 'Cortes de caja', icon: Wallet },
  { kind: 'daily', label: 'Resumen por día', icon: CalendarDays },
  { kind: 'rates', label: 'Historial de tasas', icon: ChartLine, dualOnly: true }
];

/** Tasa vigente que se muestra en el encabezado (solo modo bimonetario). */
export interface HeaderRate {
  /** "BCV (oficial) · 41,00 Bs/$", o null si no hay tasa cargada. */
  text: string | null;
  stale: boolean;
}

export function ReportsHeader({
  preset,
  onPresetChange,
  custom,
  onCustomChange,
  maxDate,
  compare,
  onCompareChange,
  now,
  rangeLabel,
  onExport,
  rate
}: {
  preset: ReportPreset;
  onPresetChange: (p: ReportPreset) => void;
  custom: CustomRangeInput;
  onCustomChange: (c: CustomRangeInput) => void;
  /** yyyy-mm-dd de hoy (límite de los selectores de fecha). */
  maxDate: string;
  compare: boolean;
  onCompareChange: (v: boolean) => void;
  now: Date;
  rangeLabel: string;
  onExport: (kind: ExportKind) => void;
  /** Solo en modo bimonetario (también habilita la exportación del historial de tasas). */
  rate?: HeaderRate | null;
}) {
  return (
    <PageHeader
      eyebrow={
        <span className="flex flex-wrap items-center gap-2 tracking-normal normal-case">
          <span className="rounded-full bg-primary-fixed px-2.5 py-0.5 text-label-sm tracking-wider text-on-primary-fixed uppercase">Módulo gerencial</span>
          <span className="inline-flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant">
            <StatusDot pulse />
            Corte en tiempo real • <span className="tnum">{hhmm(now)}</span> hrs
          </span>
          {rate &&
            (rate.text ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-label-sm tnum',
                  rate.stale ? 'bg-amber-50 text-amber-800' : 'bg-surface-container text-on-surface-variant'
                )}
                title={
                  rate.stale
                    ? 'La tasa BCV no es de hoy: actualízala para cobrar al día. Las ventas pasadas conservan su propia tasa.'
                    : 'Tasa que usa hoy el punto de venta. Las ventas pasadas conservan la tasa con que se cobraron.'
                }
              >
                {rate.stale && <TriangleAlert className="size-3" />}
                {rate.text}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-label-sm text-amber-800">
                <TriangleAlert className="size-3" /> Sin tasa de cambio cargada
              </span>
            ))}
        </span>
      }
      title="Reportes & Analíticas de Negocio"
      description="Monitorea márgenes, flujo de caja por turno y ticket promedio para tomar decisiones basadas en datos."
      actions={
        <div className="flex w-full min-w-0 flex-col gap-2 lg:w-auto lg:items-end">
          <div className="no-scrollbar -mx-1 max-w-full overflow-x-auto px-1">
            {/* En móvil, versión compacta para que las 5 opciones quepan a 360 px. */}
            <div className="sm:hidden">
              <Segmented options={PRESET_OPTIONS} value={preset} onChange={onPresetChange} size="sm" className="shadow-card" />
            </div>
            <div className="hidden sm:block">
              <Segmented options={PRESET_OPTIONS} value={preset} onChange={onPresetChange} className="shadow-card" />
            </div>
          </div>

          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-low p-2 animate-fade-in">
              <label className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
                Desde
                <Input
                  type="date"
                  inputSize="sm"
                  className="w-[150px] tnum"
                  value={custom.from}
                  max={custom.to || maxDate}
                  onChange={(e) => e.target.value && onCustomChange({ ...custom, from: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
                Hasta
                <Input
                  type="date"
                  inputSize="sm"
                  className="w-[150px] tnum"
                  value={custom.to}
                  min={custom.from}
                  max={maxDate}
                  onChange={(e) => e.target.value && onCustomChange({ ...custom, to: e.target.value })}
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <span className="mr-auto text-body-sm text-on-surface-variant lg:mr-1">
              Período: <b className="font-semibold text-on-surface">{rangeLabel}</b>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={compare}
              onClick={() => onCompareChange(!compare)}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-label-md shadow-card transition-colors',
                compare ? 'border-primary/30 bg-primary-fixed/25 text-on-primary-fixed-variant' : 'border-slate-200 bg-white text-on-surface-variant hover:bg-slate-50'
              )}
            >
              <ArrowLeftRight className="size-4 text-primary" />
              vs período anterior
              <span className={cn('relative h-4 w-7 shrink-0 rounded-full transition-colors', compare ? 'bg-primary' : 'bg-slate-300')}>
                <span className={cn('absolute top-0.5 left-0 size-3 rounded-full bg-white shadow transition-transform', compare ? 'translate-x-3.5' : 'translate-x-0.5')} />
              </span>
            </button>
            <Popover
              panelClassName="max-sm:right-auto max-sm:left-0"
              trigger={({ open, toggle }) => (
                <Button icon={Share} iconRight={ChevronDown} onClick={toggle} aria-expanded={open} className="rounded-xl">
                  Exportar reporte
                </Button>
              )}
            >
              {(close) => (
                <div className="flex flex-col">
                  <span className="px-3 pt-1.5 pb-1 text-label-sm tracking-wider text-slate-500 uppercase">Descargar en CSV</span>
                  {EXPORTS.filter((x) => !x.dualOnly || rate).map((x) => (
                    <MenuItem
                      key={x.kind}
                      icon={x.icon}
                      hint={<span className="rounded bg-surface-container px-1.5 py-0.5 text-[10px] font-bold text-on-surface-variant">CSV</span>}
                      onClick={() => {
                        close();
                        onExport(x.kind);
                      }}
                    >
                      {x.label}
                    </MenuItem>
                  ))}
                </div>
              )}
            </Popover>
          </div>
        </div>
      }
    />
  );
}
