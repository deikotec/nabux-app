import { arrayUnion, deleteDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ROLE_LABELS } from '@/config/app';
import type { Invite, Member, Permission, Role } from '@/types';
import { logActivity, logActivityIn } from './activity';
import { refs, type Actor } from './refs';

export interface InviteInput {
  email: string;
  displayName?: string;
  phone?: string;
  shift?: string;
  role: Exclude<Role, 'owner'>;
  permissions: Permission[];
}

/**
 * Invita a alguien por correo. Cuando esa persona inicie sesión (o se registre) con ese correo verá la
 * invitación y podrá unirse al negocio con el rol y permisos indicados.
 */
export async function createInvite(business: { id: string; name: string }, actor: Actor, input: InviteInput) {
  const email = input.email.trim().toLowerCase();
  await setDoc(refs.invite(business.id, email), {
    businessId: business.id,
    businessName: business.name,
    email,
    displayName: input.displayName?.trim() ?? '',
    phone: input.phone?.trim() ?? '',
    shift: input.shift ?? '',
    role: input.role,
    permissions: input.permissions,
    invitedBy: actor.uid,
    invitedByName: actor.name,
    createdAt: serverTimestamp()
  });
  logActivity(business.id, actor, {
    type: 'member_invite',
    message: `Invitó a ${input.displayName?.trim() || email} como ${ROLE_LABELS[input.role]}`
  });
}

export async function cancelInvite(bid: string, email: string) {
  await deleteDoc(refs.invite(bid, email));
}

export async function findMyInvites(email: string): Promise<Invite[]> {
  const snap = await getDocs(query(refs.invites(), where('email', '==', email.trim().toLowerCase())));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Invite, 'id'>) }));
}

/**
 * Acepta una invitación: crea el miembro con los datos exactos de la invitación, registra el negocio en
 * users/{uid} y borra la invitación. Las reglas exigen correo verificado.
 */
export async function acceptInvite(invite: Invite, user: { uid: string; email: string; displayName: string; photoURL?: string | null }) {
  const batch = writeBatch(db);
  batch.set(refs.member(invite.businessId, user.uid), {
    uid: user.uid,
    email: user.email.toLowerCase(),
    displayName: invite.displayName || user.displayName,
    photoURL: user.photoURL ?? null,
    phone: invite.phone ?? '',
    shift: invite.shift ?? '',
    role: invite.role,
    permissions: invite.permissions,
    status: 'active',
    invitedBy: invite.invitedBy,
    joinedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  });
  batch.set(
    refs.user(user.uid),
    { businessIds: arrayUnion(invite.businessId), lastBusinessId: invite.businessId, updatedAt: serverTimestamp() },
    { merge: true }
  );
  batch.delete(refs.invite(invite.businessId, invite.email));
  logActivityIn(batch, invite.businessId, { uid: user.uid, name: invite.displayName || user.displayName }, {
    type: 'member_join',
    message: `Se unió al equipo como ${ROLE_LABELS[invite.role]}`
  });
  await batch.commit();
}

export async function declineInvite(invite: Invite) {
  await deleteDoc(refs.invite(invite.businessId, invite.email));
}

export type MemberPatch = Partial<Pick<Member, 'role' | 'permissions' | 'status' | 'shift' | 'phone' | 'displayName'>>;

export async function updateMember(bid: string, uid: string, patch: MemberPatch, actor: Actor, label?: string) {
  await updateDoc(refs.member(bid, uid), patch);
  logActivity(bid, actor, { type: 'member_update', message: label ?? 'Actualizó los datos de un colaborador', refId: uid });
}

export async function removeMember(bid: string, member: Member, actor: Actor) {
  await deleteDoc(refs.member(bid, member.uid));
  logActivity(bid, actor, { type: 'member_remove', message: `Dio de baja a ${member.displayName}`, refId: member.uid });
}

/** Actualiza "última actividad" del miembro actual (como máximo cada pocos minutos). */
export async function touchMember(bid: string, uid: string) {
  await updateDoc(refs.member(bid, uid), { lastActiveAt: serverTimestamp() }).catch(() => undefined);
}

/** El propio usuario actualiza su nombre/foto dentro de un negocio. */
export async function updateOwnMemberProfile(bid: string, uid: string, data: { displayName?: string; photoURL?: string | null; phone?: string }) {
  await updateDoc(refs.member(bid, uid), data);
}
