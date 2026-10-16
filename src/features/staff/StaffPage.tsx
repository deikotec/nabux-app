import { useMemo, useState } from 'react';
import { Building2, Download, ScrollText, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { PERMISSION_LABELS, ROLE_LABELS } from '@/config/app';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useActivity, useBusinessInvites, useClosedCashSessions, useMembers, useOnline, useOpenCashSessions } from '@/hooks/data';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { dayKey } from '@/lib/dates';
import { formatDate, formatDateTime, toDate } from '@/lib/format';
import { activeRegisters } from '@/lib/registers';
import { downloadFile, normalize, toCsv } from '@/lib/utils';
import type { ActivityLog as ActivityEntry, CashSession, Member, TS } from '@/types';
import { Button, PageHeader, TabBar, useToast } from '@/components/ui';
import { AccessHowTo } from './AccessHowTo';
import { ActivityLog } from './ActivityLog';
import { EditMemberModal } from './EditMemberModal';
import { InviteModal } from './InviteModal';
import { MembersTable } from './MembersTable';
import { RolesMatrix } from './RolesMatrix';
import { StaffKpis } from './StaffKpis';
import { StaffMobile } from './StaffMobile';
import { effectivePermissions, isAdminRole, manageBlock, type AssignableRole } from './staffUtils';
import { useStaffActions } from './useStaffActions';

type StaffTab = 'list' | 'roles' | 'activity';

const ACTIVITY_PAGE = 100;
const millis = (ts: TS) => ts?.toMillis?.() ?? 0;
const csvDate = (ts: TS, withTime = false) => (toDate(ts) ? (withTime ? formatDateTime(ts) : formatDate(ts)) : '');

export default function StaffPage() {
  const { business, member: me, role, can, money } = useActiveBusiness();
  const toast = useToast();
  const online = useOnline();
  const desktop = useIsDesktop();
  const iAmAdmin = isAdminRole(role);
  const canReports = can('reports');

  const membersQ = useMembers();
  const invitesQ = useBusinessInvites();
  const openQ = useOpenCashSessions();
  const closedQ = useClosedCashSessions(5);
  const [activityLimit, setActivityLimit] = useState(ACTIVITY_PAGE);
  const activityQ = useActivity(activityLimit);
  const actions = useStaffActions();

  const [tab, setTab] = useState<StaffTab>('list');
  const [inviteRole, setInviteRole] = useState<AssignableRole | null>(null);
  const [editingUid, setEditingUid] = useState<string | null>(null);

  const members = membersQ.data;
  const invites = useMemo(() => [...invitesQ.data].sort((a, b) => millis(b.createdAt) - millis(a.createdAt)), [invitesQ.data]);
  // En turno: quien abrió la caja y quienes cobran en ella (cajas compartidas).
  const openByUid = useMemo(() => {
    const map = new Map<string, CashSession>();
    for (const s of openQ.data) for (const uid of [s.openedBy, ...(s.cashierIds ?? [])]) if (!map.has(uid)) map.set(uid, s);
    return map;
  }, [openQ.data]);
  const lastActivityByUid = useMemo(() => {
    const map = new Map<string, ActivityEntry>();
    for (const log of activityQ.data) if (log.userId && !map.has(log.userId)) map.set(log.userId, log);
    return map;
  }, [activityQ.data]);

  const activeCount = members.filter((m) => m.status !== 'suspended').length;
  const editing = editingUid ? (members.find((m) => m.uid === editingUid) ?? null) : null;

  const openEdit = (m: Member) => {
    if (manageBlock(m, me.uid, iAmAdmin)) return;
    setEditingUid(m.uid);
  };

  const exportCsv = () => {
    const permissionsText = (r: Member['role'], perms: Member['permissions']) =>
      effectivePermissions(r, perms)
        .map((p) => PERMISSION_LABELS[p].label)
        .join(' | ');
    const rows: (string | number)[][] = [
      ['Nombre', 'Correo', 'Teléfono', 'Rol', 'Permisos', 'Turno', 'Estado', 'Última actividad', 'Alta / invitación']
    ];
    for (const m of members) {
      rows.push([
        m.displayName,
        m.email,
        m.phone ?? '',
        ROLE_LABELS[m.role],
        permissionsText(m.role, m.permissions),
        m.shift ?? '',
        m.status === 'suspended' ? 'Suspendido' : openByUid.has(m.uid) ? 'En turno · caja abierta' : 'Activo',
        csvDate(m.lastActiveAt, true),
        csvDate(m.joinedAt)
      ]);
    }
    for (const inv of invites) {
      rows.push([
        inv.displayName ?? '',
        inv.email,
        inv.phone ?? '',
        ROLE_LABELS[inv.role],
        permissionsText(inv.role, inv.permissions),
        inv.shift ?? '',
        'Invitación pendiente',
        '',
        csvDate(inv.createdAt)
      ]);
    }
    const slug = normalize(business.name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'negocio';
    downloadFile(`equipo-${slug}-${dayKey(new Date())}.csv`, toCsv(rows));
    toast.success(`Exportaste ${rows.length - 1} ${rows.length === 2 ? 'registro' : 'registros'} del equipo`);
  };

  const modals = (
    <>
      {inviteRole && <InviteModal initialRole={inviteRole} members={members} invites={invites} onClose={() => setInviteRole(null)} />}
      {editing && <EditMemberModal key={editing.uid} member={editing} onClose={() => setEditingUid(null)} />}
    </>
  );

  const mobile = desktop ? null : (
    <StaffMobile
      businessName={business.name}
      members={members}
      invites={invites}
      loading={membersQ.loading}
      error={membersQ.error}
      openSessions={openQ.data}
      openByUid={openByUid}
      canSeeShifts={canReports}
      registersTotal={activeRegisters(business).length}
      lastActivityByUid={lastActivityByUid}
      activity={{
        data: activityQ.data,
        loading: activityQ.loading,
        error: activityQ.error,
        limit: activityLimit,
        onLoadMore: () => setActivityLimit((n) => n + ACTIVITY_PAGE)
      }}
      online={online}
      money={money}
      myUid={me.uid}
      iAmAdmin={iAmAdmin}
      actions={actions}
      onEdit={openEdit}
      onInvite={setInviteRole}
      onExport={exportCsv}
    />
  );

  const tabs = [
    { value: 'list' as const, label: 'Lista de usuarios', icon: Users, count: membersQ.loading ? undefined : members.length + invites.length },
    { value: 'roles' as const, label: 'Roles y permisos', icon: ShieldCheck },
    { value: 'activity' as const, label: 'Bitácora de auditoría', icon: ScrollText }
  ];

  // Los modales quedan siempre en la misma posición: al cruzar 1024 px (girar una tableta) no se pierde lo escrito en ellos.
  return (
    <>
      {mobile ?? (
        <>
          <PageHeader
            eyebrow={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 tracking-normal normal-case">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-2.5 py-1 text-label-sm tracking-wider text-on-primary-fixed-variant uppercase">
                  <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden />
                  {membersQ.loading ? 'Cargando equipo…' : `${activeCount} ${activeCount === 1 ? 'colaborador activo' : 'colaboradores activos'}`}
                </span>
                <span className="inline-flex min-w-0 items-center gap-1 text-data-mono text-on-surface-variant">
                  <Building2 className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{business.name}</span>
                </span>
              </span>
            }
            title="Equipo & Control de Acceso"
            description="Invita a tu personal, define qué puede hacer cada persona y revisa en tiempo real quién está en turno y qué movimientos críticos se registran."
            actions={
              <>
                <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={membersQ.loading || !members.length}>
                  Exportar
                </Button>
                <Button icon={UserPlus} onClick={() => setInviteRole('cashier')}>
                  Invitar colaborador
                </Button>
              </>
            }
          />

          <div className="flex flex-col gap-6">
            <StaffKpis
              members={members}
              invites={invites}
              openSessions={openQ.data}
              closedSessions={closedQ.data}
              canReports={canReports}
              loading={{ members: membersQ.loading, invites: invitesQ.loading, open: openQ.loading, closed: closedQ.loading }}
              money={money}
            />

            <div className="flex flex-col gap-4">
              <TabBar tabs={tabs} value={tab} onChange={setTab} className="-mx-4 px-4 sm:mx-0 sm:px-0" />

              <div role="tabpanel" aria-label={tabs.find((t) => t.value === tab)?.label} className="flex flex-col gap-6">
                {tab === 'list' && (
                  <>
                    <MembersTable
                      members={members}
                      invites={invites}
                      loading={membersQ.loading}
                      error={membersQ.error}
                      openByUid={openByUid}
                      lastActivityByUid={lastActivityByUid}
                      myUid={me.uid}
                      iAmAdmin={iAmAdmin}
                      actions={actions}
                      onEdit={openEdit}
                      onInvite={() => setInviteRole('cashier')}
                    />
                    <AccessHowTo />
                  </>
                )}

                {tab === 'roles' && <RolesMatrix members={members} invites={invites} iAmAdmin={iAmAdmin} onInvite={setInviteRole} />}

                {tab === 'activity' && (
                  <ActivityLog
                    data={activityQ.data}
                    loading={activityQ.loading}
                    error={activityQ.error}
                    limit={activityLimit}
                    onLoadMore={() => setActivityLimit((n) => n + ACTIVITY_PAGE)}
                    money={money}
                    online={online}
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}
      {modals}
    </>
  );
}
