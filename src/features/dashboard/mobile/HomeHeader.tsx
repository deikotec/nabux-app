import { CalendarDays, Check, Download } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCash } from '@/contexts/CashContext';
import { firstName, formatDate, greeting } from '@/lib/format';
import { MenuItem, Popover } from '@/components/ui';
import { Pill, RoundButton } from '@/components/mobile';
import { PRESET_COPY, type DashPreset } from '../useDashboardMetrics';

/** "Mañana (08:00–16:00)" → "Turno mañana"; "Turno completo" y los personalizados quedan igual. */
function shiftLabel(shift?: string): string | null {
  const base = (shift ?? '').replace(/\s*\(.*\)\s*$/, '').trim();
  if (!base) return null;
  if (/^turno\b/i.test(base)) return base;
  return /^(mañana|tarde|noche)$/i.test(base) ? `Turno ${base.toLowerCase()}` : base;
}

/** Saludo, turno y caja; el botón redondo elige el período de las métricas y descarga el resumen. */
export function HomeHeader({ preset, onPreset, onDownload }: { preset: DashPreset; onPreset: (p: DashPreset) => void; onDownload: () => void }) {
  const { member, can } = useActiveBusiness();
  const { session, loading, register, multiRegister, requestOpen } = useCash();
  const name = firstName(member.displayName);
  const shift = shiftLabel(member.shift);
  const today = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'short' });

  let cash = null;
  if (can('pos')) {
    if (loading) cash = <span className="text-body-sm text-on-surface-variant">Verificando caja…</span>;
    else if (session) cash = <span className="truncate text-body-sm text-on-surface-variant">{session.registerName ?? 'Caja'} abierta</span>;
    else
      cash = (
        <button type="button" onClick={requestOpen} className="truncate text-body-sm font-semibold text-amber-800 underline-offset-2 hover:underline">
          {multiRegister && !register ? 'Elegir caja' : `${multiRegister ? register?.name : 'Caja'} cerrada · Abrir`}
        </button>
      );
  }

  return (
    <section className="flex items-center justify-between gap-3 pt-2" aria-label="Resumen del turno">
      <div className="flex min-w-0 flex-col">
        <h1 className="text-headline-lg-mobile tracking-tight text-on-surface">
          ¡{greeting()}
          {name ? `, ${name}` : ''}!
        </h1>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {shift ? (
            <Pill tone="primary" dot pulse className="shadow-card">
              {shift}
            </Pill>
          ) : (
            <Pill tone="muted">{today.charAt(0).toUpperCase() + today.slice(1)}</Pill>
          )}
          {cash}
        </div>
      </div>

      <Popover
        panelClassName="w-60"
        trigger={({ open, toggle }) => <RoundButton icon={CalendarDays} label="Período de las métricas" onClick={toggle} aria-expanded={open} />}
      >
        {(close) => (
          <div>
            <p className="px-3 pt-1 pb-1.5 text-label-sm tracking-wider text-outline uppercase">Ver métricas de</p>
            {(Object.keys(PRESET_COPY) as DashPreset[]).map((p) => (
              <MenuItem
                key={p}
                active={p === preset}
                hint={p === preset ? <Check className="size-4" /> : undefined}
                onClick={() => {
                  close();
                  onPreset(p);
                }}
              >
                {PRESET_COPY[p].label}
              </MenuItem>
            ))}
            <div className="my-1 h-px bg-slate-100" role="separator" />
            <MenuItem
              icon={Download}
              onClick={() => {
                close();
                onDownload();
              }}
            >
              Descargar resumen (CSV)
            </MenuItem>
          </div>
        )}
      </Popover>
    </section>
  );
}
