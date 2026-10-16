import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRightLeft, CircleAlert, PencilLine, RefreshCw, TriangleAlert } from 'lucide-react';
import { RATE_SOURCE_LABELS } from '@/config/app';
import { useBusiness } from '@/contexts/BusinessContext';
import { useFx } from '@/contexts/FxContext';
import { useOnline } from '@/hooks/data';
import { formatDate, formatPercent, formatRelative, toDate } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import { Badge, Button, Card, Skeleton, useToast } from '@/components/ui';
import type { RateSource } from '@/types';
import { bcvDateText, bcvValidityText, rateNumber, usedRateSource } from './fxText';
import { useFxHistory } from './useFxHistory';

const SOURCES: { key: RateSource; label: string; hint: string }[] = [
  { key: 'bcv', label: 'BCV', hint: 'Oficial' },
  { key: 'parallel', label: 'Paralelo', hint: 'Mercado' },
  { key: 'custom', label: 'Propia', hint: 'Del negocio' }
];

/**
 * "Tasa del día" (solo modo bimonetario): BCV, paralelo y tasa propia, destacando la que usa el POS,
 * con vigencia, quién/cuándo la actualizó, aviso si está vieja y acciones para actualizarla.
 */
export function FxRateCard({ onEdit }: { onEdit: () => void }) {
  const fx = useFx();
  const online = useOnline();
  const { can } = useBusiness();
  const toast = useToast();
  const history = useFxHistory(fx.enabled);
  const rates = fx.rates;

  // Variación de la tasa BCV contra la última tasa distinta registrada en el historial.
  const bcvChange = useMemo(() => {
    const cur = rates?.bcv;
    if (!cur) return null;
    const curDate = rates?.bcvDate ?? null;
    // Solo tasas anteriores a la vigente (por fecha de vigencia cuando ambas la tienen).
    const prev = history.data.find((h) => (h.bcv ?? 0) > 0 && h.bcv !== cur && (!curDate || !h.bcvDate || h.bcvDate < curDate));
    if (!prev?.bcv) return null;
    const when = prev.bcvDate ? bcvDateText(prev.bcvDate) : formatDate(prev.createdAt, { day: 'numeric', month: 'short' });
    return { pct: ((cur - prev.bcv) / prev.bcv) * 100, when };
  }, [rates?.bcv, rates?.bcvDate, history.data]);

  if (!fx.enabled) return null;

  const used = usedRateSource(rates, fx.rateSource);
  const fellBack = used !== null && used !== fx.rateSource;
  const updatedAt = toDate(rates?.updatedAt);
  const bcvWhen = bcvDateText(rates?.bcvDate);
  const gap = rates?.bcv && rates.parallel ? (rates.parallel / rates.bcv - 1) * 100 : null;
  const parallelAt = rates?.parallelUpdatedAt ? toDate(rates.parallelUpdatedAt) : null;

  const meta: Record<RateSource, string> = {
    bcv: bcvValidityText(rates?.bcvDate) ?? (rates?.bcv ? 'Sin fecha de vigencia' : 'Sin cargar'),
    parallel: rates?.parallel
      ? [gap !== null ? `Brecha ${formatPercent(gap, 1, true)}` : null, parallelAt ? formatRelative(parallelAt) : null].filter(Boolean).join(' · ') || 'Promedio del mercado'
      : 'Sin cargar',
    custom: rates?.custom ? 'Definida por el negocio' : 'Sin definir'
  };

  const refresh = async () => {
    const before = fx.rates;
    try {
      const r = await fx.refreshFromInternet();
      if (!r.bcv && !r.parallel) {
        toast.warning('El servicio no devolvió tasas. Puedes cargarlas a mano.');
        return;
      }
      const same = r.bcv === (before?.bcv ?? null) && r.parallel === (before?.parallel ?? null);
      toast.success(
        same ? 'Las tasas ya estaban al día.' : `Tasas actualizadas · BCV ${rateNumber(r.bcv)} · Paralelo ${rateNumber(r.parallel)} Bs/$`
      );
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const updatedText = updatedAt
    ? `Actualizada ${formatRelative(updatedAt)} ${rates?.source === 'auto' ? 'desde internet' : rates?.updatedByName ? `por ${rates.updatedByName}` : ''}`.trim()
    : null;

  return (
    <Card padded={false} className="overflow-hidden" aria-labelledby="fx-rate-title">
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-card">
              <ArrowRightLeft className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id="fx-rate-title" className="text-headline-sm text-on-surface">
                Tasa del día
              </h2>
              <p className="text-body-sm text-on-surface-variant">
                El POS cobra con la tasa <b className="font-semibold text-on-surface">{RATE_SOURCE_LABELS[used ?? fx.rateSource]}</b>
                {can('settings') && (
                  <>
                    {' · '}
                    <Link to="/configuracion" className="rounded text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none">
                      Cambiar
                    </Link>
                  </>
                )}
                {updatedText && <span className="block">{updatedText}</span>}
              </p>
            </div>
          </div>
          {fx.canEditRates && (
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <Button
                size="sm"
                variant="secondary"
                icon={RefreshCw}
                loading={fx.refreshing}
                disabled={!online}
                title={online ? undefined : 'Sin conexión'}
                onClick={refresh}
                className="flex-1 sm:flex-none"
              >
                Actualizar desde internet
              </Button>
              <Button size="sm" variant="ghost" icon={PencilLine} onClick={onEdit} className="flex-1 sm:flex-none">
                Editar
              </Button>
            </div>
          )}
        </div>

        {fx.loading ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SOURCES.map((s) => (
              <Skeleton key={s.key} className="h-[76px] w-full" />
            ))}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Tasas de cambio">
            {SOURCES.map((s) => {
              const value = rates?.[s.key] ?? null;
              const inUse = used === s.key;
              return (
                <li
                  key={s.key}
                  className={cn(
                    'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-xl border px-3.5 py-3 sm:grid-cols-1 sm:items-start',
                    inUse ? 'border-primary/40 bg-primary-fixed/20 ring-1 ring-primary/15' : 'border-slate-200/80 bg-surface-container-lowest'
                  )}
                >
                  <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-1.5 text-label-md text-on-surface">
                    {s.label}
                    <span className="truncate font-normal text-on-surface-variant">· {s.hint}</span>
                    {inUse && (
                      <Badge tone="primary" size="xs" className="ml-auto sm:ml-1">
                        En uso
                      </Badge>
                    )}
                  </span>
                  <span className="col-start-2 row-span-2 row-start-1 text-right whitespace-nowrap sm:col-start-1 sm:row-span-1 sm:row-start-2 sm:text-left">
                    <span className={cn('text-headline-md tnum', value ? 'text-on-surface' : 'text-on-surface-variant')}>{rateNumber(value)}</span>
                    {value ? <span className="ml-1 text-body-sm text-on-surface-variant">Bs/$</span> : null}
                  </span>
                  <span className="col-start-1 row-start-2 min-w-0 text-body-sm text-on-surface-variant sm:row-start-3 sm:truncate">
                    {meta[s.key]}
                    {s.key === 'bcv' && bcvChange && (
                      <span className="tnum" title={`Variación respecto a la tasa BCV anterior (${bcvChange.when})`}>
                        {' · '}
                        {bcvChange.pct >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(bcvChange.pct), 2)} vs {bcvChange.when}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!fx.loading && !fx.rate ? (
        <Notice tone="danger" icon={CircleAlert}>
          <b>Aún no hay tasa de cambio.</b> Sin tasa no se puede cobrar en bolívares ni calcular los montos en Bs.{' '}
          {fx.canEditRates ? 'Actualízala desde internet o cárgala a mano.' : 'Pide a un encargado que la cargue.'}
        </Notice>
      ) : !fx.loading && fx.stale ? (
        <Notice tone="warning" icon={TriangleAlert}>
          <b>La tasa BCV puede estar desactualizada</b>
          {bcvWhen ? ` (vigencia ${bcvWhen})` : ''}. {fx.canEditRates ? 'Actualízala antes de cobrar.' : 'Avisa a un encargado para que la actualice.'}
        </Notice>
      ) : fellBack ? (
        <Notice tone="info" icon={CircleAlert}>
          No hay {fx.rateSource === 'parallel' ? 'tasa paralelo' : 'tasa propia'} cargada: el POS está usando la tasa BCV.
        </Notice>
      ) : null}
    </Card>
  );
}

const NOTICE_TONES = {
  danger: 'border-red-200 bg-red-50 text-red-900 [&_svg]:text-red-600',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 [&_svg]:text-amber-600',
  info: 'border-blue-200 bg-blue-50 text-blue-900 [&_svg]:text-blue-600'
} as const;

function Notice({ tone, icon: Icon, children }: { tone: keyof typeof NOTICE_TONES; icon: typeof CircleAlert; children: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-2.5 border-t px-4 py-3 text-body-md sm:px-5', NOTICE_TONES[tone])}>
      <Icon className="mt-0.5 size-[18px] shrink-0" aria-hidden />
      <p>{children}</p>
    </div>
  );
}
