import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Download,
  EllipsisVertical,
  Hourglass,
  IdCard,
  Lock,
  ScrollText,
  SearchX,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  UserRound,
  Users
} from 'lucide-react';
import { ROLE_LABELS } from '@/config/app';
import { sameDay } from '@/lib/dates';
import { formatDate, formatRelative, formatTime, shortName, toDate } from '@/lib/format';
import { cn, normalize } from '@/lib/utils';
import type { ActivityLog as ActivityEntry, CashSession, Invite, Member, Role } from '@/types';
import { Avatar, EmptyState, MenuItem, Popover, SearchInput, Skeleton } from '@/components/ui';
import { MCard, MSectionHeader, Narrow, Pill, PillTabs, SectionNote, type PillTone } from '@/components/mobile';
import { AccessHowTo } from './AccessHowTo';
import { ActivityLog } from './ActivityLog';
import { InviteActions } from './MemberCells';
import { RolesMatrix } from './RolesMatrix';
import { activityMeta, isAdminRole, manageBlock, MANAGE_BLOCK_TEXT, permissionLevel, permissionSummary, shiftIcon, type AssignableRole, type ManageBlock, type StatusFilter } from './staffUtils';
import type { StaffActions } from './useStaffActions';

type Tab = 'shift' | 'all' | 'roles' | 'activity';

const ROLE_PILL: Record<Role, PillTone> = { owner: 'primary', admin: 'primary', manager: 'tertiary', cashier: 'secondary', warehouse: 'neutral' };
const ROLE_ORDER: Role[] = ['owner', 'admin', 'manager', 'cashier', 'warehouse'];
const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function RolePill({ role }: { role: Role }) {
  return (
    <Pill tone={ROLE_PILL[role]} dot>
      {ROLE_LABELS[role]}
    </Pill>
  );
}

export interface StaffMobileProps {
  businessName: string;
  members: Member[];
  invites: Invite[];
  loading: boolean;
  error: Error | null;
  /** Cajas abiertas ahora (solo con permiso de reportes). */
  openSessions: CashSession[];
  openByUid: Map<string, CashSession>;
  /** ¿Puede ver quién está en turno? (permiso de reportes) */
  canSeeShifts: boolean;
  registersTotal: number;
  lastActivityByUid: Map<string, ActivityEntry>;
  activity: { data: ActivityEntry[]; loading: boolean; error: Error | null; limit: number; onLoadMore: () => void };
  online: boolean;
  money: (n: number) => string;
  myUid: string;
  iAmAdmin: boolean;
  actions: StaffActions;
  onEdit: (m: Member) => void;
  onInvite: (role: AssignableRole) => void;
  onExport: () => void;
}

/** Equipo en el celular (ref/movil/personal_usuarios_m_vil). */
export function StaffMobile(props: StaffMobileProps) {
  const { members, invites, openByUid, canSeeShifts, myUid, iAmAdmin, actions, onEdit } = props;
  const [tab, setTab] = useState<Tab>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [status, setStatus] = useState<StatusFilter>('all');

  const inShift = members.filter((m) => m.status !== 'suspended' && openByUid.has(m.uid));
  const filtered = !!query || roleFilter !== 'all' || status !== 'all';

  const rows = useMemo(() => {
    const q = normalize(query);
    const matches = (text: string, role: Role) => (roleFilter === 'all' || role === roleFilter) && (!q || normalize(text).includes(q));
    const list: ({ kind: 'member'; member: Member } | { kind: 'invite'; invite: Invite })[] = [];
    if (status !== 'pending') {
      for (const m of tab === 'shift' ? inShift : members) {
        if (status === 'active' && m.status === 'suspended') continue;
        if (status === 'suspended' && m.status !== 'suspended') continue;
        if (matches(`${m.displayName} ${m.email} ${m.phone ?? ''}`, m.role)) list.push({ kind: 'member', member: m });
      }
    }
    if (tab === 'all' && (status === 'all' || status === 'pending')) {
      for (const inv of invites) if (matches(`${inv.displayName ?? ''} ${inv.email} ${inv.phone ?? ''}`, inv.role)) list.push({ kind: 'invite', invite: inv });
    }
    return list;
  }, [members, invites, inShift, tab, query, roleFilter, status]);

  const clearFilters = () => {
    setQuery('');
    setRoleFilter('all');
    setStatus('all');
  };

  if (tab === 'activity') {
    return (
      <div className="flex flex-col gap-3 pt-2">
        <button type="button" onClick={() => setTab('all')} className="flex items-center gap-1.5 self-start rounded-lg py-1 text-label-lg text-primary">
          <ArrowLeft className="size-4" aria-hidden /> Volver al equipo
        </button>
        <ActivityLog
          data={props.activity.data}
          loading={props.activity.loading}
          error={props.activity.error}
          limit={props.activity.limit}
          onLoadMore={props.activity.onLoadMore}
          money={props.money}
          online={props.online}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <ShiftBanner {...props} inShift={inShift.length} />

      <PillTabs
        label="Vista del equipo"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'shift', label: canSeeShifts ? `En turno (${inShift.length})` : 'En turno' },
          { value: 'all', label: `Todos (${members.length + invites.length})` },
          { value: 'roles', label: <Narrow full="Roles y permisos" short="Roles" /> }
        ]}
      />

      {tab === 'roles' ? (
        <RolesMatrix members={members} invites={invites} iAmAdmin={iAmAdmin} onInvite={props.onInvite} />
      ) : (
        <section className="flex flex-col gap-2" aria-label={tab === 'shift' ? 'Personal en turno' : 'Personal registrado'}>
          <div className="flex items-center justify-between px-1">
            <span className="text-label-md font-bold tracking-wider text-outline uppercase">{tab === 'shift' ? 'En turno ahora' : 'Personal registrado'}</span>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className="relative flex items-center gap-1 rounded text-label-sm text-primary"
            >
              <SlidersHorizontal className="size-3.5" aria-hidden /> Filtrar
              {filtered && <span className="absolute -top-1 -right-2 size-2 rounded-full bg-primary" aria-hidden />}
            </button>
          </div>

          {showFilters && (
            <MCard className="flex animate-fade-in flex-col gap-2">
              <SearchInput value={query} onChange={setQuery} placeholder="Nombre, correo o teléfono…" />
              <div className="grid grid-cols-2 gap-2">
                <FilterSelect label="Rol" value={roleFilter} onChange={(v) => setRoleFilter(v as 'all' | Role)} options={[{ value: 'all', label: 'Todos' }, ...ROLE_ORDER.map((r) => ({ value: r, label: ROLE_LABELS[r] }))]} />
                <FilterSelect
                  label="Estado"
                  value={status}
                  onChange={(v) => setStatus(v as StatusFilter)}
                  options={[
                    { value: 'all', label: 'Todos' },
                    { value: 'active', label: 'Activos' },
                    { value: 'suspended', label: 'Suspendidos' },
                    { value: 'pending', label: 'Invitaciones' }
                  ]}
                />
              </div>
              {filtered && (
                <button type="button" onClick={clearFilters} className="self-end rounded text-label-md text-primary">
                  Limpiar filtros
                </button>
              )}
            </MCard>
          )}

          {props.error ? (
            <MCard>
              <EmptyState icon={TriangleAlert} title="No pudimos cargar el equipo" description="Revisa tu conexión e intenta de nuevo en unos segundos." />
            </MCard>
          ) : props.loading ? (
            [0, 1, 2].map((i) => (
              <MCard key={i} className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </MCard>
            ))
          ) : rows.length === 0 ? (
            <MCard>
              {filtered ? (
                <EmptyState icon={SearchX} title="Nadie coincide con los filtros" description="Prueba con otro nombre, rol o estado." />
              ) : tab === 'shift' ? (
                <EmptyState
                  icon={Users}
                  title={canSeeShifts ? 'Nadie tiene caja abierta ahora' : 'Sin acceso a los turnos'}
                  description={canSeeShifts ? 'Cuando alguien abra su caja aparecerá aquí con la hora de apertura.' : 'Ver quién está en turno requiere el permiso de reportes.'}
                  action={
                    <button type="button" onClick={() => setTab('all')} className="text-label-lg text-primary">
                      Ver todo el equipo
                    </button>
                  }
                />
              ) : (
                <EmptyState icon={Users} title="Aún no hay colaboradores" description="Invita a tu equipo para que pueda vender o controlar el inventario." />
              )}
            </MCard>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {rows.map((row) =>
                row.kind === 'member' ? (
                  <MemberCard
                    key={row.member.uid}
                    member={row.member}
                    isMe={row.member.uid === myUid}
                    session={openByUid.get(row.member.uid)}
                    last={props.lastActivityByUid.get(row.member.uid)}
                    block={manageBlock(row.member, myUid, iAmAdmin)}
                    actions={actions}
                    onEdit={onEdit}
                  />
                ) : (
                  <InviteCard key={row.invite.id} invite={row.invite} canCancel={iAmAdmin || row.invite.role !== 'admin'} actions={actions} />
                )
              )}
            </div>
          )}

          {tab === 'all' && !props.loading && members.length <= 1 && invites.length === 0 && <AccessHowTo compact className="mt-1" />}
        </section>
      )}

      {tab !== 'roles' && <AuditCard data={props.activity.data} loading={props.activity.loading} onViewAll={() => setTab('activity')} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Hora actual que avanza cada minuto (encabezado del turno). */
function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function ShiftBanner({ businessName, members, invites, openSessions, canSeeShifts, registersTotal, inShift, onInvite, onExport, loading }: StaffMobileProps & { inShift: number }) {
  const now = useMinuteClock();
  const h = now.getHours();
  const part = h < 12 ? 'mañana' : h < 19 ? 'tarde' : 'noche';
  const active = members.filter((m) => m.status !== 'suspended').length;
  const open = openSessions.length;
  const title = canSeeShifts ? (open > 0 ? `Turno de ${part} activo` : `Turno de ${part} · cajas cerradas`) : `Equipo de ${businessName}`;
  const stats: { label: string; value: ReactNode; sub: string; tone: string }[] = canSeeShifts
    ? [
        { label: 'Equipo', value: active, sub: active === 1 ? 'activo' : 'activos', tone: 'text-on-surface' },
        { label: 'En turno', value: inShift, sub: `/ ${active}`, tone: 'text-primary' },
        { label: 'Cajas POS', value: open, sub: `/ ${registersTotal} ${open === 1 ? 'abierta' : 'abiertas'}`, tone: 'text-secondary' }
      ]
    : [
        { label: 'Activos', value: active, sub: `/ ${members.length}`, tone: 'text-primary' },
        { label: 'Invitaciones', value: invites.length, sub: 'pendientes', tone: 'text-tertiary' },
        { label: 'Suspendidos', value: members.length - active, sub: 'sin acceso', tone: 'text-on-surface' }
      ];

  return (
    <MCard className="relative flex flex-col gap-2 overflow-hidden">
      <span aria-hidden className="pointer-events-none absolute -right-4 -bottom-4 size-28 rounded-full bg-primary/5" />
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1">
          <span className={cn('size-2 shrink-0 rounded-full', !canSeeShifts || open > 0 ? 'animate-pulse bg-primary' : 'bg-outline-variant')} aria-hidden />
          <span className="truncate text-label-md font-bold tracking-wider text-primary uppercase">{title}</span>
        </span>
        <span className="shrink-0 text-label-sm text-outline tnum">Hoy, {formatTime(now)}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 pt-1">
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col rounded-lg bg-surface-container-low p-2.5">
            <span className="truncate text-label-sm text-on-surface-variant">{s.label}</span>
            {loading ? (
              <Skeleton className="mt-1 h-5 w-10" />
            ) : (
              <span className="flex min-w-0 items-baseline gap-1">
                <span className={cn('text-headline-sm font-bold tnum', s.tone)}>{s.value}</span>
                <span className="truncate text-label-sm text-outline">{s.sub}</span>
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="relative grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={() => onInvite('cashier')}
          className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-2 text-label-md font-semibold text-on-primary shadow-card transition-transform active:scale-[0.98]"
        >
          <UserPlus className="size-[18px] shrink-0" aria-hidden />
          <span className="truncate">
            <Narrow full="Invitar colaborador" short="Invitar" />
          </span>
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={loading || !members.length}
          className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-surface-container-high px-2 text-label-md font-semibold text-on-surface transition-colors active:bg-surface-container-highest disabled:opacity-55"
        >
          <Download className="size-[18px] shrink-0 text-secondary" aria-hidden />
          <span className="truncate">Exportar lista</span>
        </button>
      </div>
    </MCard>
  );
}

/* ------------------------------------------------------------------ */

function InfoCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg bg-surface-container-low p-2">
      <span className="truncate text-label-sm text-outline">{label}</span>
      <span className="flex min-w-0 items-center gap-1 text-label-md font-semibold text-on-surface">{children}</span>
    </div>
  );
}

function MemberCard({
  member,
  isMe,
  session,
  last,
  block,
  actions,
  onEdit
}: {
  member: Member;
  isMe: boolean;
  session?: CashSession;
  last?: ActivityEntry;
  block: ManageBlock;
  actions: StaffActions;
  onEdit: (m: Member) => void;
}) {
  const suspended = member.status === 'suspended';
  const inShift = !!session && !suspended;
  const admin = isAdminRole(member.role);
  const ShiftIcon = shiftIcon(member.shift);
  const lastText = member.lastActiveAt ? capitalize(formatRelative(member.lastActiveAt)) : 'Sin actividad';
  const subtitle = suspended
    ? 'Acceso suspendido'
    : inShift
      ? `${session.registerName ?? 'Caja'} · en turno desde ${formatTime(session.openedAt)}`
      : member.email;
  const dot = suspended ? 'bg-error' : inShift ? 'bg-primary' : 'bg-outline-variant';
  const dotTitle = suspended ? 'Suspendido' : inShift ? 'En turno' : 'Fuera de turno';
  const smallBtn =
    'flex shrink-0 items-center gap-1 rounded-lg bg-surface-container-high px-2.5 py-1.5 text-label-sm text-on-surface transition-colors hover:bg-surface-container-highest';

  return (
    <article className={cn('flex flex-col gap-2 rounded-xl p-3 shadow-card', suspended ? 'bg-surface-container-low' : 'bg-surface-container-lowest')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative shrink-0">
            <Avatar src={member.photoURL} name={member.displayName} size="lg" className={cn('shadow-card', suspended && 'opacity-50 grayscale')} />
            <span className={cn('absolute right-0 bottom-0 size-3 rounded-full border-2 border-surface-container-lowest', dot, inShift && 'animate-pulse')} title={dotTitle} />
            <span className="sr-only">{dotTitle}</span>
          </div>
          <div className="flex min-w-0 flex-col">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="truncate text-headline-sm font-bold text-on-surface">{member.displayName || member.email}</span>
              <RolePill role={member.role} />
              {isMe && <Pill tone="muted">Tú</Pill>}
            </div>
            <span className="truncate text-label-sm font-medium text-on-surface-variant">{subtitle}</span>
          </div>
        </div>
        {!block && (
          <Popover
            panelClassName="w-60"
            trigger={({ open, toggle }) => (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-label={`Más acciones para ${member.displayName}`}
                className="flex size-8 items-center justify-center rounded-lg text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                <EllipsisVertical className="size-5" />
              </button>
            )}
          >
            {(close) => (
              <div>
                <MenuItem
                  icon={UserCog}
                  onClick={() => {
                    close();
                    onEdit(member);
                  }}
                >
                  Editar rol y permisos
                </MenuItem>
                <MenuItem
                  icon={suspended ? UserCheck : Ban}
                  onClick={() => {
                    close();
                    actions.toggleSuspend(member);
                  }}
                >
                  {suspended ? 'Reactivar acceso' : 'Suspender acceso'}
                </MenuItem>
                <div className="my-1 h-px bg-slate-100" role="separator" />
                <MenuItem
                  icon={UserMinus}
                  danger
                  onClick={() => {
                    close();
                    actions.remove(member);
                  }}
                >
                  Dar de baja
                </MenuItem>
              </div>
            )}
          </Popover>
        )}
      </div>

      {admin ? (
        <div className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-2 text-label-sm text-on-surface-variant">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 font-semibold text-on-surface">
              <ShieldCheck className="size-4 text-primary" aria-hidden /> Permisos totales
            </span>
            <span className="font-bold text-primary">{member.role === 'owner' ? 'Propietario' : 'Acceso total'}</span>
          </div>
          <p className="text-body-sm text-outline">{permissionSummary(member.role, member.permissions)}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          <InfoCell label="Turno">
            <ShiftIcon className="size-3.5 shrink-0 text-on-surface-variant" aria-hidden />
            <span className="truncate">{member.shift ? member.shift.replace(/\s*\(.*\)\s*$/, '') : 'Sin turno fijo'}</span>
          </InfoCell>
          <InfoCell label={inShift ? 'En caja' : 'Última actividad'}>
            <span className="truncate tnum">{inShift ? `Desde ${formatTime(session.openedAt)}` : lastText}</span>
          </InfoCell>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="flex min-w-0 items-center gap-1 text-label-sm text-outline" title={last?.message}>
          {admin ? (
            <span className="truncate">Activo: {lastText.toLowerCase()}</span>
          ) : (
            <>
              <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden />
              <span className="truncate">
                {permissionLevel(member.role, member.permissions).label} · {permissionSummary(member.role, member.permissions)}
              </span>
            </>
          )}
        </span>
        {block === 'self' ? (
          <Link to="/perfil" className={smallBtn}>
            <UserCog className="size-4 text-primary" aria-hidden /> Mi perfil
          </Link>
        ) : block ? (
          <span title={MANAGE_BLOCK_TEXT[block]} className="flex shrink-0 items-center gap-1 text-label-sm text-outline">
            <Lock className="size-3.5" aria-hidden /> {block === 'owner' ? 'Protegido' : 'Solo admins'}
          </span>
        ) : (
          <button type="button" onClick={() => onEdit(member)} className={smallBtn}>
            <IdCard className="size-4 text-secondary" aria-hidden /> Rol y permisos
          </button>
        )}
      </div>
    </article>
  );
}

function InviteCard({ invite, canCancel, actions }: { invite: Invite; canCancel: boolean; actions: StaffActions }) {
  return (
    <article className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-3 shadow-card ring-1 ring-amber-200">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-amber-300 bg-amber-50 text-amber-700">
          <UserRound className="size-6" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="truncate text-headline-sm font-bold text-on-surface">{invite.displayName || invite.email.split('@')[0]}</span>
            <RolePill role={invite.role} />
          </div>
          <span className="truncate text-label-sm font-medium text-on-surface-variant">{invite.email}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-amber-50/70 p-2">
        <Hourglass className="size-5 shrink-0 text-tertiary" aria-hidden />
        <div className="flex min-w-0 flex-col">
          <span className="text-label-sm text-on-surface">Invitación pendiente</span>
          <span className="truncate text-body-sm text-outline">
            Enviada {formatRelative(invite.createdAt)} por {invite.invitedByName || 'el equipo'}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-label-sm text-outline">Compártele el acceso</span>
        <InviteActions invite={invite} canCancel={canCancel} actions={actions} />
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */

function AuditCard({ data, loading, onViewAll }: { data: ActivityEntry[]; loading: boolean; onViewAll: () => void }) {
  const now = new Date();
  const today = data.filter((l) => {
    const d = toDate(l.createdAt);
    return d && sameDay(d, now);
  });
  const items = (today.length ? today : data).slice(0, 4);

  return (
    <MCard className="mt-2 flex flex-col gap-2">
      <MSectionHeader icon={ShieldCheck} title="Bitácora de autorizaciones" aside={<SectionNote>{today.length ? 'Auditoría hoy' : 'Últimos movimientos'}</SectionNote>} />
      {loading && !data.length ? (
        [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg bg-surface-container-low p-3 text-body-sm text-on-surface-variant">
          <ScrollText className="size-4 shrink-0 text-outline" aria-hidden /> Aún no hay movimientos registrados.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((log) => {
            const meta = activityMeta(log.type);
            const Icon = meta.icon;
            return (
              <li key={log.id} className="flex items-start gap-2.5 rounded-lg bg-surface-container-low p-2.5">
                <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-1', meta.tone)} aria-hidden>
                  <Icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-label-md font-semibold text-on-surface">{meta.label}</span>
                    <span className="shrink-0 text-label-sm text-outline tnum">
                      {today.length ? formatTime(log.createdAt) : `${formatDate(log.createdAt, { day: 'numeric', month: 'short' })} · ${formatTime(log.createdAt)}`}
                    </span>
                  </div>
                  <p className="truncate text-body-sm text-on-surface-variant">
                    {log.message} · <b className="font-bold text-on-surface">{shortName(log.userName) || 'Usuario'}</b>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <button type="button" onClick={onViewAll} className="flex items-center justify-center gap-1 rounded-lg py-1.5 text-label-md text-primary hover:underline">
        Ver bitácora completa <ArrowRight className="size-4" aria-hidden />
      </button>
    </MCard>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-label-sm text-on-surface-variant">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-body-md text-on-surface focus:border-primary focus:outline-none"
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
