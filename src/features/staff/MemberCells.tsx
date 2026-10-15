import { Link } from 'react-router';
import {
  Ban,
  BadgeCheck,
  Copy,
  EllipsisVertical,
  Hourglass,
  Lock,
  MessageCircle,
  Pencil,
  UserCheck,
  UserCog,
  UserMinus,
  UserRound,
  X
} from 'lucide-react';
import { ROLE_LABELS, ROLE_TONES } from '@/config/app';
import { formatRelative, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ActivityLog, CashSession, Invite, Member, Permission, Role } from '@/types';
import { Avatar, Badge, IconButton, MenuItem, Popover } from '@/components/ui';
import type { StaffActions } from './useStaffActions';
import { isCustomized, MANAGE_BLOCK_TEXT, permissionSummary, shiftIcon, type ManageBlock } from './staffUtils';

/* ---------- Colaborador ---------- */

export function MemberIdentity({ member, isMe }: { member: Member; isMe: boolean }) {
  const suspended = member.status === 'suspended';
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar src={member.photoURL} name={member.displayName} size="md" className={cn('shadow-card', suspended && 'opacity-50 grayscale')} />
      <div className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn('truncate text-label-lg text-on-surface', suspended && 'text-on-surface-variant')}>{member.displayName || member.email}</span>
          {member.role === 'owner' && (
            <span title="Propietario del negocio" className="inline-flex shrink-0">
              <BadgeCheck className="size-4 text-primary" aria-hidden />
              <span className="sr-only">Propietario verificado</span>
            </span>
          )}
          {isMe && (
            <Badge tone="neutral" size="xs">
              Tú
            </Badge>
          )}
        </span>
        <span className="truncate text-body-sm text-on-surface-variant">{member.email}</span>
        {member.phone && <span className="truncate text-body-sm text-on-surface-variant tnum">{member.phone}</span>}
      </div>
    </div>
  );
}

export function InviteIdentity({ invite }: { invite: Invite }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-amber-300 bg-amber-50 text-amber-700">
        <UserRound className="size-5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-label-lg text-on-surface">{invite.displayName || invite.email.split('@')[0]}</span>
        <span className="truncate text-body-sm text-on-surface-variant">{invite.email}</span>
        {invite.phone && <span className="truncate text-body-sm text-on-surface-variant tnum">{invite.phone}</span>}
      </div>
    </div>
  );
}

/* ---------- Rol ---------- */

export function RoleInfo({ role, permissions, className }: { role: Role; permissions: Permission[] | undefined; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col items-start gap-1', className)}>
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge tone={ROLE_TONES[role]} dot>
          {ROLE_LABELS[role]}
        </Badge>
        {isCustomized(role, permissions) && (
          <Badge tone="violet" size="xs">
            Personalizado
          </Badge>
        )}
      </span>
      <span className="line-clamp-2 text-body-sm text-on-surface-variant">{permissionSummary(role, permissions)}</span>
    </div>
  );
}

/* ---------- Turno ---------- */

export function ShiftInfo({ shift, className }: { shift?: string; className?: string }) {
  if (!shift) return <span className={cn('text-body-sm text-slate-400', className)}>Sin turno fijo</span>;
  const Icon = shiftIcon(shift);
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-body-sm text-on-surface', className)}>
      <Icon className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
      <span className="tnum">{shift}</span>
    </span>
  );
}

/* ---------- Estado ---------- */

export function MemberStatus({ member, session }: { member: Member; session?: CashSession }) {
  if (member.status === 'suspended') {
    return (
      <Badge tone="danger" icon={Ban}>
        Suspendido
      </Badge>
    );
  }
  if (session) {
    return (
      <span className="flex flex-col items-start gap-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-fixed-dim/60 bg-primary-fixed/35 px-2 py-0.5 text-label-sm whitespace-nowrap text-on-primary-fixed-variant">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
          En turno · caja abierta
        </span>
        <span className="text-body-sm text-on-surface-variant tnum">Desde las {formatTime(session.openedAt)}</span>
      </span>
    );
  }
  return (
    <Badge tone="success" dot>
      Activo
    </Badge>
  );
}

export function InviteStatus({ invite }: { invite: Invite }) {
  return (
    <span className="flex flex-col items-start gap-1">
      <Badge tone="warning" icon={Hourglass}>
        Invitación pendiente
      </Badge>
      <span className="text-body-sm text-on-surface-variant">Por {invite.invitedByName || 'el equipo'}</span>
    </span>
  );
}

/* ---------- Última actividad ---------- */

export function LastActivity({ member, last }: { member: Member; last?: ActivityLog }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-label-md text-on-surface first-letter:uppercase">
        {member.lastActiveAt ? formatRelative(member.lastActiveAt) : 'Sin actividad'}
      </span>
      {last && (
        <span className="line-clamp-2 text-body-sm text-on-surface-variant" title={last.message}>
          {last.message}
        </span>
      )}
    </div>
  );
}

export function InviteDate({ invite }: { invite: Invite }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-label-md text-on-surface first-letter:uppercase">Enviada {formatRelative(invite.createdAt)}</span>
      <span className="text-body-sm text-on-surface-variant">Esperando que acepte</span>
    </div>
  );
}

/* ---------- Acciones ---------- */

export function MemberActions({
  member,
  block,
  actions,
  onEdit,
  className
}: {
  member: Member;
  block: ManageBlock;
  actions: StaffActions;
  onEdit: (m: Member) => void;
  className?: string;
}) {
  if (block === 'self') {
    return (
      <div className={cn('flex justify-end', className)}>
        <Link
          to="/perfil"
          title={MANAGE_BLOCK_TEXT.self}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-label-md text-primary transition-colors hover:bg-primary-fixed/25"
        >
          <UserCog className="size-4" aria-hidden />
          Mi perfil
        </Link>
      </div>
    );
  }
  if (block) {
    return (
      <div className={cn('flex justify-end', className)}>
        <span
          title={MANAGE_BLOCK_TEXT[block]}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-label-sm text-slate-400"
        >
          <Lock className="size-4" aria-hidden />
          <span>{block === 'owner' ? 'Protegido' : 'Solo admins'}</span>
          <span className="sr-only">. {MANAGE_BLOCK_TEXT[block]}</span>
        </span>
      </div>
    );
  }
  const suspended = member.status === 'suspended';
  return (
    <div className={cn('flex items-center justify-end gap-1', className)}>
      <IconButton icon={Pencil} label={`Editar a ${member.displayName}`} size="icon-sm" variant="soft" onClick={() => onEdit(member)} />
      <Popover
        trigger={({ open, toggle }) => (
          <IconButton
            icon={EllipsisVertical}
            label={`Más acciones para ${member.displayName}`}
            size="icon-sm"
            variant="soft"
            aria-haspopup="true"
            aria-expanded={open}
            onClick={toggle}
          />
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
            <div className="my-1 h-px bg-slate-100" />
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
    </div>
  );
}

export function InviteActions({ invite, canCancel, actions, className }: { invite: Invite; canCancel: boolean; actions: StaffActions; className?: string }) {
  return (
    <div className={cn('flex items-center justify-end gap-1', className)}>
      <IconButton icon={Copy} label="Copiar mensaje de invitación" size="icon-sm" variant="soft" onClick={() => actions.copyInvite(invite)} />
      <IconButton
        icon={MessageCircle}
        label="Compartir por WhatsApp"
        size="icon-sm"
        variant="soft"
        className="hover:text-emerald-700"
        onClick={() => actions.shareInvite(invite)}
      />
      <IconButton
        icon={X}
        label={canCancel ? 'Cancelar invitación' : MANAGE_BLOCK_TEXT.admin}
        size="icon-sm"
        variant="soft"
        className="hover:text-error"
        disabled={!canCancel}
        onClick={() => actions.revokeInvite(invite)}
      />
    </div>
  );
}
