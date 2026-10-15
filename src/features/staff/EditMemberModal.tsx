import { useId, useState } from 'react';
import { Briefcase, CalendarClock, Phone, Save, Shield, UserCog, UserMinus } from 'lucide-react';
import { DEFAULT_ROLE_PERMISSIONS, ROLE_LABELS, ROLE_TONES } from '@/config/app';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { formatDate, formatRelative } from '@/lib/format';
import { errorMessage } from '@/lib/utils';
import { removeMember, updateMember, type MemberPatch } from '@/services/members';
import type { Member, Permission } from '@/types';
import { Avatar, Badge, Button, Field, FormSection, Input, Modal, Select, Toggle, useConfirm, useToast } from '@/components/ui';
import { PermissionLevelTag, PermissionsPicker, RoleSelector, defaultPermissionsFor } from './AccessControls';
import { effectivePermissions, isAdminRole, PERMISSION_SHORT, shiftOptions, type AssignableRole } from './staffUtils';

/** Edición de un colaborador (nunca el propietario ni uno mismo; lo garantiza quien abre el modal). */
export function EditMemberModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const { businessId, role: myRole, can, actor } = useActiveBusiness();
  const toast = useToast();
  const { confirm } = useConfirm();
  const formId = useId();
  const allowAdmin = isAdminRole(myRole);
  const grantable = (p: Permission) => can(p);

  const initialRole = (member.role === 'owner' ? 'admin' : member.role) as AssignableRole;
  const initialPerms = effectivePermissions(member.role, member.permissions);
  const [role, setRole] = useState<AssignableRole>(initialRole);
  const [permissions, setPermissions] = useState<Permission[]>(initialPerms);
  const [shift, setShift] = useState(member.shift ?? '');
  const [phone, setPhone] = useState(member.phone ?? '');
  const [active, setActive] = useState(member.status !== 'suspended');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const changeRole = (r: AssignableRole) => {
    setRole(r);
    setPermissions(r === initialRole ? initialPerms : defaultPermissionsFor(r, grantable));
  };

  const finalPermissions = role === 'admin' ? [...DEFAULT_ROLE_PERMISSIONS.admin] : permissions;
  const permsChanged =
    finalPermissions.length !== initialPerms.length || finalPermissions.some((p) => !initialPerms.includes(p));
  // Solo se exige al menos un permiso si se están cambiando rol o permisos.
  const permsError = role !== 'admin' && permissions.length === 0 && (permsChanged || role !== member.role);

  const save = async () => {
    const patch: MemberPatch = {};
    const parts: string[] = [];
    if (role !== member.role) {
      patch.role = role;
      parts.push(`rol ${ROLE_LABELS[member.role]} → ${ROLE_LABELS[role]}`);
    }
    if (permsChanged || role !== member.role) {
      patch.permissions = finalPermissions;
      if (permsChanged) parts.push(`permisos (${finalPermissions.map((p) => PERMISSION_SHORT[p]).join(', ') || 'ninguno'})`);
    }
    if (shift !== (member.shift ?? '')) {
      patch.shift = shift;
      parts.push(`turno ${shift || 'sin turno fijo'}`);
    }
    if (phone.trim() !== (member.phone ?? '')) {
      patch.phone = phone.trim();
      parts.push('teléfono');
    }
    const statusChanged = active !== (member.status !== 'suspended');
    if (statusChanged) patch.status = active ? 'active' : 'suspended';

    if (!Object.keys(patch).length) {
      toast.info('No hiciste cambios');
      onClose();
      return;
    }
    if (permsError) {
      toast.error('Marca al menos un permiso para que pueda trabajar.');
      return;
    }
    if (statusChanged && !active) {
      const ok = await confirm({
        title: `¿Suspender a ${member.displayName}?`,
        message: 'No podrá entrar a este negocio hasta que reactives su acceso. Si tiene una caja abierta, haz el corte antes.',
        confirmLabel: 'Suspender acceso'
      });
      if (!ok) return;
    }

    const name = member.displayName || member.email;
    let label: string;
    if (statusChanged && !parts.length) label = active ? `Reactivó el acceso de ${name}` : `Suspendió el acceso de ${name}`;
    else {
      if (statusChanged) parts.push(active ? 'reactivó su acceso' : 'suspendió su acceso');
      label = `Actualizó a ${name}: ${parts.join(', ')}`;
    }

    setSaving(true);
    try {
      await updateMember(businessId, member.uid, patch, actor, label);
      toast.success(`Cambios guardados para ${name}`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `¿Dar de baja a ${member.displayName}?`,
      message: 'Perderá el acceso a este negocio de inmediato. Sus ventas y movimientos se conservan en el historial. Si vuelve, tendrás que invitarlo de nuevo.',
      confirmLabel: 'Dar de baja'
    });
    if (!ok) return;
    setRemoving(true);
    try {
      await removeMember(businessId, member, actor);
      toast.success(`${member.displayName} fue dado de baja del equipo`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
      setRemoving(false);
    }
  };

  const busy = saving || removing;

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!busy}
      size="lg"
      icon={UserCog}
      iconTone="secondary"
      title="Editar colaborador"
      badge={
        <Badge tone={ROLE_TONES[member.role]} dot>
          {ROLE_LABELS[member.role]}
        </Badge>
      }
      subtitle="Cambia su rol, permisos, turno o estado de acceso."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy} className="sm:mr-auto">
            Cancelar
          </Button>
          <Button icon={Save} onClick={save} loading={saving} disabled={busy}>
            Guardar cambios
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-7">
        <div className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
          <Avatar src={member.photoURL} name={member.displayName} size="lg" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-headline-sm text-on-surface">{member.displayName}</span>
            <span className="truncate text-body-sm text-on-surface-variant">{member.email}</span>
            <span className="text-body-sm text-on-surface-variant">
              Se unió {formatDate(member.joinedAt)} · Última actividad {formatRelative(member.lastActiveAt)}
            </span>
          </div>
        </div>

        <FormSection icon={Briefcase} title="Rol">
          <RoleSelector name={`${formId}-role`} value={role} onChange={changeRole} allowAdmin={allowAdmin} />
        </FormSection>

        <FormSection icon={Shield} title="Permisos" aside={<PermissionLevelTag role={role} permissions={finalPermissions} />}>
          <PermissionsPicker role={role} value={permissions} onChange={setPermissions} grantable={grantable} />
          {permsError && <p className="text-body-sm text-error">Marca al menos un permiso para que pueda trabajar.</p>}
        </FormSection>

        <FormSection icon={CalendarClock} title="Turno y contacto">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Turno habitual" htmlFor={`${formId}-shift`}>
              <Select id={`${formId}-shift`} value={shift} onChange={(e) => setShift(e.target.value)} options={shiftOptions(member.shift)} />
            </Field>
            <Field label="Teléfono / WhatsApp" htmlFor={`${formId}-phone`}>
              <Input
                id={`${formId}-phone`}
                type="tel"
                inputMode="tel"
                icon={Phone}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. +52 55 1234 5678"
                maxLength={30}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection icon={UserCog} title="Acceso">
          <Toggle
            checked={active}
            onChange={setActive}
            label={active ? 'Acceso activo' : 'Acceso suspendido'}
            description={
              active
                ? 'Puede entrar al negocio y trabajar con los permisos asignados.'
                : 'No podrá entrar a este negocio hasta que lo reactives. Sus datos se conservan.'
            }
          />
          <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col">
              <span className="text-label-lg text-red-800">Dar de baja</span>
              <span className="text-body-sm text-red-700/90">Lo quita del equipo. Su historial de ventas y movimientos se conserva.</span>
            </div>
            <Button variant="danger" icon={UserMinus} onClick={remove} loading={removing} disabled={busy}>
              Dar de baja
            </Button>
          </div>
        </FormSection>
      </div>
    </Modal>
  );
}
