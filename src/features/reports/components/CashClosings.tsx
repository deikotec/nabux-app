import { useMemo, useState } from 'react';
import { CircleArrowUp, CircleCheck, Download, Landmark, TriangleAlert } from 'lucide-react';
import { Avatar, Badge, Button, Pagination, Select, Skeleton, Table, TD, TH, THead, TR, type Tone } from '@/components/ui';
import { sameDay, addDays } from '@/lib/dates';
import { toDate } from '@/lib/format';
import { hhmm, plural } from '../format';
import { cn } from '@/lib/utils';
import type { CashSession } from '@/types';
import { AUDIT_LABEL, auditStatus, sessionCashiers, shortFolio, type AuditStatus } from '../analytics';
import { InlineEmpty, SectionCard, SectionHeader } from './Section';

const PAGE_SIZE = 6;

const AUDIT_TONE: Record<AuditStatus, Tone> = { balanced: 'success', short: 'danger', over: 'info' };

function closedLabel(s: CashSession) {
  const closed = toDate(s.closedAt);
  if (!closed) return '—';
  const now = new Date();
  const day = sameDay(closed, now)
    ? 'Hoy'
    : sameDay(closed, addDays(now, -1))
      ? 'Ayer'
      : new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', ...(closed.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) }).format(closed);
  return `${day}, ${hhmm(closed)}`;
}

function shiftLabel(s: CashSession) {
  return `Turno ${hhmm(s.openedAt)}–${hhmm(s.closedAt)}`;
}

function Difference({ value, money }: { value: number | null | undefined; money: (n: number | null | undefined) => string }) {
  const status = auditStatus(value);
  const v = Number(value) || 0;
  if (status === 'balanced')
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-primary tnum">
        <CircleCheck className="size-4" /> {money(0)}
      </span>
    );
  if (status === 'short')
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-error tnum" title="Faltante: se declaró menos efectivo del esperado">
        <TriangleAlert className="size-4" /> −{money(Math.abs(v))}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-secondary tnum" title="Sobrante: se declaró más efectivo del esperado">
      <CircleArrowUp className="size-4" /> +{money(v)}
    </span>
  );
}

export function CashClosings({
  sessions,
  loading,
  money,
  onExport
}: {
  sessions: CashSession[];
  loading: boolean;
  money: (n: number | null | undefined) => string;
  onExport: () => void;
}) {
  const [cashier, setCashier] = useState('');
  const [page, setPage] = useState(1);
  const cashiers = useMemo(() => sessionCashiers(sessions), [sessions]);
  const filtered = useMemo(() => (cashier ? sessions.filter((s) => s.openedBy === cashier) : sessions), [sessions, cashier]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const shortCount = filtered.filter((s) => auditStatus(s.difference) === 'short').length;
  const netDiff = filtered.reduce((a, s) => a + (Number(s.difference) || 0), 0);

  return (
    <SectionCard>
      <SectionHeader
        size="lg"
        title="Histórico de cierres de caja (Z)"
        badge={
          <span className="rounded-full bg-surface-container px-2 py-0.5 text-label-sm text-on-surface-variant tnum">
            {sessions.length === 1 ? 'Último cierre' : `Últimos ${plural(sessions.length, 'cierre')}`}
          </span>
        }
        subtitle="Efectivo físico declarado contra el esperado por cada turno"
        actions={
          <>
            <Select
              inputSize="sm"
              aria-label="Filtrar por cajero"
              className="w-48"
              value={cashier}
              onChange={(e) => {
                setCashier(e.target.value);
                setPage(1);
              }}
              placeholder="Todos los cajeros"
              options={cashiers}
            />
            <Button variant="tonal" size="sm" icon={Download} onClick={onExport} disabled={!sessions.length}>
              CSV
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <InlineEmpty icon={Landmark}>
          {sessions.length ? 'Este cajero no tiene cierres en el historial reciente.' : 'Todavía no hay cortes de caja cerrados. Aparecerán aquí al hacer el corte Z de cada turno.'}
        </InlineEmpty>
      ) : (
        <>
          {(shortCount > 0 || Math.abs(netDiff) >= 0.01) && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
              {shortCount > 0 && (
                <Badge tone="danger" icon={TriangleAlert}>
                  {plural(shortCount, 'corte con faltante', 'cortes con faltante')}
                </Badge>
              )}
              <span>
                Diferencia neta acumulada:{' '}
                <b className={cn('font-semibold tnum', netDiff < 0 ? 'text-error' : netDiff > 0 ? 'text-secondary' : 'text-primary')}>
                  {netDiff < 0 ? '−' : netDiff > 0 ? '+' : ''}
                  {money(Math.abs(netDiff))}
                </b>
              </span>
            </div>
          )}

          {/* Escritorio */}
          <div className="-mx-5 hidden md:block">
            <Table>
              <THead>
                <TH className="pl-5">Folio / Fecha</TH>
                <TH>Cajero responsable</TH>
                <TH align="right">Efectivo declarado</TH>
                <TH align="right">Venta registrada</TH>
                <TH align="right">Diferencia</TH>
                <TH align="center" className="pr-5">
                  Auditoría
                </TH>
              </THead>
              <tbody>
                {rows.map((s) => {
                  const status = auditStatus(s.difference);
                  return (
                    <TR key={s.id} highlight={status === 'short' ? 'danger' : undefined}>
                      <TD className="pl-5">
                        <div className="flex flex-col">
                          <span className="text-label-lg text-on-surface tnum">{shortFolio(s.id)}</span>
                          <span className="text-body-sm whitespace-nowrap text-on-surface-variant tnum">
                            {closedLabel(s)} · {shiftLabel(s)}
                          </span>
                        </div>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={s.openedByName} size="sm" />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-label-md text-on-surface">{s.openedByName}</span>
                            {s.closedByName && s.closedBy !== s.openedBy && <span className="truncate text-body-sm text-on-surface-variant">Cerró: {s.closedByName}</span>}
                          </div>
                        </div>
                      </TD>
                      <TD align="right">
                        <span className="font-semibold text-on-surface">{money(s.declaredCash)}</span>
                        <span className="block text-body-sm text-on-surface-variant">Esperado {money(s.expectedCash)}</span>
                      </TD>
                      <TD align="right">
                        <span className="font-semibold text-on-surface">{money(s.totals?.total)}</span>
                        <span className="block text-body-sm text-on-surface-variant">{s.totals?.count ?? 0} tickets</span>
                      </TD>
                      <TD align="right">
                        <Difference value={s.difference} money={money} />
                      </TD>
                      <TD align="center" className="pr-5">
                        <Badge tone={AUDIT_TONE[status]} dot size="md">
                          {AUDIT_LABEL[status]}
                        </Badge>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>

          {/* Móvil */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((s) => {
              const status = auditStatus(s.difference);
              return (
                <li key={s.id} className={cn('rounded-xl border p-3', status === 'short' ? 'border-red-200 bg-red-50/40' : 'border-slate-200/80')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={s.openedByName} size="sm" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-label-lg text-on-surface">{s.openedByName}</span>
                        <span className="text-body-sm text-on-surface-variant tnum">
                          {shortFolio(s.id)} · {closedLabel(s)}
                        </span>
                      </div>
                    </div>
                    <Badge tone={AUDIT_TONE[status]} dot>
                      {AUDIT_LABEL[status]}
                    </Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-body-sm">
                    <div className="flex flex-col">
                      <dt className="text-on-surface-variant">Declarado</dt>
                      <dd className="font-semibold text-on-surface tnum">{money(s.declaredCash)}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-on-surface-variant">Venta</dt>
                      <dd className="font-semibold text-on-surface tnum">{money(s.totals?.total)}</dd>
                    </div>
                    <div className="flex flex-col items-end">
                      <dt className="text-on-surface-variant">Diferencia</dt>
                      <dd>
                        <Difference value={s.difference} money={money} />
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-body-sm text-on-surface-variant tnum">
                    {shiftLabel(s)} · esperado {money(s.expectedCash)}
                  </p>
                </li>
              );
            })}
          </ul>

          <Pagination className="-mx-4 -mb-3 mt-1" page={current} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} label="cierres" />
        </>
      )}
    </SectionCard>
  );
}
