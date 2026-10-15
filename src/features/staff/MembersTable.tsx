import { useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CircleDot, ListFilter, SearchX, TriangleAlert, UserPlus, Users } from 'lucide-react';
import { ROLE_LABELS } from '@/config/app';
import { normalize } from '@/lib/utils';
import type { ActivityLog, CashSession, Invite, Member, Role } from '@/types';
import { Button, Card, EmptyState, Pagination, SearchInput, Skeleton, TD, TH, THead, TR } from '@/components/ui';
import {
  InviteActions,
  InviteDate,
  InviteIdentity,
  InviteStatus,
  LastActivity,
  MemberActions,
  MemberIdentity,
  MemberStatus,
  RoleInfo,
  ShiftInfo
} from './MemberCells';
import type { StaffActions } from './useStaffActions';
import { manageBlock, type StatusFilter } from './staffUtils';

type Row = { kind: 'member'; key: string; member: Member } | { kind: 'invite'; key: string; invite: Invite };

const PAGE_SIZE = 10;
const ROLE_ORDER: Role[] = ['owner', 'admin', 'manager', 'cashier', 'warehouse'];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'suspended', label: 'Suspendidos' },
  { value: 'pending', label: 'Invitaciones pendientes' }
];

export interface MembersTableProps {
  members: Member[];
  invites: Invite[];
  loading: boolean;
  error: Error | null;
  /** Caja abierta por uid (solo si quien mira tiene permiso de reportes). */
  openByUid: Map<string, CashSession>;
  /** Último movimiento de la bitácora por uid. */
  lastActivityByUid: Map<string, ActivityLog>;
  myUid: string;
  iAmAdmin: boolean;
  actions: StaffActions;
  onEdit: (m: Member) => void;
  onInvite: () => void;
}

export function MembersTable({
  members,
  invites,
  loading,
  error,
  openByUid,
  lastActivityByUid,
  myUid,
  iAmAdmin,
  actions,
  onEdit,
  onInvite
}: MembersTableProps) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  const rows = useMemo<Row[]>(() => {
    const q = normalize(query);
    const list: Row[] = [];
    if (status !== 'pending') {
      for (const m of members) {
        if (status === 'active' && m.status === 'suspended') continue;
        if (status === 'suspended' && m.status !== 'suspended') continue;
        if (roleFilter !== 'all' && m.role !== roleFilter) continue;
        if (q && !normalize(`${m.displayName} ${m.email} ${m.phone ?? ''}`).includes(q)) continue;
        list.push({ kind: 'member', key: `m-${m.uid}`, member: m });
      }
    }
    if (status === 'all' || status === 'pending') {
      for (const inv of invites) {
        if (roleFilter !== 'all' && inv.role !== roleFilter) continue;
        if (q && !normalize(`${inv.displayName ?? ''} ${inv.email} ${inv.phone ?? ''}`).includes(q)) continue;
        list.push({ kind: 'invite', key: `i-${inv.id}`, invite: inv });
      }
    }
    return list;
  }, [members, invites, query, roleFilter, status]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const filtered = !!query || roleFilter !== 'all' || status !== 'all';

  const clearFilters = () => {
    setQuery('');
    setRoleFilter('all');
    setStatus('all');
    setPage(1);
  };

  const canCancel = (inv: Invite) => iAmAdmin || inv.role !== 'admin';

  let body: ReactNode;
  if (error) {
    body = <EmptyState icon={TriangleAlert} title="No pudimos cargar el equipo" description="Revisa tu conexión e intenta de nuevo en unos segundos." />;
  } else if (loading) {
    body = (
      <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="Cargando equipo">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="hidden h-6 w-24 rounded-full sm:block" />
          </div>
        ))}
      </div>
    );
  } else if (!rows.length) {
    body = filtered ? (
      <EmptyState
        icon={SearchX}
        title="Nadie coincide con los filtros"
        description="Prueba con otro nombre o correo, o cambia el rol y el estado."
        action={
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        }
      />
    ) : (
      <EmptyState icon={Users} title="Aún no hay colaboradores" description="Invita a tu equipo para que pueda vender o controlar el inventario." />
    );
  } else {
    body = (
      <>
        {/* Escritorio: tabla (sin contenedor con overflow para que los menús no se recorten) */}
        <table className="hidden w-full border-collapse text-left xl:table">
          <caption className="sr-only">Colaboradores e invitaciones pendientes</caption>
          <THead>
            <TH scope="col" className="pl-5">
              Colaborador / contacto
            </TH>
            <TH scope="col">Rol y nivel</TH>
            <TH scope="col" className="hidden 2xl:table-cell">
              Turno
            </TH>
            <TH scope="col">Estado actual</TH>
            <TH scope="col">Última actividad</TH>
            <TH scope="col" align="right" className="pr-5">
              Acciones
            </TH>
          </THead>
          <tbody>
            {visible.map((row) =>
              row.kind === 'member' ? (
                <TR key={row.key} className={row.member.status === 'suspended' ? 'bg-slate-50/60' : undefined}>
                  <TD className="max-w-[300px] pl-5">
                    <MemberIdentity member={row.member} isMe={row.member.uid === myUid} />
                  </TD>
                  <TD className="max-w-[240px]">
                    <RoleInfo role={row.member.role} permissions={row.member.permissions} />
                    <ShiftInfo shift={row.member.shift} className="mt-1.5 2xl:hidden" />
                  </TD>
                  <TD className="hidden 2xl:table-cell">
                    <ShiftInfo shift={row.member.shift} />
                  </TD>
                  <TD>
                    <MemberStatus member={row.member} session={openByUid.get(row.member.uid)} />
                  </TD>
                  <TD className="max-w-[220px]">
                    <LastActivity member={row.member} last={lastActivityByUid.get(row.member.uid)} />
                  </TD>
                  <TD className="pr-5">
                    <MemberActions member={row.member} block={manageBlock(row.member, myUid, iAmAdmin)} actions={actions} onEdit={onEdit} />
                  </TD>
                </TR>
              ) : (
                <TR key={row.key} className="bg-amber-50/30">
                  <TD className="max-w-[300px] pl-5">
                    <InviteIdentity invite={row.invite} />
                  </TD>
                  <TD className="max-w-[240px]">
                    <RoleInfo role={row.invite.role} permissions={row.invite.permissions} />
                    <ShiftInfo shift={row.invite.shift} className="mt-1.5 2xl:hidden" />
                  </TD>
                  <TD className="hidden 2xl:table-cell">
                    <ShiftInfo shift={row.invite.shift} />
                  </TD>
                  <TD>
                    <InviteStatus invite={row.invite} />
                  </TD>
                  <TD className="max-w-[220px]">
                    <InviteDate invite={row.invite} />
                  </TD>
                  <TD className="pr-5">
                    <InviteActions invite={row.invite} canCancel={canCancel(row.invite)} actions={actions} />
                  </TD>
                </TR>
              )
            )}
          </tbody>
        </table>

        {/* Móvil y tablet: tarjetas */}
        <ul className="grid gap-3 p-3 sm:p-4 md:grid-cols-2 xl:hidden">
          {visible.map((row) => (
            <li key={row.key}>
              {row.kind === 'member' ? (
                <MobileCard
                  identity={<MemberIdentity member={row.member} isMe={row.member.uid === myUid} />}
                  status={<MemberStatus member={row.member} session={openByUid.get(row.member.uid)} />}
                  role={<RoleInfo role={row.member.role} permissions={row.member.permissions} />}
                  shift={<ShiftInfo shift={row.member.shift} />}
                  activity={<LastActivity member={row.member} last={lastActivityByUid.get(row.member.uid)} />}
                  actions={<MemberActions member={row.member} block={manageBlock(row.member, myUid, iAmAdmin)} actions={actions} onEdit={onEdit} />}
                  muted={row.member.status === 'suspended'}
                />
              ) : (
                <MobileCard
                  identity={<InviteIdentity invite={row.invite} />}
                  status={<InviteStatus invite={row.invite} />}
                  role={<RoleInfo role={row.invite.role} permissions={row.invite.permissions} />}
                  shift={<ShiftInfo shift={row.invite.shift} />}
                  activity={<InviteDate invite={row.invite} />}
                  actions={<InviteActions invite={row.invite} canCancel={canCancel(row.invite)} actions={actions} />}
                  pending
                />
              )}
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <Card padded={false}>
      {/* Filtros */}
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Buscar por nombre, correo o teléfono…"
          className="w-full lg:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <FilterSelect
            icon={ListFilter}
            label="Rol"
            value={roleFilter}
            onChange={(v) => {
              setRoleFilter(v as 'all' | Role);
              setPage(1);
            }}
            options={[{ value: 'all', label: 'Todos los roles' }, ...ROLE_ORDER.map((r) => ({ value: r, label: ROLE_LABELS[r] }))]}
          />
          <FilterSelect
            icon={CircleDot}
            label="Estado"
            value={status}
            onChange={(v) => {
              setStatus(v as StatusFilter);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      {body}

      {!loading && !error && rows.length > 0 && (
        <div className="border-t border-slate-100">
          <Pagination page={current} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} label={rows.length === 1 ? 'registro' : 'registros'} />
        </div>
      )}

      {!loading && !error && !filtered && members.length <= 1 && invites.length === 0 && (
        <div className="m-4 mt-0 flex flex-col items-start gap-3 rounded-xl border-2 border-dashed border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col">
            <span className="text-label-lg text-on-surface">Invita a tu primer colaborador</span>
            <span className="text-body-sm text-on-surface-variant">Cajeros, supervisores o bodegueros: cada quien con sus propios permisos.</span>
          </div>
          <Button icon={UserPlus} onClick={onInvite}>
            Invitar colaborador
          </Button>
        </div>
      )}
    </Card>
  );
}

function MobileCard({
  identity,
  status,
  role,
  shift,
  activity,
  actions,
  muted,
  pending
}: {
  identity: ReactNode;
  status: ReactNode;
  role: ReactNode;
  shift: ReactNode;
  activity: ReactNode;
  actions: ReactNode;
  muted?: boolean;
  pending?: boolean;
}) {
  return (
    <article
      className={
        'flex h-full flex-col gap-3 rounded-xl border p-4 ' +
        (pending ? 'border-amber-200 bg-amber-50/30' : muted ? 'border-slate-200 bg-slate-50/70' : 'border-slate-200 bg-white')
      }
    >
      {identity}
      <div className="flex flex-wrap items-center gap-2">{status}</div>
      {role}
      <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-label-sm text-slate-500 uppercase">Turno</span>
          {shift}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-label-sm text-slate-500 uppercase">Actividad</span>
          {activity}
        </div>
      </div>
      <div className="mt-auto flex justify-end border-t border-slate-100 pt-3">{actions}</div>
    </article>
  );
}

function FilterSelect({
  icon: Icon,
  label,
  value,
  onChange,
  options
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white pr-1 pl-3 shadow-card transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 sm:flex-none">
      <Icon className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
      <span className="text-label-md whitespace-nowrap text-on-surface-variant">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full min-w-0 flex-1 cursor-pointer bg-transparent pr-1 text-label-md text-on-surface focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
