import { useMemo, useState } from 'react';
import { Lock, Mail, PackageCheck, PackageX, Pencil, Phone, Plus, Trash2, Truck, UserRound } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { formatDate, formatNumber } from '@/lib/format';
import { errorMessage, normalize } from '@/lib/utils';
import { createSupplier, deleteSupplier, updateSupplier, type SupplierInput } from '@/services/suppliers';
import type { Product, Supplier } from '@/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  SearchInput,
  Skeleton,
  Table,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  useConfirm,
  useToast
} from '@/components/ui';
import { setProductsSupplier } from './productBatch';
import { Callout } from './SettingsUI';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SuppliersTab() {
  const { businessId, can } = useActiveBusiness();
  const { suppliers, products, loading } = useCatalog();
  const toast = useToast();
  const { confirm } = useConfirm();
  const canEdit = can('inventory');

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const productsBySupplier = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of products) {
      if (!p.supplierId) continue;
      const list = m.get(p.supplierId) ?? [];
      list.push(p);
      m.set(p.supplierId, list);
    }
    return m;
  }, [products]);

  const visible = useMemo(() => {
    const q = normalize(query);
    if (!q) return suppliers;
    return suppliers.filter((s) => normalize([s.name, s.contactName, s.phone, s.email].filter(Boolean).join(' ')).includes(q));
  }, [suppliers, query]);

  const linkedCount = useMemo(() => {
    const ids = new Set(suppliers.map((s) => s.id));
    return products.filter((p) => p.supplierId && ids.has(p.supplierId)).length;
  }, [products, suppliers]);

  const remove = async (s: Supplier) => {
    const linked = productsBySupplier.get(s.id) ?? [];
    const ok = await confirm({
      title: `Eliminar a ${s.name}`,
      message:
        linked.length > 0 ? (
          <>
            Este proveedor tiene <b>{formatNumber(linked.length)} producto(s)</b> asociados. Al eliminarlo, esos productos quedarán sin proveedor
            (no se borran). Esta acción no se puede deshacer.
          </>
        ) : (
          'El proveedor se eliminará de tu lista. Esta acción no se puede deshacer.'
        ),
      confirmLabel: 'Eliminar proveedor'
    });
    if (!ok) return;
    setDeletingId(s.id);
    try {
      if (linked.length) await setProductsSupplier(businessId, linked, null);
      await deleteSupplier(businessId, s.id);
      toast.success(`Proveedor “${s.name}” eliminado`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeletingId(null);
    }
  };

  const actions = (s: Supplier) =>
    canEdit ? (
      <div className="flex items-center justify-end gap-1">
        <IconButton icon={Pencil} label={`Editar ${s.name}`} size="icon-sm" onClick={() => setEditing(s)} disabled={!!deletingId} />
        <IconButton
          icon={Trash2}
          label={`Eliminar ${s.name}`}
          size="icon-sm"
          onClick={() => remove(s)}
          disabled={!!deletingId}
          className="hover:bg-red-50 hover:text-red-700"
        />
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <MiniStat label="Proveedores" value={formatNumber(suppliers.length)} icon={Truck} />
        <MiniStat label="Productos con proveedor" value={formatNumber(linkedCount)} icon={PackageCheck} />
        <MiniStat label="Productos sin proveedor" value={formatNumber(products.length - linkedCount)} icon={PackageX} />
      </div>

      {!canEdit && (
        <Callout icon={Lock} title="Solo lectura">
          Para crear, editar o eliminar proveedores necesitas el permiso “Gestionar inventario”.
        </Callout>
      )}

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
              <Truck className="size-5" />
            </div>
            <div>
              <h2 className="text-headline-sm text-on-surface">Proveedores</h2>
              <p className="text-body-sm text-on-surface-variant">A quién le compras: se asignan en la ficha de cada producto.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {suppliers.length > 0 && <SearchInput value={query} onChange={setQuery} placeholder="Buscar proveedor…" className="sm:w-64" />}
            {canEdit && (
              <Button icon={Plus} onClick={() => setEditing('new')}>
                Nuevo proveedor
              </Button>
            )}
          </div>
        </div>

        {loading && suppliers.length === 0 ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="Aún no tienes proveedores"
            description="Registra a tus proveedores para saber a quién comprarle cada producto y tener sus datos de contacto a la mano."
            action={
              canEdit ? (
                <Button icon={Plus} onClick={() => setEditing('new')}>
                  Agregar proveedor
                </Button>
              ) : undefined
            }
          />
        ) : visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-body-md text-on-surface-variant">No hay proveedores que coincidan con “{query}”.</p>
        ) : (
          <>
            {/* Escritorio */}
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TH>Proveedor</TH>
                  <TH>Contacto</TH>
                  <TH>Teléfono</TH>
                  <TH>Correo</TH>
                  <TH align="right">Productos</TH>
                  {canEdit && <TH align="right">Acciones</TH>}
                </THead>
                <tbody>
                  {visible.map((s) => {
                    const count = productsBySupplier.get(s.id)?.length ?? 0;
                    return (
                      <TR key={s.id}>
                        <TD>
                          <div className="flex min-w-0 flex-col">
                            <span className="text-label-lg text-on-surface">{s.name}</span>
                            {s.notes ? (
                              <span className="max-w-xs truncate text-body-sm text-on-surface-variant" title={s.notes}>
                                {s.notes}
                              </span>
                            ) : s.createdAt ? (
                              <span className="text-body-sm text-on-surface-variant">Desde {formatDate(s.createdAt)}</span>
                            ) : null}
                          </div>
                        </TD>
                        <TD className="text-on-surface-variant">{s.contactName || '—'}</TD>
                        <TD>{s.phone ? <ContactLink href={`tel:${s.phone}`} icon={Phone} text={s.phone} /> : <span className="text-slate-400">—</span>}</TD>
                        <TD>{s.email ? <ContactLink href={`mailto:${s.email}`} icon={Mail} text={s.email} /> : <span className="text-slate-400">—</span>}</TD>
                        <TD align="right">
                          {count > 0 ? <Badge tone="info">{formatNumber(count)}</Badge> : <span className="text-slate-400">0</span>}
                        </TD>
                        {canEdit && <TD align="right">{actions(s)}</TD>}
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            </div>

            {/* Móvil */}
            <ul className="flex flex-col divide-y divide-slate-100 md:hidden">
              {visible.map((s) => {
                const count = productsBySupplier.get(s.id)?.length ?? 0;
                return (
                  <li key={s.id} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-label-lg text-on-surface">{s.name}</span>
                        {s.contactName && (
                          <span className="flex items-center gap-1 text-body-sm text-on-surface-variant">
                            <UserRound className="size-3.5" />
                            {s.contactName}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge tone={count > 0 ? 'info' : 'neutral'}>{formatNumber(count)} prod.</Badge>
                        {actions(s)}
                      </div>
                    </div>
                    {(s.phone || s.email) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {s.phone && <ContactLink href={`tel:${s.phone}`} icon={Phone} text={s.phone} />}
                        {s.email && <ContactLink href={`mailto:${s.email}`} icon={Mail} text={s.email} />}
                      </div>
                    )}
                    {s.notes && <p className="line-clamp-2 text-body-sm text-on-surface-variant">{s.notes}</p>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <SupplierModal
        key={editing === 'new' ? 'new' : (editing?.id ?? 'closed')}
        supplier={editing}
        linked={editing && editing !== 'new' ? (productsBySupplier.get(editing.id) ?? []) : []}
        existingNames={suppliers.filter((s) => editing === 'new' || s.id !== editing?.id).map((s) => s.name)}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Truck }) {
  return (
    <Card className="flex items-center gap-3 p-3 sm:p-4">
      <div className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
        <Icon className="size-5" />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[10px] leading-tight font-bold text-on-surface-variant uppercase sm:text-label-sm sm:tracking-wider">{label}</span>
        <span className="text-headline-md text-on-surface tnum">{value}</span>
      </div>
    </Card>
  );
}

function ContactLink({ href, icon: Icon, text }: { href: string; icon: typeof Phone; text: string }) {
  return (
    <a href={href} className="inline-flex max-w-full items-center gap-1.5 text-body-md text-secondary hover:underline">
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{text}</span>
    </a>
  );
}

function SupplierModal({
  supplier,
  linked,
  existingNames,
  onClose
}: {
  supplier: Supplier | 'new' | null;
  linked: Product[];
  existingNames: string[];
  onClose: () => void;
}) {
  const { businessId } = useActiveBusiness();
  const toast = useToast();
  const isNew = supplier === 'new';
  const initial = supplier && supplier !== 'new' ? supplier : null;

  const [form, setForm] = useState<SupplierInput>({
    name: initial?.name ?? '',
    contactName: initial?.contactName ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    notes: initial?.notes ?? ''
  });
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const set = (k: keyof SupplierInput, value: string) => setForm((f) => ({ ...f, [k]: value }));

  const name = form.name.trim();
  const duplicate = existingNames.some((n) => normalize(n) === normalize(name));
  const errors = {
    name: !name ? 'El nombre es obligatorio.' : duplicate ? 'Ya existe un proveedor con ese nombre.' : null,
    email: form.email?.trim() && !EMAIL_RE.test(form.email.trim()) ? 'El correo no es válido.' : null
  };
  const valid = !errors.name && !errors.email;

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      if (isNew) {
        await createSupplier(businessId, form);
        toast.success(`Proveedor “${name}” agregado`);
      } else if (initial) {
        await updateSupplier(businessId, initial.id, form);
        // Los productos guardan una copia del nombre del proveedor: se mantiene al día.
        if (name !== initial.name && linked.length) await setProductsSupplier(businessId, linked, { id: initial.id, name });
        toast.success('Proveedor actualizado');
      }
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!supplier}
      onClose={onClose}
      dismissible={!saving}
      title={isNew ? 'Nuevo proveedor' : 'Editar proveedor'}
      subtitle={isNew ? 'Datos de contacto para tus pedidos y compras.' : linked.length ? `${formatNumber(linked.length)} producto(s) asociados` : 'Sin productos asociados'}
      icon={Truck}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving} disabled={touched && !valid}>
            {isNew ? 'Agregar proveedor' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Nombre o razón social" required htmlFor="sup-name" error={touched ? errors.name : null} className="sm:col-span-2">
          <Input id="sup-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={120} autoFocus invalid={touched && !!errors.name} placeholder="Ej. Distribuidora del Centro" />
        </Field>
        <Field label="Persona de contacto" htmlFor="sup-contact">
          <Input id="sup-contact" icon={UserRound} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} maxLength={120} placeholder="Opcional" />
        </Field>
        <Field label="Teléfono" htmlFor="sup-phone">
          <Input id="sup-phone" type="tel" icon={Phone} value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={30} placeholder="Opcional" />
        </Field>
        <Field label="Correo" htmlFor="sup-email" error={touched ? errors.email : null} className="sm:col-span-2">
          <Input id="sup-email" type="email" icon={Mail} value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={120} placeholder="Opcional" invalid={touched && !!errors.email} />
        </Field>
        <Field label="Notas" htmlFor="sup-notes" hint="Días de visita, condiciones de pago, cuenta bancaria…" className="sm:col-span-2">
          <Textarea id="sup-notes" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={500} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
