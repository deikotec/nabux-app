import { CirclePause, CloudOff, Printer, ScanBarcode, Wallet, Wifi } from 'lucide-react';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CashSession } from '@/types';
import { RateChip } from './RateControls';

interface StatusStripProps {
  scannerReady: boolean;
  onFocusScanner: () => void;
  session: CashSession | null;
  cashLoading: boolean;
  onCashClick: () => void;
  /** Negocios con varias cajas: nombre de la caja de este equipo (null si aún no se eligió). */
  registerName?: string | null;
  /** Negocios con varias cajas: cambiar de caja. */
  onSwitchRegister?: () => void;
  /** Uid de quien usa el POS (para decir "abierta por Luis" si la abrió otra persona). */
  meUid?: string;
  online: boolean;
  autoPrint: boolean;
  onToggleAutoPrint: () => void;
  /** Modo bimonetario: muestra la tasa vigente. */
  showRate?: boolean;
}

const SHORTCUTS: { key: string; label: string; primary?: boolean; wide?: boolean }[] = [
  { key: 'F2', label: 'Buscar' },
  { key: 'F6', label: 'Pago', wide: true },
  { key: 'F8', label: 'Espera' },
  { key: 'F9', label: 'Descuento' },
  { key: 'F10', label: 'Cobrar', primary: true },
  { key: 'Esc', label: 'Limpiar' }
];

function Sep() {
  return (
    <span aria-hidden className="hidden text-on-surface-variant/40 sm:inline">
      •
    </span>
  );
}

/** Franja de estado operativo: lector, caja, tasa de cambio, red, impresión y atajos. */
export function StatusStrip({
  scannerReady,
  onFocusScanner,
  session,
  cashLoading,
  onCashClick,
  registerName,
  onSwitchRegister,
  meUid,
  online,
  autoPrint,
  onToggleAutoPrint,
  showRate
}: StatusStripProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-surface-container px-4 py-2 shadow-card">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          type="button"
          onClick={onFocusScanner}
          className="flex items-center gap-2 rounded-md py-0.5"
          aria-label={scannerReady ? 'Lector listo para escanear' : 'Lector en pausa: activar entrada rápida'}
          title={scannerReady ? 'El lector escribe en la entrada rápida' : 'Haz clic o presiona F2 para volver a escanear'}
        >
          <span className="relative flex size-2.5">
            {scannerReady && <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />}
            <span className={cn('relative inline-flex size-2.5 rounded-full', scannerReady ? 'bg-primary' : 'bg-amber-500')} />
          </span>
          <span className={cn('text-label-sm tracking-wider uppercase', scannerReady ? 'text-primary' : 'text-amber-800')}>
            {scannerReady ? 'Lector listo' : 'Lector en pausa'}
            {!scannerReady && <span className="pointer-coarse:hidden"> · F2</span>}
          </span>
        </button>

        <span aria-hidden className="hidden text-on-surface-variant/40 2xl:inline">
          •
        </span>
        <span className="hidden items-center gap-1.5 text-data-mono text-on-surface-variant 2xl:inline-flex" title="Lector USB o Bluetooth en modo teclado">
          <ScanBarcode className="size-[18px] text-primary" />
          Escáner USB / BT
        </span>
        <Sep />

        <button
          type="button"
          onClick={onCashClick}
          disabled={cashLoading}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md text-label-md transition-colors',
            session ? 'text-on-surface-variant hover:text-on-surface' : 'text-amber-800 hover:text-amber-900'
          )}
          title={session ? 'Hacer corte de caja' : 'Abrir caja'}
        >
          <Wallet className={cn('size-[18px]', session ? 'text-secondary' : 'text-amber-600')} />
          {cashLoading
            ? 'Verificando caja…'
            : session
              ? `${session.registerName && registerName ? session.registerName : 'Caja'} abierta · ${formatTime(session.openedAt)}${
                  meUid && session.openedBy !== meUid ? ` · ${session.openedByName.split(' ')[0]}` : ''
                }`
              : onSwitchRegister && !registerName
                ? 'Elegir caja'
                : `${registerName ?? 'Caja'} cerrada · Abrir`}
        </button>
        {onSwitchRegister && registerName && (
          <button type="button" onClick={onSwitchRegister} className="rounded-md text-label-md text-primary hover:underline">
            Cambiar caja
          </button>
        )}

        {showRate && (
          <>
            <Sep />
            <RateChip />
          </>
        )}

        {/* En línea ya se ve en la barra lateral: aquí solo se destaca si se pierde la conexión. */}
        <span aria-hidden className={cn('text-on-surface-variant/40', online ? 'hidden 2xl:inline' : 'hidden sm:inline')}>
          •
        </span>
        <span
          className={cn(
            'items-center gap-1.5 text-label-md',
            online ? 'hidden text-on-surface-variant 2xl:inline-flex' : 'inline-flex text-amber-800'
          )}
        >
          {online ? <Wifi className="size-[18px] text-primary" /> : <CloudOff className="size-[18px] text-amber-600" />}
          {online ? 'En línea' : 'Sin conexión · se sincroniza al volver'}
        </span>

        <Sep />
        <button
          type="button"
          onClick={onToggleAutoPrint}
          aria-pressed={autoPrint}
          className="inline-flex items-center gap-1.5 rounded-md text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
          title="Cambiar impresión automática del ticket al cobrar (este equipo)"
        >
          <Printer className={cn('size-[18px]', autoPrint ? 'text-secondary' : 'text-slate-400')} />
          {autoPrint ? 'Impresión automática' : 'Impresión manual'}
        </button>
      </div>

      <div className="hidden items-center gap-1.5 rounded-lg bg-surface-container-lowest px-2 py-1 shadow-card md:flex pointer-coarse:hidden!" aria-label="Atajos de teclado">
        <span className="hidden text-label-sm text-on-surface-variant 2xl:inline">Atajos:</span>
        {SHORTCUTS.map((s) => (
          <kbd
            key={s.key}
            className={cn(
              'rounded px-1.5 py-0.5 font-sans text-[11px] font-bold whitespace-nowrap tnum',
              s.primary ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface',
              s.key === 'Esc' && 'hidden xl:inline',
              s.wide && 'hidden 2xl:inline'
            )}
          >
            {s.key} {s.label}
          </kbd>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Celular                                                             */
/* ------------------------------------------------------------------ */

interface MobileStatusRowProps {
  /** Modo bimonetario: muestra la tasa vigente. */
  showRate?: boolean;
  heldCount: number;
  onHeldClick: () => void;
  autoPrint: boolean;
  onToggleAutoPrint: () => void;
}

/** Celular: fila mínima con la tasa, los tickets en espera y la impresión (la caja va en la barra superior). */
export function MobileStatusRow({ showRate, heldCount, onHeldClick, autoPrint, onToggleAutoPrint }: MobileStatusRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showRate && (
        <div className="min-w-0 rounded-full bg-surface-container px-2.5 py-1">
          <RateChip />
        </div>
      )}
      {heldCount > 0 && (
        <button
          type="button"
          onClick={onHeldClick}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-tertiary-fixed px-2.5 py-1 text-label-md text-on-tertiary-fixed-variant transition-colors active:bg-tertiary-fixed-dim"
        >
          <CirclePause className="size-4" />
          {heldCount} en espera
        </button>
      )}
      <button
        type="button"
        onClick={onToggleAutoPrint}
        aria-pressed={autoPrint}
        title="Cambiar impresión automática del ticket al cobrar (este equipo)"
        className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-label-md text-on-surface-variant transition-colors active:bg-surface-container"
      >
        <Printer className={cn('size-4', autoPrint ? 'text-secondary' : 'text-slate-400')} />
        <span className="sr-only">Impresión</span>
        {autoPrint ? 'Auto' : 'Manual'}
      </button>
    </div>
  );
}
