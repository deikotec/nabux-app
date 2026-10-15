import { useEffect, useRef, useState, type DragEvent } from 'react';
import {
  Banknote,
  BadgeCheck,
  CircleCheck,
  CloudUpload,
  CopyPlus,
  Image as ImageIcon,
  MapPin,
  Package,
  Pencil,
  Receipt,
  RefreshCw,
  ScanBarcode,
  SquarePlus,
  Trash,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Warehouse,
  WandSparkles
} from 'lucide-react';
import { Button, Field, FormSection, Input, Modal, NumberInput, Select, Toggle, useToast } from '@/components/ui';
import { UNITS } from '@/config/app';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useOnline } from '@/hooks/data';
import { formatNumber, formatPercent } from '@/lib/format';
import { cn, errorMessage, generateEan13, generateSku, marginPct, normalize, round2 } from '@/lib/utils';
import { createProduct, newProductId, updateProduct, uploadProductImage } from '@/services/products';
import type { Product, ProductInput } from '@/types';
import { commitWrite, MARGIN_CHIP, marginTone } from './helpers';

const NEW_CATEGORY = '__new__';
/** Proveedor guardado solo por nombre (ej. importado de CSV) que no existe en el catálogo de proveedores. */
const KEEP_SUPPLIER = '__keep__';
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

interface FormState {
  name: string;
  barcode: string;
  sku: string;
  unit: string;
  category: string;
  categoryMode: 'list' | 'new';
  newCategory: string;
  brand: string;
  costPrice: number | '';
  salePrice: number | '';
  stock: number | '';
  minStock: number | '';
  location: string;
  supplierId: string;
  active: boolean;
}

type FieldKey = 'name' | 'barcode' | 'sku' | 'category' | 'costPrice' | 'salePrice' | 'stock' | 'minStock';
type Errors = Partial<Record<FieldKey, string>>;

const FIELD_ORDER: FieldKey[] = ['name', 'barcode', 'sku', 'category', 'costPrice', 'salePrice', 'stock', 'minStock'];
const fieldId = (k: FieldKey) => `pf-${k}`;

export interface ProductFormDefaults {
  category?: string;
  supplierId?: string;
}

export function ProductFormModal({ product, defaults, onClose }: { product: Product | null; defaults?: ProductFormDefaults; onClose: () => void }) {
  const { business, businessId, actor, money, currencySymbol } = useActiveBusiness();
  const { products, productsById, suppliers, categories } = useCatalog();
  const online = useOnline();
  const toast = useToast();
  const settings = business.settings;
  const editing = !!product;

  const [initialStock] = useState<number | ''>(() => (product ? Number(product.stock) || 0 : ''));
  const blank = (): FormState => ({
    name: '',
    barcode: '',
    sku: '',
    unit: 'Unidad',
    category: defaults?.category ?? '',
    categoryMode: categories.length === 0 ? 'new' : 'list',
    newCategory: '',
    brand: '',
    costPrice: '',
    salePrice: '',
    stock: '',
    minStock: settings.lowStockDefault,
    location: '',
    supplierId: defaults?.supplierId ?? '',
    active: true
  });

  const [form, setForm] = useState<FormState>(() =>
    product
      ? {
          name: product.name,
          barcode: product.barcode ?? '',
          sku: product.sku,
          unit: product.unit || 'Unidad',
          category: product.category,
          categoryMode: 'list',
          newCategory: '',
          brand: product.brand ?? '',
          costPrice: Number(product.costPrice) || 0,
          salePrice: Number(product.salePrice) || 0,
          stock: initialStock,
          minStock: Number(product.minStock) || 0,
          location: product.location ?? '',
          supplierId: product.supplierId ?? (product.supplierName ? KEEP_SUPPLIER : ''),
          active: product.active !== false
        }
      : blank()
  );
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState<'save' | 'another' | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [remoteImage, setRemoteImage] = useState<string | null>(product?.imageUrl ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const newCategoryRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if ((FIELD_ORDER as string[]).includes(key as string)) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const others = products.filter((p) => p.id !== product?.id);
  const effectiveCategory = (form.categoryMode === 'new' ? form.newCategory : form.category).trim();

  /* ---------- Generadores ---------- */

  const codeTaken = (code: string) => {
    const k = normalize(code);
    return others.some((p) => normalize(p.barcode) === k || normalize(p.sku) === k);
  };

  const generateBarcode = () => {
    let code = generateEan13();
    for (let i = 0; i < 20 && codeTaken(code); i++) code = generateEan13();
    set('barcode', code);
  };

  const autoSku = () => {
    let sku = generateSku(settings.skuPrefix, effectiveCategory).toUpperCase();
    for (let i = 0; i < 20 && codeTaken(sku); i++) sku = generateSku(settings.skuPrefix, effectiveCategory).toUpperCase();
    set('sku', sku);
  };

  /* ---------- Precios y margen ---------- */

  const cost = Number(form.costPrice) || 0;
  const price = Number(form.salePrice) || 0;
  const pct = price > 0 ? marginPct(cost, price) : null;
  const tone = pct === null ? null : marginTone(pct, settings.minMarginPct);
  const profit = round2(price - cost);
  const suggested = cost > 0 && settings.minMarginPct < 100 ? Math.ceil((cost / (1 - settings.minMarginPct / 100)) * 100) / 100 : null;
  const taxRate = Number(business.taxRate) || 0;

  /* ---------- Imagen ---------- */

  const pickFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      toast.error('Formato no soportado. Usa PNG, JPG o WebP.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('La imagen es demasiado grande (máx. 15 MB).');
      return;
    }
    setImageFile(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setRemoteImage(null);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  const shownImage = previewUrl ?? remoteImage;

  /* ---------- Guardado ---------- */

  const validate = (): Errors => {
    const e: Errors = {};
    if (!form.name.trim()) e.name = 'Escribe el nombre del producto.';
    const sku = form.sku.trim();
    if (!sku) e.sku = 'El SKU es obligatorio. Escríbelo o usa "Auto".';
    else {
      const k = normalize(sku);
      const dup = others.find((p) => normalize(p.sku) === k || normalize(p.barcode) === k);
      if (dup) e.sku = `Ya lo usa "${dup.name}".`;
    }
    const barcode = form.barcode.trim();
    if (barcode) {
      const k = normalize(barcode);
      const dup = others.find((p) => normalize(p.barcode) === k || normalize(p.sku) === k);
      if (dup) e.barcode = `Este código ya está registrado en "${dup.name}".`;
    }
    if (!effectiveCategory) e.category = form.categoryMode === 'new' ? 'Escribe el nombre de la categoría.' : 'Elige una categoría.';
    if (form.salePrice === '' || price <= 0) e.salePrice = 'El precio de venta debe ser mayor a 0.';
    if (cost < 0) e.costPrice = 'El costo no puede ser negativo.';
    if (form.stock !== '' && Number(form.stock) < 0 && !settings.allowNegativeStock) e.stock = 'El stock no puede ser negativo.';
    if (form.minStock !== '' && Number(form.minStock) < 0) e.minStock = 'El mínimo no puede ser negativo.';
    return e;
  };

  const resetForAnother = () => {
    setForm((f) => ({
      ...blank(),
      category: effectiveCategory,
      categoryMode: 'list',
      unit: f.unit,
      supplierId: f.supplierId,
      minStock: f.minStock
    }));
    setErrors({});
    setImageFile(null);
    setRemoteImage(null);
    setTimeout(() => nameRef.current?.focus(), 30);
  };

  const save = async (another: boolean) => {
    if (saving) return;
    const errs = validate();
    setErrors(errs);
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (first) {
      document.getElementById(fieldId(first))?.focus();
      return;
    }
    if (imageFile && !online) {
      toast.error('Sin conexión no se pueden subir imágenes. Quita la imagen o espera a reconectarte.');
      return;
    }
    setSaving(another ? 'another' : 'save');
    const onLateError = (e: unknown) => toast.error(errorMessage(e));
    try {
      const supplier = suppliers.find((s) => s.id === form.supplierId);
      const base: ProductInput = {
        name: form.name.trim(),
        sku: form.sku.trim().toUpperCase(),
        barcode: form.barcode.trim(),
        category: effectiveCategory,
        brand: form.brand.trim(),
        unit: form.unit,
        costPrice: round2(cost),
        salePrice: round2(price),
        stock: Number(form.stock) || 0,
        minStock: Number(form.minStock) || 0,
        location: form.location.trim(),
        supplierId: supplier?.id ?? null,
        supplierName: supplier?.name ?? (form.supplierId === KEEP_SUPPLIER ? (product?.supplierName ?? null) : null),
        active: form.active
      };

      if (!product) {
        const id = newProductId(businessId);
        let image: Pick<ProductInput, 'imageUrl' | 'imagePath'> = { imageUrl: null, imagePath: null };
        if (imageFile) {
          const up = await uploadProductImage(businessId, id, imageFile);
          image = { imageUrl: up.url, imagePath: up.path };
        }
        await commitWrite(createProduct(businessId, actor, { ...base, ...image }, id), online, onLateError);
        toast.success(online ? `"${base.name}" se agregó al catálogo.` : `"${base.name}" se guardó y se sincronizará al reconectar.`);
        if (another) {
          resetForAnother();
          setSaving(null);
        } else onClose();
        return;
      }

      // Edición: usar el documento más reciente para no revertir ventas hechas mientras se editaba.
      const latest = productsById.get(product.id) ?? product;
      let image: Pick<ProductInput, 'imageUrl' | 'imagePath'> = remoteImage
        ? { imageUrl: latest.imageUrl ?? null, imagePath: latest.imagePath ?? null }
        : { imageUrl: null, imagePath: null };
      if (imageFile) {
        const up = await uploadProductImage(businessId, product.id, imageFile);
        image = { imageUrl: up.url, imagePath: up.path };
      }
      const stockTouched = form.stock !== initialStock;
      const input: ProductInput = { ...base, ...image, stock: stockTouched ? Number(form.stock) || 0 : Number(latest.stock) || 0 };
      await commitWrite(updateProduct(businessId, actor, latest, input), online, onLateError);
      toast.success(online ? 'Cambios guardados.' : 'Cambios guardados. Se sincronizarán al reconectar.');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
      setSaving(null);
    }
  };

  /* ---------- Opciones ---------- */

  const unitOptions = UNITS.includes(form.unit) ? UNITS : [form.unit, ...UNITS];
  const categoryOptions = Array.from(new Set([...categories, ...(form.categoryMode === 'list' && form.category ? [form.category] : [])])).sort((a, b) =>
    a.localeCompare(b, 'es')
  );
  const liveStock = product ? Number(productsById.get(product.id)?.stock ?? product.stock) || 0 : 0;

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="xl"
      icon={editing ? Pencil : SquarePlus}
      title={editing ? 'Editar producto' : 'Registrar nuevo producto'}
      badge={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-2 py-0.5 text-label-sm text-on-surface-variant">
          <span className="size-1.5 rounded-full bg-primary" />
          {business.name}
        </span>
      }
      subtitle={editing ? `${product.name} · SKU ${product.sku}` : 'Ingresa los datos del artículo, código de barras y niveles de stock.'}
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={!!saving} className="sm:mr-auto">
            Cancelar
          </Button>
          {!editing && (
            <Button variant="secondary" icon={CopyPlus} onClick={() => save(true)} loading={saving === 'another'} disabled={!!saving}>
              Guardar y agregar otro
            </Button>
          )}
          <Button icon={CircleCheck} onClick={() => save(false)} loading={saving === 'save'} disabled={!!saving}>
            {editing ? 'Guardar cambios' : 'Guardar producto'}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-7"
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
      >
        {/* 1. Información general */}
        <FormSection icon={Package} title="1. Información general">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <Field label="Nombre del producto" required htmlFor={fieldId('name')} error={errors.name} className="md:col-span-12">
              <Input
                ref={nameRef}
                id={fieldId('name')}
                data-autofocus
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Ej. Aceite de oliva extra virgen 500 ml"
                invalid={!!errors.name}
                maxLength={120}
              />
            </Field>

            <Field label="Código de barras (EAN-13)" htmlFor={fieldId('barcode')} error={errors.barcode} hint="Escanéalo con el lector o genera uno interno." className="md:col-span-7">
              <Input
                id={fieldId('barcode')}
                icon={ScanBarcode}
                value={form.barcode}
                onChange={(e) => set('barcode', e.target.value.trim())}
                onKeyDown={(e) => {
                  // Los lectores envían Enter al final: no enviar el formulario.
                  if (e.key === 'Enter') e.preventDefault();
                }}
                placeholder="7501234567890"
                inputMode="numeric"
                autoComplete="off"
                invalid={!!errors.barcode}
                className="tnum"
                suffix={
                  <button
                    type="button"
                    onClick={generateBarcode}
                    className="inline-flex items-center gap-1 rounded-md bg-surface-container px-2 py-1 text-label-sm text-primary transition-colors hover:bg-surface-container-high"
                  >
                    <RefreshCw className="size-3.5" />
                    Generar
                  </button>
                }
              />
            </Field>

            <Field label="SKU" required htmlFor={fieldId('sku')} error={errors.sku} hint="Clave interna única." className="md:col-span-5">
              <Input
                id={fieldId('sku')}
                value={form.sku}
                onChange={(e) => set('sku', e.target.value.toUpperCase())}
                placeholder={`${settings.skuPrefix || 'PRD'}-00001`}
                autoComplete="off"
                invalid={!!errors.sku}
                className="tnum"
                suffix={
                  <button
                    type="button"
                    onClick={autoSku}
                    className="inline-flex items-center gap-1 rounded-md bg-surface-container px-2 py-1 text-label-sm text-primary transition-colors hover:bg-surface-container-high"
                    title="Generar SKU automático"
                  >
                    <WandSparkles className="size-3.5" />
                    Auto
                  </button>
                }
              />
            </Field>

            {form.categoryMode === 'list' ? (
              <Field label="Categoría" required htmlFor={fieldId('category')} error={errors.category} className="md:col-span-5">
                <Select
                  id={fieldId('category')}
                  value={form.category}
                  onChange={(e) => {
                    if (e.target.value === NEW_CATEGORY) {
                      setForm((f) => ({ ...f, categoryMode: 'new', newCategory: '' }));
                      setErrors((er) => ({ ...er, category: undefined }));
                      setTimeout(() => newCategoryRef.current?.focus(), 0);
                    } else set('category', e.target.value);
                  }}
                  placeholder="Selecciona una categoría"
                  aria-invalid={!!errors.category}
                >
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value={NEW_CATEGORY}>+ Nueva categoría…</option>
                </Select>
              </Field>
            ) : (
              <Field
                label="Nueva categoría"
                required
                htmlFor={fieldId('category')}
                error={errors.category}
                hint="Se asignará solo a este producto."
                className="md:col-span-5"
                aside={
                  categories.length > 0 ? (
                    <button
                      type="button"
                      className="text-label-sm text-primary hover:underline"
                      onClick={() => {
                        setForm((f) => ({ ...f, categoryMode: 'list' }));
                        setErrors((er) => ({ ...er, category: undefined }));
                      }}
                    >
                      Elegir existente
                    </button>
                  ) : undefined
                }
              >
                <Input
                  ref={newCategoryRef}
                  id={fieldId('category')}
                  value={form.newCategory}
                  onChange={(e) => set('newCategory', e.target.value)}
                  placeholder="Ej. Abarrotes"
                  maxLength={40}
                  invalid={!!errors.category}
                />
              </Field>
            )}

            <Field label="Unidad de medida" htmlFor="pf-unit" className="md:col-span-3">
              <Select id="pf-unit" value={form.unit} onChange={(e) => set('unit', e.target.value)} options={unitOptions.map((u) => ({ value: u, label: u }))} />
            </Field>

            <Field label="Marca / fabricante" htmlFor="pf-brand" className="md:col-span-4">
              <Input id="pf-brand" value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Ej. Molinos del Valle" maxLength={60} />
            </Field>
          </div>
        </FormSection>

        {/* 2. Precios y márgenes */}
        <FormSection icon={Banknote} title="2. Precios y márgenes de ganancia">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label={`Costo proveedor (${currencySymbol})`} htmlFor={fieldId('costPrice')} error={errors.costPrice} hint="Lo que te cuesta cada unidad.">
              <NumberInput
                id={fieldId('costPrice')}
                value={form.costPrice}
                onValueChange={(v) => set('costPrice', v)}
                prefix={currencySymbol}
                placeholder="0.00"
                invalid={!!errors.costPrice}
              />
            </Field>
            <Field label={`Precio de venta final (${currencySymbol})`} required htmlFor={fieldId('salePrice')} error={errors.salePrice} hint="El que se cobra en caja.">
              <NumberInput
                id={fieldId('salePrice')}
                value={form.salePrice}
                onValueChange={(v) => set('salePrice', v)}
                prefix={currencySymbol}
                placeholder="0.00"
                invalid={!!errors.salePrice}
                className="font-semibold"
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-label-md text-slate-700">Impuesto</span>
              <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-body-md text-on-surface">
                <Receipt className="size-[18px] shrink-0 text-slate-400" />
                <span className="truncate">
                  {taxRate > 0 ? `${business.taxName} ${formatNumber(taxRate, business.locale)}% · ${business.pricesIncludeTax ? 'incluido' : 'se suma al cobrar'}` : 'Sin impuesto configurado'}
                </span>
              </div>
              <p className="text-body-sm text-slate-500 tnum">
                {taxRate <= 0
                  ? 'Configúralo en Ajustes del negocio.'
                  : price <= 0
                    ? 'Según la configuración del negocio.'
                    : business.pricesIncludeTax
                      ? `Base sin ${business.taxName}: ${money(round2(price / (1 + taxRate / 100)))}`
                      : `Total al cliente: ${money(round2(price * (1 + taxRate / 100)))}`}
              </p>
            </div>
          </div>

          <div
            className={cn(
              'flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between',
              tone === 'good' && 'border-primary-fixed bg-surface-container-low',
              tone === 'warn' && 'border-amber-200 bg-amber-50/70',
              tone === 'bad' && 'border-red-200 bg-red-50/70',
              tone === null && 'border-slate-200 bg-slate-50'
            )}
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full',
                  tone === 'good' && 'bg-primary-fixed text-on-primary-fixed',
                  tone === 'warn' && 'bg-amber-100 text-amber-700',
                  tone === 'bad' && 'bg-red-100 text-red-700',
                  tone === null && 'bg-slate-200 text-slate-500'
                )}
              >
                {tone === 'bad' ? <TrendingDown className="size-[18px]" /> : <TrendingUp className="size-[18px]" />}
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-label-md text-on-surface-variant">Margen bruto calculado:</span>
                  {pct === null || tone === null ? (
                    <span className="text-label-md text-slate-400">—</span>
                  ) : (
                    <span className={cn('rounded-md px-1.5 py-0.5 text-label-sm tnum', MARGIN_CHIP[tone])}>{formatPercent(pct, 1, true)}</span>
                  )}
                </div>
                <span className="text-body-sm text-on-surface-variant">
                  {pct === null ? (
                    'Ingresa el costo y el precio para calcular tu ganancia.'
                  ) : (
                    <>
                      Ganancia estimada de{' '}
                      <strong className={cn('tnum', profit > 0 ? 'text-primary' : 'text-error')}>
                        {profit > 0 ? '+' : ''}
                        {money(profit)}
                      </strong>{' '}
                      por unidad vendida.
                    </>
                  )}
                </span>
                {(tone === 'warn' || tone === 'bad') && (
                  <span className={cn('flex items-center gap-1 text-body-sm', tone === 'bad' ? 'text-red-700' : 'text-amber-800')}>
                    <TriangleAlert className="size-3.5 shrink-0" />
                    {tone === 'bad' ? 'El precio no cubre el costo.' : `Por debajo del margen mínimo recomendado (${settings.minMarginPct}%).`}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {tone === 'good' && <BadgeCheck className="hidden size-5 text-primary sm:block" aria-label="Margen saludable" />}
              {suggested !== null && (
                <Button
                  size="sm"
                  variant={tone === 'good' ? 'ghost' : 'tonal'}
                  icon={WandSparkles}
                  onClick={() => set('salePrice', suggested)}
                  title={`Precio con el margen mínimo de ${settings.minMarginPct}%`}
                >
                  Sugerir precio · {money(suggested)}
                </Button>
              )}
            </div>
          </div>
        </FormSection>

        {/* 3. Stock, proveedor y ubicación */}
        <FormSection icon={Warehouse} title="3. Stock, proveedor y ubicación">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field
              label={editing ? 'Stock actual' : 'Stock inicial'}
              htmlFor={fieldId('stock')}
              error={errors.stock}
              hint={
                editing
                  ? liveStock !== initialStock && form.stock === initialStock
                    ? `Cambió a ${formatNumber(liveStock, business.locale)} mientras editabas; se respetará.`
                    : 'Si lo cambias, se registra como ajuste en el kardex.'
                  : undefined
              }
            >
              <NumberInput
                id={fieldId('stock')}
                value={form.stock}
                onValueChange={(v) => set('stock', v)}
                allowNegative={settings.allowNegativeStock}
                placeholder="0"
                suffix={form.unit}
                invalid={!!errors.stock}
              />
            </Field>
            <Field label="Stock mínimo (alerta)" htmlFor={fieldId('minStock')} error={errors.minStock}>
              <NumberInput
                id={fieldId('minStock')}
                value={form.minStock}
                onValueChange={(v) => set('minStock', v)}
                placeholder={String(settings.lowStockDefault)}
                invalid={!!errors.minStock}
              />
            </Field>
            <Field label="Ubicación en bodega / pasillo" htmlFor="pf-location" className="col-span-2">
              <Input id="pf-location" icon={MapPin} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Ej. Pasillo 3 · Góndola B2" maxLength={60} />
            </Field>
            <Field label="Proveedor asignado" htmlFor="pf-supplier" className="col-span-2 md:col-span-4" hint={suppliers.length === 0 ? 'Aún no tienes proveedores registrados.' : undefined}>
              <Select id="pf-supplier" value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
                <option value="">Sin proveedor</option>
                {form.supplierId === KEEP_SUPPLIER && product?.supplierName && <option value={KEEP_SUPPLIER}>{product.supplierName} (no registrado)</option>}
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </FormSection>

        {/* 4. Imagen */}
        <FormSection icon={ImageIcon} title="4. Imagen del producto">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn('rounded-xl transition-colors', dragging && 'bg-primary-fixed/20 ring-2 ring-primary')}
          >
            {shownImage ? (
              <div className="flex flex-col items-start gap-4 rounded-xl border border-slate-200 bg-surface-container-low p-3 sm:flex-row sm:items-center">
                <img src={shownImage} alt={`Vista previa de ${form.name || 'la imagen'}`} className="size-28 shrink-0 rounded-xl border border-slate-200 bg-white object-cover" />
                <div className="flex min-w-0 flex-col gap-2">
                  <span className="truncate text-label-lg text-on-surface">{imageFile ? imageFile.name : 'Imagen actual'}</span>
                  <span className="text-body-sm text-on-surface-variant">
                    {imageFile ? `${formatNumber(imageFile.size / 1024 / 1024, business.locale, 1)} MB · se optimizará al guardar` : 'Arrastra otra imagen aquí para reemplazarla.'}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => fileRef.current?.click()}>
                      Cambiar
                    </Button>
                    <Button size="sm" variant="danger" icon={Trash} onClick={removeImage}>
                      Quitar
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="group flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant/70 bg-surface-container-low px-4 py-6 text-center transition-colors hover:border-primary focus-visible:border-primary"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors group-hover:text-primary">
                  <CloudUpload className="size-6" />
                </span>
                <span className="text-body-md text-on-surface-variant">
                  <span className="text-label-lg text-primary">Haz clic para subir una imagen</span> o arrástrala aquí
                </span>
                <span className="text-body-sm text-on-surface-variant/80">PNG, JPG o WebP (máx. 15 MB). Se optimiza automáticamente para el POS.</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={IMAGE_TYPES.join(',')}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        </FormSection>

        {editing && (
          <Toggle
            checked={form.active}
            onChange={(v) => set('active', v)}
            label="Producto activo"
            description="Los productos inactivos no aparecen en el punto de venta, pero conservan su historial."
          />
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
