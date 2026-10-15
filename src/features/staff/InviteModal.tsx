import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Briefcase, CircleCheck, Contact, Copy, Info, Mail, MessageCircle, Phone, Send, Shield, Store, User, UserPlus } from 'lucide-react';
import { APP_NAME, DEFAULT_ROLE_PERMISSIONS } from '@/config/app';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { errorMessage } from '@/lib/utils';
import { createInvite } from '@/services/members';
import type { Invite, Member, Permission } from '@/types';
import { Avatar, Badge, Button, Field, FormSection, Input, Modal, Select, useToast } from '@/components/ui';
import { AccessHowTo } from './AccessHowTo';
import { PermissionLevelTag, PermissionsPicker, RoleSelector, defaultPermissionsFor } from './AccessControls';
import { copyText, inviteMessage, isAdminRole, isValidEmail, SHIFT_OPTIONS, whatsappUrl, type AssignableRole } from './staffUtils';

type CreatedInvite = Pick<Invite, 'email' | 'displayName' | 'role'>;

export function InviteModal({
  onClose,
  initialRole = 'cashier',
  members,
  invites
}: {
  onClose: () => void;
  initialRole?: AssignableRole;
  /** Equipo actual y pendientes, para evitar duplicados. */
  members: Member[];
  invites: Invite[];
}) {
  const { business, businessId, role: myRole, can, actor } = useActiveBusiness();
  const toast = useToast();
  const formId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const allowAdmin = isAdminRole(myRole);
  const grantable = (p: Permission) => can(p);

  const startRole: AssignableRole = initialRole === 'admin' && !allowAdmin ? 'cashier' : initialRole;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<AssignableRole>(startRole);
  const [shift, setShift] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>(() => defaultPermissionsFor(startRole, grantable));
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState<'send' | 'another' | null>(null);
  const [created, setCreated] = useState<CreatedInvite | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const emailError = useMemo(() => {
    if (!cleanEmail) return 'Escribe el correo con el que entrará a la app';
    if (!isValidEmail(cleanEmail)) return 'Escribe un correo válido (ej. nombre@correo.com)';
    if (members.some((m) => (m.email ?? '').toLowerCase() === cleanEmail)) return 'Esta persona ya forma parte del equipo';
    if (invites.some((i) => i.email.toLowerCase() === cleanEmail)) return 'Ya hay una invitación pendiente para este correo';
    return null;
  }, [cleanEmail, members, invites]);
  // Los duplicados se avisan en cuanto el correo es válido; lo demás tras salir del campo o intentar enviar.
  const isDuplicate = !!emailError && isValidEmail(cleanEmail);
  const showEmailError = emailError && (emailTouched || submitted || isDuplicate);
  const permsError = role !== 'admin' && permissions.length === 0 ? 'Marca al menos un permiso para que pueda trabajar' : null;

  const changeRole = (r: AssignableRole) => {
    setRole(r);
    setPermissions(defaultPermissionsFor(r, grantable));
  };

  const resetForAnother = () => {
    setName('');
    setEmail('');
    setPhone('');
    setEmailTouched(false);
    setSubmitted(false);
    setCreated(null);
    setTimeout(() => emailRef.current?.focus(), 40);
  };

  const submit = async (mode: 'send' | 'another') => {
    setSubmitted(true);
    if (emailError || permsError) {
      if (emailError) emailRef.current?.focus();
      return;
    }
    setSaving(mode);
    try {
      const finalPermissions = role === 'admin' ? [...DEFAULT_ROLE_PERMISSIONS.admin] : permissions;
      await createInvite({ id: businessId, name: business.name }, actor, {
        email: cleanEmail,
        displayName: name.trim(),
        phone: phone.trim(),
        shift,
        role,
        permissions: finalPermissions
      });
      if (mode === 'another') {
        toast.success(`Invitación creada para ${name.trim() || cleanEmail}. Compártela desde la lista.`);
        resetForAnother();
      } else {
        setCreated({ email: cleanEmail, displayName: name.trim(), role });
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(null);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit('send');
  };

  const businessBadge = (
    <Badge tone="primary" dot>
      {business.name}
    </Badge>
  );

  /* ---------- Paso 2: compartir ---------- */
  if (created) {
    return (
      <Modal
        open
        onClose={onClose}
        size="lg"
        icon={CircleCheck}
        title="Invitación creada"
        badge={businessBadge}
        subtitle="Solo falta compartirle el acceso a la persona."
        footer={
          <>
            <Button variant="secondary" icon={UserPlus} onClick={resetForAnother}>
              Invitar a otra persona
            </Button>
            <Button onClick={onClose}>Listo</Button>
          </>
        }
      >
        <SharePanel invite={created} businessName={business.name} inviterName={actor.name} />
      </Modal>
    );
  }

  /* ---------- Paso 1: formulario ---------- */
  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="lg"
      icon={UserPlus}
      iconTone="secondary"
      title="Invitar colaborador"
      badge={businessBadge}
      subtitle="Asigna rol, turno y permisos. La persona se une al aceptar la invitación desde la app."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={!!saving} className="sm:mr-auto">
            Cancelar
          </Button>
          <Button variant="secondary" icon={UserPlus} onClick={() => submit('another')} loading={saving === 'another'} disabled={!!saving}>
            Invitar y agregar otro
          </Button>
          <Button type="submit" form={formId} icon={Send} loading={saving === 'send'} disabled={!!saving}>
            Enviar invitación
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-7">
        <FormSection icon={Contact} title="1. Información personal y contacto">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="hidden shrink-0 flex-col items-center gap-2 sm:flex">
              <div className="rounded-full border-2 border-dashed border-outline-variant p-1">
                <Avatar name={name.trim() || cleanEmail || null} size="xl" />
              </div>
              <span className="max-w-24 text-center text-[11px] leading-tight text-on-surface-variant">La foto se toma de su cuenta</span>
            </div>
            <div className="grid flex-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre completo" htmlFor={`${formId}-name`}>
                <Input
                  id={`${formId}-name`}
                  icon={User}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Lucía Beltrán"
                  autoComplete="off"
                  maxLength={80}
                />
              </Field>
              <Field
                label="Correo electrónico"
                required
                htmlFor={`${formId}-email`}
                error={showEmailError ? emailError : undefined}
              >
                <Input
                  ref={emailRef}
                  id={`${formId}-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  icon={Mail}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  placeholder="nombre@correo.com"
                  invalid={!!showEmailError}
                  aria-invalid={!!showEmailError}
                  data-autofocus
                />
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
                  className="tnum"
                  maxLength={30}
                />
              </Field>
              <p className="flex items-start gap-2 self-end rounded-lg bg-surface-container-low p-2.5 text-body-sm text-on-surface-variant">
                <Info className="mt-px size-4 shrink-0 text-secondary" aria-hidden />
                Deberá entrar a {APP_NAME} con este mismo correo. Si usa Google, que sea el de su cuenta de Google.
              </p>
            </div>
          </div>
        </FormSection>

        <FormSection icon={Briefcase} title="2. Rol y asignación operativa">
          <RoleSelector name={`${formId}-role`} value={role} onChange={changeRole} allowAdmin={allowAdmin} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Turno habitual" htmlFor={`${formId}-shift`}>
              <Select id={`${formId}-shift`} value={shift} onChange={(e) => setShift(e.target.value)} options={SHIFT_OPTIONS} />
            </Field>
            <Field label="Negocio asignado" htmlFor={`${formId}-biz`}>
              <Input id={`${formId}-biz`} icon={Store} value={business.name} disabled readOnly />
            </Field>
          </div>
        </FormSection>

        <FormSection icon={Shield} title="3. Permisos y restricciones" aside={<PermissionLevelTag role={role} permissions={permissions} />}>
          <PermissionsPicker role={role} value={permissions} onChange={setPermissions} grantable={grantable} />
          {submitted && permsError && <p className="text-body-sm text-error">{permsError}</p>}
        </FormSection>
      </form>
    </Modal>
  );
}

/** Mensaje de invitación con botones para copiar y compartir por WhatsApp. */
export function SharePanel({ invite, businessName, inviterName }: { invite: CreatedInvite; businessName: string; inviterName: string }) {
  const toast = useToast();
  const message = inviteMessage(invite, businessName, inviterName);
  const who = invite.displayName || invite.email;

  const copy = async () => {
    if (await copyText(message)) toast.success('Mensaje copiado. Pégalo en WhatsApp, SMS o correo.');
    else toast.error('No se pudo copiar. Selecciona el texto y cópialo manualmente.');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
        <div className="min-w-0 text-body-md text-emerald-900">
          <b className="break-words">{who}</b> ya tiene una invitación pendiente. {APP_NAME} no envía correos automáticos: compártele este mensaje
          para que sepa cómo entrar.
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-label-md text-slate-700">Mensaje de invitación</span>
        <pre
          tabIndex={0}
          aria-label="Mensaje de invitación"
          className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-surface-container-low p-4 font-sans text-body-sm break-words whitespace-pre-wrap text-on-surface scrollbar-thin"
        >
          {message}
        </pre>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" icon={Copy} onClick={copy}>
            Copiar mensaje
          </Button>
          <Button icon={MessageCircle} onClick={() => window.open(whatsappUrl(message), '_blank', 'noopener,noreferrer')}>
            Compartir por WhatsApp
          </Button>
        </div>
      </div>

      <AccessHowTo compact />
    </div>
  );
}
