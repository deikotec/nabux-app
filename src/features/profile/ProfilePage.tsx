import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from 'firebase/auth';
import { arrayRemove, deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Building2, Camera, Check, KeyRound, LogOut, Mail, Plus, Save, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { ROLE_LABELS } from '@/config/app';
import { uploadImage } from '@/lib/image';
import { errorMessage } from '@/lib/utils';
import { findMyInvites, updateOwnMemberProfile } from '@/services/members';
import { updateUserProfile } from '@/services/profile';
import { refs } from '@/services/refs';
import type { Invite } from '@/types';
import { Avatar, Badge, Button, Card, CardHeader, Field, Input, PageHeader, useConfirm, useToast } from '@/components/ui';

export default function ProfilePage() {
  const { user, profile, signOut } = useAuth();
  const { member, businessId, businesses, switchBusiness, business } = useBusiness();
  const toast = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();

  const [name, setName] = useState(member?.displayName || profile?.displayName || '');
  const [phone, setPhone] = useState(member?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [invites, setInvites] = useState<Invite[]>([]);
  const isPasswordUser = !!user?.providerData.some((p) => p.providerId === 'password');

  useEffect(() => {
    if (user?.email) findMyInvites(user.email).then(setInvites).catch(() => undefined);
  }, [user?.email]);

  const saveProfile = async () => {
    if (!user || !businessId) return;
    setSavingProfile(true);
    try {
      await updateProfile(user, { displayName: name.trim() });
      await updateUserProfile(user.uid, { displayName: name.trim() });
      await updateOwnMemberProfile(businessId, user.uid, { displayName: name.trim(), phone: phone.trim() });
      toast.success('Perfil actualizado');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingProfile(false);
    }
  };

  const changePhoto = async (file: File) => {
    if (!user || !businessId) return;
    setUploading(true);
    try {
      const img = await uploadImage(file, `users/${user.uid}`, 400);
      await updateProfile(user, { photoURL: img.url });
      await updateUserProfile(user.uid, { photoURL: img.url });
      await updateOwnMemberProfile(businessId, user.uid, { photoURL: img.url });
      toast.success('Foto actualizada');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const changePassword = async () => {
    if (!user?.email) return;
    if (newPw.length < 6) return toast.error('La nueva contraseña debe tener al menos 6 caracteres.');
    setSavingPw(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPw));
      await updatePassword(user, newPw);
      setCurrentPw('');
      setNewPw('');
      toast.success('Contraseña actualizada');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingPw(false);
    }
  };

  const leaveBusiness = async () => {
    if (!user || !businessId || !member || member.role === 'owner') return;
    const ok = await confirm({
      title: `Salir de ${business?.name}`,
      message: 'Perderás el acceso a este negocio. Para volver, un administrador tendrá que invitarte de nuevo.',
      confirmLabel: 'Salir del negocio'
    });
    if (!ok) return;
    try {
      await deleteDoc(refs.member(businessId, user.uid));
      await setDoc(refs.user(user.uid), { businessIds: arrayRemove(businessId), lastBusinessId: null, updatedAt: serverTimestamp() }, { merge: true });
      toast.success('Saliste del negocio');
      navigate('/');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader eyebrow="Mi cuenta" title="Mi perfil" description="Tus datos personales, seguridad y los negocios a los que perteneces." />

      <Card>
        <CardHeader title="Datos personales" subtitle="Así te verá tu equipo en ventas y bitácora." />
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Avatar src={member?.photoURL ?? user?.photoURL} name={name} size="xl" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -right-1 -bottom-1 rounded-full bg-primary p-2 text-white shadow-lift hover:bg-primary-hover"
                aria-label="Cambiar foto"
                disabled={uploading}
              >
                <Camera className="size-4" />
              </button>
            </div>
            {uploading && <span className="text-body-sm text-on-surface-variant">Subiendo…</span>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && changePhoto(e.target.files[0])} />
          </div>
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre completo">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Teléfono / WhatsApp">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opcional" />
            </Field>
            <Field label="Correo" className="sm:col-span-2">
              <Input value={user?.email ?? ''} icon={Mail} disabled />
            </Field>
            <div className="sm:col-span-2">
              <Button icon={Save} onClick={saveProfile} loading={savingProfile} disabled={!name.trim()}>
                Guardar cambios
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {isPasswordUser && (
        <Card>
          <CardHeader title="Seguridad" subtitle="Cambia tu contraseña de acceso." icon={KeyRound} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Contraseña actual">
              <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
            </Field>
            <Field label="Nueva contraseña">
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
            </Field>
            <div className="flex items-end">
              <Button variant="secondary" onClick={changePassword} loading={savingPw} disabled={!currentPw || !newPw} fullWidth>
                Actualizar contraseña
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Mis negocios"
          subtitle="Cambia de negocio o crea uno nuevo."
          icon={Building2}
          actions={
            <Button variant="secondary" size="sm" icon={Plus} onClick={() => navigate('/bienvenida?nuevo=1')}>
              Crear negocio
            </Button>
          }
        />
        <div className="flex flex-col divide-y divide-slate-100">
          {businesses.map((b) => (
            <div key={b.id} className="flex items-center gap-3 py-3">
              {b.logoUrl ? (
                <img src={b.logoUrl} alt="" className="size-10 rounded-xl object-contain" />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary-fixed/30 text-primary">
                  <Building2 className="size-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-label-lg">{b.name}</p>
                <p className="text-body-sm text-on-surface-variant">{b.businessType}</p>
              </div>
              {b.id === businessId ? (
                <Badge tone="primary" icon={Check}>
                  Actual · {member ? ROLE_LABELS[member.role] : ''}
                </Badge>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => switchBusiness(b.id)}>
                  Cambiar
                </Button>
              )}
            </div>
          ))}
        </div>
        {member && member.role !== 'owner' && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <Button variant="danger" size="sm" icon={LogOut} onClick={leaveBusiness}>
              Salir de {business?.name}
            </Button>
          </div>
        )}
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardHeader title="Invitaciones pendientes" icon={UserPlus} subtitle="Otros negocios te invitaron a su equipo." />
          <div className="flex flex-col gap-2">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low px-4 py-3">
                <div>
                  <p className="text-label-lg">{inv.businessName}</p>
                  <p className="text-body-sm text-on-surface-variant">{ROLE_LABELS[inv.role]}</p>
                </div>
                <Button size="sm" onClick={() => navigate('/bienvenida?nuevo=1')}>
                  Ver invitación
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div>
        <Button variant="ghost" icon={LogOut} onClick={() => signOut()}>
          Cerrar sesión en este dispositivo
        </Button>
      </div>
    </div>
  );
}
