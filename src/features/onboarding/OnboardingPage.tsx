import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ImagePlus,
  LogOut,
  MailCheck,
  MailWarning,
  Plus,
  Receipt,
  RefreshCw,
  Store,
  Tags,
  UserPlus,
  X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { BUSINESS_TYPES, CURRENCIES, currencyOptionBase, DEFAULT_CATEGORIES_BY_TYPE, DEFAULT_FX_SETTINGS, ROLE_LABELS, VE_PAYMENT_METHODS } from '@/config/app';
import { uploadImage } from '@/lib/image';
import { cn, errorMessage } from '@/lib/utils';
import { createBusiness, updateBusiness } from '@/services/business';
import { acceptInvite, declineInvite, findMyInvites } from '@/services/members';
import type { Invite } from '@/types';
import { Avatar, Badge, Button, Card, Field, Input, NumberInput, Select, Spinner, Toggle, useToast } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';

const STEPS = [
  { id: 1, title: 'Tu negocio', icon: Store },
  { id: 2, title: 'Moneda e impuestos', icon: Receipt },
  { id: 3, title: 'Categorías y logo', icon: Tags }
];

export default function OnboardingPage() {
  const { user, profile, signOut, refreshUser, resendVerification } = useAuth();
  const { switchBusiness } = useBusiness();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const creatingAnother = params.get('nuevo') === '1';
  const hasBusinesses = (profile?.businessIds?.length ?? 0) > 0;

  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [busyInvite, setBusyInvite] = useState<string | null>(null);

  const loadInvites = () => {
    if (!user?.email) return setInvites([]);
    findMyInvites(user.email)
      .then(setInvites)
      .catch(() => setInvites([]));
  };

  useEffect(loadInvites, [user?.email]);

  // Negocio recién creado / unido: se entra al panel cuando el servidor ya confirmó la membresía
  // (si se navega antes, Firestore aún no reconoce el acceso).
  const [pendingBid, setPendingBid] = useState<string | null>(null);
  useEffect(() => {
    if (pendingBid && profile?.businessIds?.includes(pendingBid)) {
      switchBusiness(pendingBid);
      navigate('/', { replace: true });
    }
  }, [pendingBid, profile?.businessIds, switchBusiness, navigate]);

  if (hasBusinesses && !creatingAnother && !pendingBid && invites !== null && invites.length === 0) return <Navigate to="/" replace />;

  const verified = !!user?.emailVerified;

  const onAccept = async (inv: Invite) => {
    if (!user) return;
    setBusyInvite(inv.id);
    try {
      await refreshUser();
      await acceptInvite(inv, {
        uid: user.uid,
        email: user.email ?? '',
        displayName: profile?.displayName || user.displayName || inv.displayName || 'Usuario',
        photoURL: user.photoURL
      });
      toast.success(`Te uniste a ${inv.businessName}`);
      setPendingBid(inv.businessId);
    } catch (e) {
      toast.error(errorMessage(e));
      setBusyInvite(null);
    }
  };

  const onDecline = async (inv: Invite) => {
    setBusyInvite(inv.id);
    try {
      await declineInvite(inv);
      setInvites((list) => list?.filter((i) => i.id !== inv.id) ?? null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyInvite(null);
    }
  };

  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/60 bg-surface/85 px-4 backdrop-blur-xl sm:px-8">
        <Logo />
        <div className="flex items-center gap-3">
          {hasBusinesses && (
            <Link to="/" className="hidden text-label-md text-primary hover:underline sm:inline">
              Volver al panel
            </Link>
          )}
          <Avatar src={user?.photoURL} name={profile?.displayName || user?.email} size="sm" />
          <Button variant="ghost" size="sm" icon={LogOut} onClick={() => signOut()}>
            Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
        <div className="flex flex-col gap-2">
          <span className="text-label-md font-bold tracking-wider text-primary uppercase">{creatingAnother ? 'Nuevo negocio' : 'Bienvenida'}</span>
          <h1 className="text-headline-lg">
            {creatingAnother ? 'Registra otro negocio' : `¡Hola, ${(profile?.displayName || user?.displayName || '').split(' ')[0] || 'bienvenido'}!`}
          </h1>
          <p className="text-body-lg text-on-surface-variant">
            {creatingAnother
              ? 'Cada negocio tiene su propio inventario, ventas y equipo.'
              : 'Configura tu negocio para empezar a vender, o únete al equipo de un negocio que te haya invitado.'}
          </p>
        </div>

        {invites === null ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : (
          invites.length > 0 && (
            <Card className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-secondary-fixed text-secondary">
                  <UserPlus className="size-5" />
                </div>
                <div>
                  <h2 className="text-headline-sm">Tienes {invites.length === 1 ? 'una invitación' : `${invites.length} invitaciones`}</h2>
                  <p className="text-body-sm text-on-surface-variant">Únete al equipo con el rol que te asignaron.</p>
                </div>
              </div>
              {!verified && (
                <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
                  <MailWarning className="size-5 shrink-0 text-amber-700" />
                  <p className="flex-1 text-body-md text-amber-900">
                    Para aceptar, primero verifica tu correo <b>{user?.email}</b>. Abre el enlace que te enviamos y luego pulsa “Ya lo verifiqué”.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        resendVerification()
                          .then(() => toast.info('Te reenviamos el correo de verificación'))
                          .catch((e) => toast.error(errorMessage(e)))
                      }
                    >
                      Reenviar
                    </Button>
                    <Button
                      size="sm"
                      icon={RefreshCw}
                      onClick={() =>
                        refreshUser().then(() => {
                          if (!user?.emailVerified) toast.warning('Aún no aparece verificado. Revisa tu correo.');
                        })
                      }
                    >
                      Ya lo verifiqué
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex flex-col divide-y divide-slate-100">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-fixed/30 text-primary">
                        <Building2 className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-label-lg">{inv.businessName}</p>
                        <p className="text-body-sm text-on-surface-variant">
                          Invitado por {inv.invitedByName} · <Badge tone="info">{ROLE_LABELS[inv.role]}</Badge>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => onDecline(inv)} disabled={!!busyInvite}>
                        Rechazar
                      </Button>
                      <Button size="sm" icon={MailCheck} onClick={() => onAccept(inv)} loading={busyInvite === inv.id} disabled={!verified || !!busyInvite}>
                        Unirme
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )
        )}

        <CreateBusinessWizard
          onCreated={(bid) => {
            setPendingBid(bid);
          }}
        />
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CreateBusinessWizard({ onCreated }: { onCreated: (bid: string) => void }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [currency, setCurrency] = useState('VES');
  const cur = useMemo(() => CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0], [currency]);
  const [taxRate, setTaxRate] = useState<number | ''>(cur.taxRate);
  const [taxName, setTaxName] = useState(cur.taxName);
  const [pricesIncludeTax, setPricesIncludeTax] = useState(true);
  const [taxId, setTaxId] = useState('');

  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES_BY_TYPE[BUSINESS_TYPES[0]]);
  const [newCat, setNewCat] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const logoPreview = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTaxRate(cur.taxRate);
    setTaxName(cur.taxName);
  }, [cur]);

  useEffect(() => {
    setCategories(DEFAULT_CATEGORIES_BY_TYPE[businessType] ?? ['General']);
  }, [businessType]);

  const canNext = step === 1 ? name.trim().length >= 2 : step === 2 ? taxRate !== '' : true;

  const addCategory = () => {
    const c = newCat.trim();
    if (c && !categories.includes(c)) setCategories([...categories, c]);
    setNewCat('');
  };

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const bid = await createBusiness(
        { uid: user.uid, email: user.email ?? '', displayName: profile?.displayName || user.displayName || 'Propietario', photoURL: user.photoURL },
        {
          name,
          businessType,
          ...currencyOptionBase(cur),
          taxRate: Number(taxRate) || 0,
          taxName: taxName.trim() || 'IVA',
          pricesIncludeTax,
          categories: categories.length ? categories : ['General'],
          address,
          phone,
          taxId,
          ...(cur.baseCurrency
            ? {
                country: cur.country,
                fx: { ...DEFAULT_FX_SETTINGS, enabled: true, localCurrency: cur.code, localLocale: cur.locale },
                paymentMethods: VE_PAYMENT_METHODS
              }
            : {})
        }
      );
      if (logo) {
        try {
          const img = await uploadImage(logo, `businesses/${bid}/branding`, 400);
          await updateBusiness(bid, { logoUrl: img.url, logoPath: img.path });
        } catch (e) {
          toast.warning(`El negocio se creó, pero no se pudo subir el logo: ${errorMessage(e)}`);
        }
      }
      toast.success('¡Tu negocio está listo!');
      onCreated(bid);
    } catch (e) {
      toast.error(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100 bg-surface-container-low/60 px-5 py-4 no-scrollbar">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                'flex size-8 items-center justify-center rounded-full text-label-md',
                step > s.id ? 'bg-primary text-white' : step === s.id ? 'bg-primary text-white ring-4 ring-primary/15' : 'bg-white text-slate-400 ring-1 ring-slate-200'
              )}
            >
              {step > s.id ? <Check className="size-4" /> : s.id}
            </span>
            {/* En móvil solo se nombra el paso actual (si no, el último no cabe). */}
            <span className={cn('text-label-md', step >= s.id ? 'text-on-surface' : 'text-slate-400', step !== s.id && 'hidden sm:inline')}>{s.title}</span>
            {i < STEPS.length - 1 && <span className="mx-2 h-px w-8 bg-slate-200" />}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {step === 1 && (
          <>
            <Field label="Nombre del negocio" required hint="Así aparecerá en tus tickets.">
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Abarrotes Don Pepe" inputSize="lg" maxLength={120} />
            </Field>
            <Field label="Giro del negocio">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BUSINESS_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBusinessType(t)}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-left text-label-md transition-colors',
                      businessType === t ? 'border-primary bg-primary-fixed/20 text-on-primary-fixed-variant ring-1 ring-primary' : 'border-slate-200 bg-white hover:border-slate-300'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Teléfono">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej. 55 1234 5678" />
              </Field>
              <Field label="Dirección">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle, número, ciudad" />
              </Field>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="País y moneda" required>
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)} options={CURRENCIES.map((c) => ({ value: c.code, label: c.label }))} />
            </Field>
            {cur.baseCurrency && (
              <div className="rounded-xl border border-primary/20 bg-primary-fixed/15 p-4 text-body-md text-on-surface">
                <p className="text-label-lg text-on-primary-fixed-variant">Modo bimonetario para Venezuela</p>
                <ul className="mt-1 list-disc pl-5 text-on-surface-variant">
                  <li>Precios y costos en dólares; el POS muestra y cobra también en bolívares.</li>
                  <li>Tasa BCV y paralelo actualizadas automáticamente (o tu tasa propia).</li>
                  <li>Pago móvil, punto, efectivo $ y Bs, Zelle, USDT y pagos mixtos.</li>
                  <li>IGTF 3% sobre pagos en divisas (puedes desactivarlo).</li>
                </ul>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Nombre del impuesto">
                <Input value={taxName} onChange={(e) => setTaxName(e.target.value)} placeholder="IVA" />
              </Field>
              <Field label="Tasa" required>
                <NumberInput value={taxRate} onValueChange={setTaxRate} suffix="%" placeholder="16" />
              </Field>
              <Field label={cur.country === 'VE' ? 'RIF' : 'RFC / NIT / RUC'}>
                <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="Opcional" />
              </Field>
            </div>
            <Toggle
              checked={pricesIncludeTax}
              onChange={setPricesIncludeTax}
              label="Mis precios de venta ya incluyen el impuesto"
              description={pricesIncludeTax ? `El ${taxName || 'impuesto'} se desglosa dentro del precio en el ticket.` : `El ${taxName || 'impuesto'} se suma al cobrar.`}
            />
          </>
        )}

        {step === 3 && (
          <>
            <Field label="Categorías de productos" hint="Puedes cambiarlas cuando quieras en Configuración.">
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-full bg-surface-container px-3 py-1.5 text-label-md">
                    {c}
                    <button type="button" onClick={() => setCategories(categories.filter((x) => x !== c))} className="rounded-full p-0.5 text-slate-500 hover:bg-white hover:text-error" aria-label={`Quitar ${c}`}>
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCategory();
                    }
                  }}
                  placeholder="Nueva categoría"
                  className="flex-1"
                />
                <Button variant="secondary" icon={Plus} onClick={addCategory}>
                  Agregar
                </Button>
              </div>
            </Field>
            <Field label="Logo (opcional)" hint="PNG o JPG. Aparece en el menú y en los tickets.">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-surface-container-low text-slate-400 hover:border-primary hover:text-primary"
                >
                  {logoPreview ? <img src={logoPreview} alt="" className="size-full object-contain" /> : <ImagePlus className="size-7" />}
                </button>
                <div className="flex flex-col gap-1">
                  <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    {logo ? 'Cambiar logo' : 'Subir logo'}
                  </Button>
                  {logo && (
                    <button type="button" className="text-left text-body-sm text-error hover:underline" onClick={() => setLogo(null)}>
                      Quitar
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
              </div>
            </Field>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-4 sm:px-6">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep((s) => s - 1)} disabled={step === 1 || saving}>
          Atrás
        </Button>
        {step < 3 ? (
          <Button iconRight={ArrowRight} onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            Continuar
          </Button>
        ) : (
          <Button icon={Check} onClick={submit} loading={saving} disabled={!name.trim()}>
            Crear mi negocio
          </Button>
        )}
      </div>
    </Card>
  );
}
