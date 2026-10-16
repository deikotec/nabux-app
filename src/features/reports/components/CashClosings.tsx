import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, CircleArrowUp, CircleCheck, Download, Landmark, TriangleAlert } from 'lucide-react';
import { Avatar, Badge, Button, Pagination, Select, Skeleton, Table, TD, TH, THead, TR, type Tone } from '@/components/ui';
import { sameDay, addDays } from '@/lib/dates';
import { toDate } from '@/lib/format';
import { hhmm, plural, type ReportFx } from '../format';
import { cn } from '@/lib/utils';
import type { CashSession } from '@/types';
import {
  AUDIT_LABEL,
  auditStatus,
  sessionAuditStatus,
  sessionCashiers,
  sessionHasLocal,
  sessionMethodBreakdown,
  shortFolio,
  type AuditStatus
} from '../analytics';
import { InlineEmpty, SectionCard, SectionHeader } from './Section';

const PAGE_SIZE = 6;

const AUDIT_TONE: Record<AuditStatus, Tone> = { balanced: 'success', short: 'danger', over: 'info', mixed: 'warning' };

const num = (v: unknown) => Number(v) || 0;

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
  return `${s.registerName ? `${s.registerName} · ` : ''}Turno ${hhmm(s.openedAt)}–${hhmm(s.closedAt)}`;
}

function Difference({ value, format }: { value: number | null | undefined; format: (n: number) => string }) {
  const status = auditStatus(value);
  const v = num(value);
  if (status === 'balanced')
    return (
      <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-primary tnum">
        <CircleCheck className="size-4" /> {format(0)}
      </span>
    );
  if (status === 'short')
    return (
      <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-error tnum" title="Faltante: se declaró menos efectivo del esperado">
        <TriangleAlert className="size-4" /> −{format(Math.abs(v))}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-secondary tnum" title="Sobrante: se declaró más efectivo del esperado">
      <CircleArrowUp className="size-4" /> +{format(v)}
    </span>
  );
}

/** Texto del desglose por forma de pago (tooltip nativo de la fila). */
function breakdownTitle(s: CashSession, fx: ReportFx) {
  const lines = sessionMethodBreakdown(s, fx.baseCurrency);
  if (!lines.length) return undefined;
  return `Desglose por forma de pago:\n${lines.map((m) => `• ${m.label}: ${fx.moneyIn(m.amount, m.currency)}${m.count ? ` (${m.count})` : ''}`).join('\n')}`;
}

function SessionDetail({ s, money, fx }: { s: CashSession; money: (n: number | null | undefined) => string; fx: ReportFx }) {
  const hasLocal = sessionHasLocal(s);
  const localCur = s.localCurrency || fx.localCurrency;
  const fmtLocal = (n: number | null | undefined) => fx.moneyIn(n, localCur);
  const lines = sessionMethodBreakdown(s, fx.baseCurrency);
  const igtf = num(s.totals?.igtf);
  const rows: { label: string; base: number | null | undefined; local: number | null | undefined }[] = [
    { label: 'Fondo inicial', base: s.openingFloat, local: s.openingFloatLocal },
    { label: 'Efectivo esperado', base: s.expectedCash, local: s.expectedCashLocal },
    { label: 'Efectivo declarado', base: s.declaredCash, local: s.declaredCashLocal }
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-label-sm tracking-wider text-on-surface-variant uppercase">Efectivo en caja</span>
        <table className="w-full text-body-sm">
          <thead>
            <tr className="text-on-surface-variant">
              <th className="pb-1 text-left font-normal" />
              <th className="pb-1 pl-3 text-right font-semibold">{fx.baseCurrency}</th>
              {hasLocal && <th className="pb-1 pl-3 text-right font-semibold">{localCur === 'VES' ? 'Bs.' : localCur}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-slate-200/60">
                <td className="py-1 text-on-surface-variant">{r.label}</td>
                <td className="py-1 pl-3 text-right whitespace-nowrap text-on-surface tnum">{money(r.base)}</td>
                {hasLocal && <td className="py-1 pl-3 text-right whitespace-nowrap text-on-surface tnum">{r.local == null ? '—' : fmtLocal(r.local)}</td>}
              </tr>
            ))}
            <tr className="border-t border-slate-200/60">
              <td className="py-1 text-on-surface-variant">Diferencia</td>
              <td className="py-1 pl-3 text-right whitespace-nowrap">
                <Difference value={s.difference} format={(n) => money(n)} />
              </td>
              {hasLocal && (
                <td className="py-1 pl-3 text-right whitespace-nowrap">{s.differenceLocal == null ? '—' : <Difference value={s.differenceLocal} format={(n) => fmtLocal(n)} />}</td>
              )}
            </tr>
          </tbody>
        </table>
        {s.notes ? <p className="text-body-sm text-on-surface-variant">Notas: {s.notes}</p> : null}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-label-sm tracking-wider text-on-surface-variant uppercase">Desglose por forma de pago</span>
        {lines.length ? (
          <ul className="flex flex-col gap-1">
            {lines.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 text-body-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-on-surface">{m.label}</span>
                  {m.count > 0 && <span className="shrink-0 text-on-surface-variant tnum">· {plural(m.count, 'pago')}</span>}
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="text-on-surface tnum">{fx.moneyIn(m.amount, m.currency)}</span>
                  {m.currency !== fx.baseCurrency && m.amountBase ? <span className="text-[11px] text-on-surface-variant tnum">cubre {money(m.amountBase)}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-on-surface-variant">Este corte no guardó el detalle por forma de pago.</p>
        )}
        {igtf > 0 && (
          <p className="border-t border-slate-200/60 pt-1.5 text-body-sm text-on-surface-variant tnum">
            IGTF cobrado en el turno: <b className="font-semibold text-on-surface">{money(igtf)}</b>
          </p>
        )}
      </div>
    </div>
  );
}

export function CashClosings({
  sessions,
  loading,
  money,
  onExport,
  fx
}: {
  sessions: CashSession[];
  loading: boolean;
  money: (n: number | null | undefined) => string;
  onExport: () => void;
  fx: ReportFx;
}) {
  const [cashier, setCashier] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const cashiers = useMemo(() => sessionCashiers(sessions), [sessions]);
  const filtered = useMemo(() => (cashier ? sessions.filter((s) => s.openedBy === cashier) : sessions), [sessions, cashier]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const anyLocal = useMemo(() => fx.dual || sessions.some(sessionHasLocal), [fx.dual, sessions]);

  const shortCount = filtered.filter((s) => auditStatus(s.difference) === 'short' || (s.differenceLocal != null && auditStatus(s.differenceLocal) === 'short')).length;
  const netDiff = filtered.reduce((a, s) => a + num(s.difference), 0);
  const localSessions = filtered.filter((s) => s.differenceLocal != null);
  const netDiffLocal = localSessions.reduce((a, s) => a + num(s.differenceLocal), 0);
  const localCur = localSessions[0]?.localCurrency || fx.localCurrency;
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  const signed = (v: number, format: (n: number) => string) => (
    <b className={cn('font-semibold tnum', v <= -0.005 ? 'text-error' : v >= 0.005 ? 'text-secondary' : 'text-primary')}>
      {v <= -0.005 ? '−' : v >= 0.005 ? '+' : ''}
      {format(Math.abs(v))}
    </b>
  );

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
        subtitle={anyLocal ? 'Efectivo en dólares y en bolívares declarado contra el esperado por cada turno' : 'Efectivo físico declarado contra el esperado por cada turno'}
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
          {(shortCount > 0 || Math.abs(netDiff) >= 0.01 || Math.abs(netDiffLocal) >= 0.01) && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
              {shortCount > 0 && (
                <Badge tone="danger" icon={TriangleAlert}>
                  {plural(shortCount, 'corte con faltante', 'cortes con faltante')}
                </Badge>
              )}
              <span>
                Diferencia neta acumulada: {signed(netDiff, (n) => money(n))}
                {localSessions.length > 0 && <> · {signed(netDiffLocal, (n) => fx.moneyIn(n, localCur))}</>}
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
                <TH align="center">Auditoría</TH>
                <TH className="w-10 pr-5">
                  <span className="sr-only">Detalle</span>
                </TH>
              </THead>
              <tbody>
                {rows.map((s) => {
                  const status = sessionAuditStatus(s);
                  const hasLocal = sessionHasLocal(s);
                  const lc = s.localCurrency || fx.localCurrency;
                  const igtf = num(s.totals?.igtf);
                  const open = openId === s.id;
                  return (
                    <Fragment key={s.id}>
                      <TR
                        highlight={status === 'short' ? 'danger' : status === 'mixed' ? 'warning' : undefined}
                        onClick={() => toggle(s.id)}
                        title={breakdownTitle(s, fx)}
                        className={cn(open && 'border-b-0')}
                      >
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
                          <span className="block font-semibold whitespace-nowrap text-on-surface">{money(s.declaredCash)}</span>
                          {hasLocal && <span className="block font-semibold whitespace-nowrap text-on-surface">{s.declaredCashLocal == null ? '—' : fx.moneyIn(s.declaredCashLocal, lc)}</span>}
                          <span className="block text-body-sm whitespace-nowrap text-on-surface-variant">
                            Esperado {money(s.expectedCash)}
                            {hasLocal && s.expectedCashLocal != null ? ` · ${fx.moneyIn(s.expectedCashLocal, lc)}` : ''}
                          </span>
                        </TD>
                        <TD align="right">
                          <span className="font-semibold text-on-surface">{money(s.totals?.total)}</span>
                          <span className="block text-body-sm whitespace-nowrap text-on-surface-variant">
                            {plural(s.totals?.count ?? 0, 'ticket')}{igtf > 0 ? ` · IGTF ${money(igtf)}` : ''}
                          </span>
                        </TD>
                        <TD align="right">
                          <div className="flex flex-col items-end gap-0.5">
                            <Difference value={s.difference} format={(n) => money(n)} />
                            {hasLocal && s.differenceLocal != null && <Difference value={s.differenceLocal} format={(n) => fx.moneyIn(n, lc)} />}
                          </div>
                        </TD>
                        <TD align="center">
                          <Badge tone={AUDIT_TONE[status]} dot size="md">
                            {AUDIT_LABEL[status]}
                          </Badge>
                        </TD>
                        <TD className="pr-5">
                          <button
                            type="button"
                            aria-label={open ? 'Ocultar desglose' : 'Ver desglose'}
                            aria-expanded={open}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(s.id);
                            }}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container"
                          >
                            <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
                          </button>
                        </TD>
                      </TR>
                      {open && (
                        <tr className="border-b border-slate-100 bg-surface-container-low/50">
                          <td colSpan={7} className="px-5 py-4">
                            <SessionDetail s={s} money={money} fx={fx} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </Table>
          </div>

          {/* Móvil */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((s) => {
              const status = sessionAuditStatus(s);
              const hasLocal = sessionHasLocal(s);
              const lc = s.localCurrency || fx.localCurrency;
              const open = openId === s.id;
              return (
                <li
                  key={s.id}
                  className={cn(
                    'rounded-xl border p-3',
                    status === 'short' ? 'border-red-200 bg-red-50/40' : status === 'mixed' ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200/80'
                  )}
                >
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
                    <div className="flex min-w-0 flex-col">
                      <dt className="text-on-surface-variant">Declarado</dt>
                      <dd className="font-semibold text-on-surface tnum">{money(s.declaredCash)}</dd>
                      {hasLocal && <dd className="font-semibold break-all text-on-surface tnum">{s.declaredCashLocal == null ? '—' : fx.moneyIn(s.declaredCashLocal, lc)}</dd>}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <dt className="text-on-surface-variant">Venta</dt>
                      <dd className="font-semibold text-on-surface tnum">{money(s.totals?.total)}</dd>
                    </div>
                    <div className="flex min-w-0 flex-col items-end">
                      <dt className="text-on-surface-variant">Diferencia</dt>
                      <dd>
                        <Difference value={s.difference} format={(n) => money(n)} />
                      </dd>
                      {hasLocal && s.differenceLocal != null && (
                        <dd>
                          <Difference value={s.differenceLocal} format={(n) => fx.moneyIn(n, lc)} />
                        </dd>
                      )}
                    </div>
                  </dl>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="min-w-0 text-body-sm text-on-surface-variant tnum">
                      {shiftLabel(s)} · esperado {money(s.expectedCash)}
                      {hasLocal && s.expectedCashLocal != null ? ` · ${fx.moneyIn(s.expectedCashLocal, lc)}` : ''}
                    </p>
                    <Button variant="ghost" size="sm" iconRight={ChevronDown} onClick={() => toggle(s.id)} aria-expanded={open} className={cn('shrink-0', open && '[&>svg]:rotate-180')}>
                      Desglose
                    </Button>
                  </div>
                  {open && (
                    <div className="mt-2 rounded-lg bg-white/70 p-3 animate-fade-in">
                      <SessionDetail s={s} money={money} fx={fx} />
                    </div>
                  )}
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
