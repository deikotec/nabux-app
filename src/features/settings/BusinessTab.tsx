import { useMemo, useRef, useState, type ReactNode } from 'react';
import { BadgeCheck, Copy, IdCard, ImagePlus, Mail, MapPin, Phone, Store, Trash2, Upload } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useOnline } from '@/hooks/data';
import { BUSINESS_TYPES, ROLE_LABELS } from '@/config/app';
import { formatDate } from '@/lib/format';
import { deleteImage, uploadImage } from '@/lib/image';
import { errorMessage } from '@/lib/utils';
import { logActivity } from '@/services/activity';
import { updateBusiness } from '@/services/business';
import { Badge, Button, Field, Input, Select, Spinner, Textarea, useConfirm, useToast } from '@/components/ui';
import { isVenezuela, taxIdLabel } from './fxHelpers';
import { persist, usePendingChanges, useSyncedForm } from './settingsState';
import { SettingsCard } from './SettingsUI';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BusinessTab() {
  const { business, businessId, member, actor } = useActiveBusiness();
  const toast = useToast();
  const online = useOnline();

  const source = useMemo(
    () => ({
      name: business.name ?? '',
      legalName: business.legalName ?? '',
      businessType: business.businessType ?? '',
      taxId: business.taxId ?? '',
      phone: business.phone ?? '',
      email: business.email ?? '',
      address: business.address ?? ''
    }),
    [business]
  );
  const form = useSyncedForm(source);
  const v = form.values;
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const errors = {
    name: !v.name.trim() ? 'El nombre comercial es obligatorio.' : v.name.trim().length > 120 ? 'Máximo 120 caracteres.' : null,
    email: v.email.trim() && !EMAIL_RE.test(v.email.trim()) ? 'El correo no es válido.' : null
  };
  const valid = !errors.name && !errors.email;

  const typeOptions = useMemo(() => {
    const list = BUSINESS_TYPES.map((t) => ({ value: t, label: t }));
    if (v.businessType && !BUSINESS_TYPES.includes(v.businessType)) list.unshift({ value: v.businessType, label: v.businessType });
    return list;
  }, [v.businessType]);

  const save = async () => {
    setTouched(true);
    if (!valid) {
      toast.error('Revisa los campos marcados.');
      return;
    }
    const clean = {
      name: v.name.trim(),
      legalName: v.legalName.trim(),
      businessType: v.businessType,
      taxId: v.taxId.trim().toUpperCase(),
      phone: v.phone.trim(),
      email: v.email.trim().toLowerCase(),
      address: v.address.trim()
    };
    form.patch(clean);
    setSaving(true);
    try {
      const synced = await persist(updateBusiness(businessId, clean), online);
      logActivity(businessId, actor, { type: 'settings_update', message: 'Actualizó los datos del negocio' });
      if (synced) toast.success('Datos del negocio guardados');
      else toast.info('Guardado en este dispositivo. Se sincronizará al recuperar la conexión.');
      setTouched(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  usePendingChanges({
    area: 'los datos del negocio',
    dirty: form.dirty,
    saving,
    canSave: valid,
    onSave: save,
    onDiscard: () => {
      form.reset();
      setTouched(false);
    }
  });

  const showErr = (msg: string | null) => (touched || form.dirty ? msg : null);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      <div className="flex flex-col gap-5 lg:col-span-7 lg:gap-6">
        <SettingsCard icon={Store} title="Identidad del negocio" subtitle="Nombre, razón social y giro. Aparecen en tus tickets." badge={<Badge tone="primary">En el ticket</Badge>}>
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (form.dirty) save();
            }}
          >
            <Field label="Nombre comercial" required htmlFor="biz-name" error={showErr(errors.name)} className="sm:col-span-2">
              <Input id="biz-name" value={v.name} onChange={(e) => form.set('name', e.target.value)} maxLength={120} invalid={!!showErr(errors.name)} placeholder="Ej. Abarrotes Don Pepe" />
            </Field>
            <Field label="Razón social" htmlFor="biz-legal" hint="Nombre fiscal, si es distinto al comercial.">
              <Input id="biz-legal" value={v.legalName} onChange={(e) => form.set('legalName', e.target.value)} maxLength={160} placeholder="Opcional" />
            </Field>
            <Field
              label={taxIdLabel(business)}
              htmlFor="biz-taxid"
              hint={isVenezuela(business) ? 'Registro de Información Fiscal (ej. J-12345678-9). Se imprime en el ticket.' : 'Identificación fiscal que se imprime en el ticket.'}
            >
              <Input
                id="biz-taxid"
                value={v.taxId}
                onChange={(e) => form.set('taxId', e.target.value)}
                maxLength={30}
                placeholder={isVenezuela(business) ? 'J-12345678-9' : 'Opcional'}
                className="uppercase"
              />
            </Field>
            <Field label="Giro del negocio" htmlFor="biz-type" className="sm:col-span-2">
              <Select id="biz-type" value={v.businessType} onChange={(e) => form.set('businessType', e.target.value)} options={typeOptions} placeholder="Selecciona un giro" />
            </Field>
            <button type="submit" hidden />
          </form>
        </SettingsCard>

        <SettingsCard icon={MapPin} iconTone="secondary" title="Contacto y ubicación" subtitle="Para que tus clientes te encuentren y te contacten.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Teléfono" htmlFor="biz-phone">
              <Input id="biz-phone" type="tel" icon={Phone} value={v.phone} onChange={(e) => form.set('phone', e.target.value)} maxLength={30} placeholder="Opcional" autoComplete="tel" />
            </Field>
            <Field label="Correo de contacto" htmlFor="biz-email" error={showErr(errors.email)}>
              <Input
                id="biz-email"
                type="email"
                icon={Mail}
                value={v.email}
                onChange={(e) => form.set('email', e.target.value)}
                maxLength={120}
                placeholder="Opcional"
                autoComplete="email"
                invalid={!!showErr(errors.email)}
              />
            </Field>
            <Field label="Dirección" htmlFor="biz-address" className="sm:col-span-2">
              <Textarea id="biz-address" rows={2} value={v.address} onChange={(e) => form.set('address', e.target.value)} maxLength={240} placeholder={isVenezuela(business) ? 'Av. o calle, local, urbanización, ciudad' : 'Calle, número, colonia, ciudad'} />
            </Field>
          </div>
        </SettingsCard>
      </div>

      <div className="flex flex-col gap-5 lg:col-span-5 lg:gap-6">
        <LogoCard />

        <SettingsCard icon={IdCard} iconTone="tertiary" title="Datos de la cuenta" subtitle="Información de referencia del negocio.">
          <dl className="flex flex-col divide-y divide-slate-100 text-body-md">
            <InfoRow label="Fecha de alta" value={formatDate(business.createdAt, { day: '2-digit', month: 'long', year: 'numeric' })} />
            <InfoRow label="Tu rol" value={<Badge tone="primary" icon={BadgeCheck}>{ROLE_LABELS[member.role]}</Badge>} />
            <InfoRow label="ID del negocio" value={<CopyableId value={businessId} />} />
          </dl>
        </SettingsCard>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="min-w-0 text-right text-on-surface">{value}</dd>
    </div>
  );
}

function CopyableId({ value }: { value: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          ?.writeText(value)
          .then(() => toast.success('ID copiado'))
          .catch(() => toast.error('No se pudo copiar'));
      }}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-surface-container-low px-2 py-1 text-data-mono text-on-surface-variant hover:bg-surface-container"
      title="Copiar ID"
    >
      <span className="truncate tnum">{value}</span>
      <Copy className="size-3.5 shrink-0" />
    </button>
  );
}

function LogoCard() {
  const { business, businessId, actor } = useActiveBusiness();
  const toast = useToast();
  const { confirm } = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);

  const upload = async (file: File) => {
    setBusy('upload');
    try {
      const previous = business.logoPath ?? null;
      const img = await uploadImage(file, `businesses/${businessId}/branding`, 400);
      await updateBusiness(businessId, { logoUrl: img.url, logoPath: img.path });
      if (previous && previous !== img.path) await deleteImage(previous);
      logActivity(businessId, actor, { type: 'settings_update', message: 'Actualizó el logotipo del negocio' });
      toast.success('Logotipo actualizado');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Quitar logotipo',
      message: 'El logotipo dejará de mostrarse en el menú y en tus tickets. Puedes subir otro cuando quieras.',
      confirmLabel: 'Quitar logotipo'
    });
    if (!ok) return;
    setBusy('remove');
    try {
      const previous = business.logoPath ?? null;
      await updateBusiness(businessId, { logoUrl: null, logoPath: null });
      await deleteImage(previous);
      logActivity(businessId, actor, { type: 'settings_update', message: 'Quitó el logotipo del negocio' });
      toast.success('Logotipo eliminado');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SettingsCard icon={ImagePlus} title="Logotipo" subtitle="Se muestra en el menú lateral y en el encabezado del ticket.">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-surface-container-low">
          {business.logoUrl ? (
            <img src={business.logoUrl} alt={`Logotipo de ${business.name}`} className="size-full object-contain p-2" />
          ) : (
            <Store className="size-10 text-slate-400" />
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Spinner />
            </div>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 text-center sm:text-left">
          <p className="text-body-sm text-on-surface-variant">PNG, JPG o WebP. Se optimiza automáticamente a 400 px; usa fondo claro o transparente.</p>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button size="sm" variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()} loading={busy === 'upload'} disabled={!!busy}>
              {business.logoUrl ? 'Cambiar logotipo' : 'Subir logotipo'}
            </Button>
            {business.logoUrl && (
              <Button size="sm" variant="ghost" icon={Trash2} onClick={remove} loading={busy === 'remove'} disabled={!!busy} className="text-red-700 hover:bg-red-50 hover:text-red-800">
                Quitar
              </Button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) upload(file);
        }}
      />
    </SettingsCard>
  );
}
