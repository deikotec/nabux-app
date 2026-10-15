import { useCallback, useMemo } from 'react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { errorMessage } from '@/lib/utils';
import { cancelInvite, removeMember, updateMember } from '@/services/members';
import type { Invite, Member } from '@/types';
import { useConfirm, useToast } from '@/components/ui';
import { copyText, inviteMessage, whatsappUrl } from './staffUtils';

/** Acciones rápidas sobre colaboradores e invitaciones (menús de la lista). */
export function useStaffActions() {
  const { businessId, business, actor } = useActiveBusiness();
  const toast = useToast();
  const { confirm } = useConfirm();

  const toggleSuspend = useCallback(
    async (m: Member) => {
      const name = m.displayName || m.email;
      const suspending = m.status !== 'suspended';
      if (suspending) {
        const ok = await confirm({
          title: `¿Suspender a ${name}?`,
          message: 'No podrá entrar a este negocio hasta que reactives su acceso. Si tiene una caja abierta, haz el corte antes.',
          confirmLabel: 'Suspender acceso'
        });
        if (!ok) return;
      }
      try {
        await updateMember(
          businessId,
          m.uid,
          { status: suspending ? 'suspended' : 'active' },
          actor,
          suspending ? `Suspendió el acceso de ${name}` : `Reactivó el acceso de ${name}`
        );
        toast.success(suspending ? `${name} quedó suspendido` : `${name} vuelve a tener acceso`);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [businessId, actor, confirm, toast]
  );

  const remove = useCallback(
    async (m: Member) => {
      const ok = await confirm({
        title: `¿Dar de baja a ${m.displayName}?`,
        message: 'Perderá el acceso a este negocio de inmediato. Sus ventas y movimientos se conservan en el historial. Si vuelve, tendrás que invitarlo de nuevo.',
        confirmLabel: 'Dar de baja'
      });
      if (!ok) return;
      try {
        await removeMember(businessId, m, actor);
        toast.success(`${m.displayName} fue dado de baja del equipo`);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [businessId, actor, confirm, toast]
  );

  const messageFor = useCallback(
    (inv: Invite) => inviteMessage(inv, inv.businessName || business.name, inv.invitedByName || actor.name),
    [business.name, actor.name]
  );

  const copyInvite = useCallback(
    async (inv: Invite) => {
      if (await copyText(messageFor(inv))) toast.success('Mensaje copiado. Pégalo en WhatsApp, SMS o correo.');
      else toast.error('No se pudo copiar el mensaje.');
    },
    [messageFor, toast]
  );

  const shareInvite = useCallback(
    (inv: Invite) => {
      window.open(whatsappUrl(messageFor(inv)), '_blank', 'noopener,noreferrer');
    },
    [messageFor]
  );

  const revokeInvite = useCallback(
    async (inv: Invite) => {
      const ok = await confirm({
        title: '¿Cancelar la invitación?',
        message: `${inv.displayName || inv.email} ya no podrá unirse con esta invitación. Puedes volver a invitarlo cuando quieras.`,
        confirmLabel: 'Cancelar invitación',
        cancelLabel: 'Conservar'
      });
      if (!ok) return;
      try {
        await cancelInvite(businessId, inv.email);
        toast.success('Invitación cancelada');
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [businessId, confirm, toast]
  );

  return useMemo(
    () => ({ toggleSuspend, remove, copyInvite, shareInvite, revokeInvite }),
    [toggleSuspend, remove, copyInvite, shareInvite, revokeInvite]
  );
}

export type StaffActions = ReturnType<typeof useStaffActions>;
