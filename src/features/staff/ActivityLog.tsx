import { useMemo, useState } from 'react';
import { ChevronDown, ScrollText, SearchX, TriangleAlert } from 'lucide-react';
import { addDays, dayKey, sameDay } from '@/lib/dates';
import { formatDate, formatRelative, formatTime, toDate } from '@/lib/format';
import { cn, normalize } from '@/lib/utils';
import type { ActivityLog as ActivityEntry } from '@/types';
import { Button, Card, EmptyState, SearchInput, Segmented, Skeleton } from '@/components/ui';
import { ACTIVITY_GROUPS, activityMeta, type ActivityGroup } from './staffUtils';

interface DayGroup {
  key: string;
  label: string;
  items: ActivityEntry[];
}

function dayLabel(d: Date): string {
  const today = new Date();
  if (sameDay(d, today)) return 'Hoy';
  if (sameDay(d, addDays(today, -1))) return 'Ayer';
  const text = formatDate(d, { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function ActivityLog({
  data,
  loading,
  error,
  limit,
  onLoadMore,
  money,
  online
}: {
  data: ActivityEntry[];
  loading: boolean;
  error: Error | null;
  /** Cuántos movimientos se pidieron (para saber si puede haber más). */
  limit: number;
  onLoadMore: () => void;
  money: (n: number) => string;
  online: boolean;
}) {
  const [group, setGroup] = useState<'all' | ActivityGroup>('all');
  const [query, setQuery] = useState('');

  const days = useMemo<DayGroup[]>(() => {
    const q = normalize(query);
    const map = new Map<string, DayGroup>();
    for (const log of data) {
      const meta = activityMeta(log.type);
      if (group !== 'all' && meta.group !== group) continue;
      if (q && !normalize(`${log.message} ${log.userName} ${meta.label}`).includes(q)) continue;
      const d = toDate(log.createdAt) ?? new Date();
      const key = dayKey(d);
      let g = map.get(key);
      if (!g) {
        g = { key, label: dayLabel(d), items: [] };
        map.set(key, g);
      }
      g.items.push(log);
    }
    return [...map.values()];
  }, [data, group, query]);

  const shown = days.reduce((n, d) => n + d.items.length, 0);
  const mayHaveMore = data.length >= limit;

  return (
    <Card padded={false}>
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-primary">
              <ScrollText className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-headline-md text-on-surface">Bitácora de auditoría</h2>
              <p className="text-body-sm text-on-surface-variant">Registro inmutable de movimientos críticos: nadie puede editarlo ni borrarlo.</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 text-label-md text-on-surface-variant" role="status">
            {online ? 'Sincronizado en tiempo real' : 'Sin conexión · mostrando lo guardado'}
            <span className={cn('size-2 rounded-full', online ? 'animate-pulse bg-primary' : 'bg-amber-500')} aria-hidden />
          </span>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
            <Segmented size="sm" options={ACTIVITY_GROUPS} value={group} onChange={setGroup} />
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar en la bitácora…" className="w-full lg:max-w-xs" />
        </div>
      </div>

      {error ? (
        <EmptyState icon={TriangleAlert} title="No pudimos cargar la bitácora" description="Revisa tu conexión e intenta de nuevo." />
      ) : loading && !data.length ? (
        <div className="flex flex-col gap-3 p-5" aria-busy="true" aria-label="Cargando bitácora">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="hidden h-7 w-14 sm:block" />
              <Skeleton className="size-9 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : !shown ? (
        data.length ? (
          <EmptyState icon={SearchX} title="Sin movimientos con ese filtro" description="Prueba con otro tipo de movimiento u otra búsqueda." />
        ) : (
          <EmptyState icon={ScrollText} title="Aún no hay movimientos" description="Aquí verás ventas, anulaciones, cortes de caja, cambios de inventario y de personal." />
        )
      ) : (
        <div className="flex flex-col gap-6 p-4 sm:p-5">
          {days.map((day) => (
            <section key={day.key} aria-label={day.label} className="flex flex-col gap-2.5">
              <h3 className="sticky top-16 z-10 -mx-1 flex items-center gap-2 bg-white/95 px-1 py-1 text-label-md text-on-surface-variant backdrop-blur-sm">
                {day.label}
                <span className="rounded-full bg-surface-container px-1.5 text-[11px] tnum">{day.items.length}</span>
                <span className="h-px flex-1 bg-slate-100" aria-hidden />
              </h3>
              <ol className="flex flex-col gap-2">
                {day.items.map((log) => (
                  <ActivityItem key={log.id} log={log} money={money} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {!error && data.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row">
          <span className="text-body-sm text-on-surface-variant">
            Mostrando <b className="tnum">{shown}</b> de los <b className="tnum">{data.length}</b> movimientos más recientes
          </span>
          {mayHaveMore && (
            <Button variant="ghost" size="sm" iconRight={ChevronDown} onClick={onLoadMore} loading={loading}>
              Cargar más
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function ActivityItem({ log, money }: { log: ActivityEntry; money: (n: number) => string }) {
  const meta = activityMeta(log.type);
  const Icon = meta.icon;
  const amount = typeof log.amount === 'number' && meta.amount ? log.amount : null;

  let amountNode = null;
  if (amount !== null && meta.amount) {
    if (meta.amount.kind === 'signed') {
      amountNode = (
        <span className={cn('text-label-md tnum', amount < 0 ? 'text-red-700' : 'text-emerald-700')}>
          {amount < 0 ? '−' : '+'}
          {money(Math.abs(amount))}
        </span>
      );
    } else {
      amountNode = (
        <span className="text-label-md text-on-surface tnum">
          <span className="font-normal text-on-surface-variant">{meta.amount.label} </span>
          {money(amount)}
        </span>
      );
    }
  }

  return (
    <li className="flex items-start gap-3 rounded-xl bg-surface-container-low/50 p-3 transition-colors hover:bg-surface-container-low">
      <time
        dateTime={toDate(log.createdAt)?.toISOString()}
        className="mt-1 hidden w-16 shrink-0 rounded-md bg-white px-2 py-1 text-center text-data-mono text-on-surface shadow-card tnum sm:block"
      >
        {formatTime(log.createdAt)}
      </time>
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full ring-1', meta.tone)} aria-hidden>
        <Icon className="size-[18px]" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-label-lg break-words text-on-surface">{log.message}</span>
          <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold text-on-surface-variant ring-1 ring-slate-200">{meta.label}</span>
          {amountNode}
        </div>
        <p className="text-body-sm text-on-surface-variant">
          <span className="sm:hidden tnum">{formatTime(log.createdAt)} · </span>
          Por <b className="font-semibold text-on-surface">{log.userName || 'Usuario'}</b> · {formatRelative(log.createdAt)}
        </p>
      </div>
    </li>
  );
}
