import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, ClipboardCheck, PackageMinus, PackagePlus, TriangleAlert } from 'lucide-react';
import { Button, Field, Input, Modal, NumberInput, ProductThumb, Select, StockBadge, useToast } from '@/components/ui';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useOnline } from '@/hooks/data';
import { formatNumber } from '@/lib/format';
import { cn, errorMessage, round2 } from '@/lib/utils';
import { adjustStock, setStockCount } from '@/services/products';
import { FromLocalHelper, FromLocalTrigger } from './FxBits';
import { commitWrite, DEFAULT_REASON, MOVE_REASONS, type MoveType } from './helpers';
import { useInventoryFx } from './useInventoryFx';

const TYPES: { value: MoveType; label: string; description: string; icon: LucideIcon; active: string; iconTone: 'primary' | 'danger' | 'secondary' }[] = [
  {
    value: 'in',
    label: 'Entrada de mercancía',
    description: 'Compras, devoluciones',
    icon: PackagePlus,
    active: 'border-primary bg-primary-fixed/20 text-primary',
    iconTone: 'primary'
  },
  {
    value: 'out',
    label: 'Salida o merma',
    description: 'Daños, caducidad, uso interno',
    icon: PackageMinus,
    active: 'border-red-300 bg-red-50 text-red-700',
    iconTone: 'danger'
  },
  {
    value: 'adjust',
    label: 'Ajuste por conteo físico',
    description: 'Iguala al stock contado',
    icon: ClipboardCheck,
    active: 'border-secondary/50 bg-secondary-fixed/50 text-secondary',
    iconTone: 'secondary'
  }
];

export function StockAdjustModal({ productId, initialType, onClose }: { productId: string; initialType: MoveType; onClose: () => void }) {
  const { business, businessId, actor, money, currencySymbol } = useActiveBusiness();
  const { productsById } = useCatalog();
  const ifx = useInventoryFx();
  const online = useOnline();
  const toast = useToast();
  const product = productsById.get(productId);
  const [bsOpen, setBsOpen] = useState(false);

  const [type, setType] = useState<MoveType>(initialType);
  const [qty, setQty] = useState<number | ''>('');
  const [reason, setReason] = useState<string>(DEFAULT_REASON[initialType]);
  const [otherReason, setOtherReason] = useState('');
  const [unitCost, setUnitCost] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  // Si el producto se elimina mientras el modal está abierto, se cierra.
  useEffect(() => {
    if (!product) onClose();
  }, [product, onClose]);

  if (!product) return null;

  const locale = business.locale;
  const unit = product.unit || 'u';
  const current = Number(product.stock) || 0;
  const amount = qty === '' ? null : Number(qty);
  const resulting = amount === null ? null : type === 'in' ? current + amount : type === 'out' ? current - amount : amount;
  const delta = resulting === null ? 0 : round2(resulting - current);
  const blockNegative = !business.settings.allowNegativeStock;
  const finalReason = reason === 'Otro' ? otherReason.trim() : reason;

  let error: string | null = null;
  if (amount === null) error = type === 'adjust' ? 'Ingresa el stock contado.' : 'Ingresa la cantidad.';
  else if (type !== 'adjust' && amount <= 0) error = 'La cantidad debe ser mayor a 0.';
  else if (type === 'adjust' && amount < 0) error = 'El stock contado no puede ser negativo.';
  else if (resulting !== null && resulting < 0 && blockNegative) error = `La salida supera el stock disponible (${formatNumber(current, locale)} ${unit}).`;
  else if (type === 'adjust' && delta === 0) error = 'El stock contado coincide con el sistema: no hay nada que ajustar.';
  else if (reason === 'Otro' && !finalReason) error = 'Describe el motivo del movimiento.';

  const changeType = (t: MoveType) => {
    setType(t);
    setReason(DEFAULT_REASON[t]);
    setQty('');
    setTouched(false);
    setBsOpen(false);
  };

  const costHint =
    ifx.local && unitCost !== '' && unitCost > 0 ? (
      <span className="tnum">
        <span className="font-medium">≈ {ifx.local(unitCost)}</span> a la tasa actual · antes {money(product.costPrice)}
      </span>
    ) : (
      `Opcional. Actualiza el costo del producto (actual: ${money(product.costPrice)}${ifx.local ? ` · ${ifx.local(product.costPrice)}` : ''}).`
    );

  const submit = async () => {
    setTouched(true);
    if (error || amount === null) return;
    setSaving(true);
    try {
      const latest = productsById.get(productId) ?? product;
      const write =
        type === 'adjust'
          ? setStockCount(businessId, actor, latest, amount, finalReason)
          : adjustStock(businessId, actor, latest, {
              delta: type === 'in' ? amount : -amount,
              type,
              reason: finalReason,
              unitCost: type === 'in' && unitCost !== '' && unitCost > 0 ? unitCost : null
            });
      await commitWrite(write, online, (e) => toast.error(errorMessage(e)));
      const verb = type === 'in' ? 'Entrada registrada' : type === 'out' ? 'Salida registrada' : 'Ajuste registrado';
      toast.success(online ? `${verb}: ${product.name}` : `${verb}. Se sincronizará al recuperar la conexión.`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
      setSaving(false);
    }
  };

  const meta = TYPES.find((t) => t.value === type)!;

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="lg"
      icon={meta.icon}
      iconTone={meta.iconTone}
      title="Movimiento de stock"
      subtitle="Registra entradas, salidas o ajustes. Todo queda en el kardex del producto."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button icon={meta.icon} onClick={submit} loading={saving} disabled={touched && !!error}>
            {type === 'in' ? 'Registrar entrada' : type === 'out' ? 'Registrar salida' : 'Aplicar ajuste'}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {/* Producto */}
        <div className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
          <ProductThumb product={product} size="md" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-label-lg text-on-surface">{product.name}</span>
            <span className="truncate text-body-sm text-on-surface-variant tnum">
              {product.sku}
              {product.supplierName ? ` · ${product.supplierName}` : ''}
            </span>
          </div>
          <StockBadge product={product} />
        </div>

        {/* Tipo */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-label-md text-slate-700">Tipo de movimiento</legend>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
            {TYPES.map((t) => {
              const active = t.value === type;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => changeType(t.value)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors sm:flex-col sm:items-start',
                    active ? t.active : 'border-slate-200 bg-white text-on-surface hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  <t.icon className="size-5 shrink-0" />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-label-md">{t.label}</span>
                    <span className={cn('text-body-sm', active ? 'opacity-80' : 'text-on-surface-variant')}>{t.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Cantidad y costo */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={type === 'adjust' ? 'Stock contado' : 'Cantidad'} required htmlFor="move-qty" hint={type === 'adjust' ? 'Lo que hay físicamente en anaquel y bodega.' : type === 'in' ? 'Cuánto llegó.' : 'Cuánto sale del inventario.'}>
            <NumberInput
              id="move-qty"
              data-autofocus
              value={qty}
              onValueChange={setQty}
              allowDecimals
              suffix={unit}
              inputSize="lg"
              invalid={touched && !!error && (amount === null || amount <= 0)}
              placeholder={type === 'adjust' ? String(current) : '0'}
            />
          </Field>
          {type === 'in' ? (
            <Field
              label={ifx.dual ? `Costo unitario (${currencySymbol})` : 'Costo unitario'}
              htmlFor="move-cost"
              hint={costHint}
              aside={<FromLocalTrigger ifx={ifx} active={bsOpen} onClick={() => setBsOpen((o) => !o)} />}
            >
              <NumberInput id="move-cost" value={unitCost} onValueChange={setUnitCost} allowDecimals prefix={currencySymbol} inputSize="lg" placeholder={String(product.costPrice || '0.00')} />
            </Field>
          ) : type === 'adjust' ? (
            <div className="flex flex-col justify-center rounded-xl border border-dashed border-slate-300 px-4 py-3">
              <span className="text-label-sm text-on-surface-variant uppercase">Diferencia</span>
              <span className={cn('text-headline-md tnum', delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-error' : 'text-on-surface-variant')}>
                {delta > 0 ? '+' : delta < 0 ? '−' : ''}
                {formatNumber(Math.abs(delta), locale)} {unit}
              </span>
              <span className="text-body-sm text-on-surface-variant">{delta > 0 ? 'Sobrante contra el sistema' : delta < 0 ? 'Faltante contra el sistema' : 'Sin diferencia'}</span>
            </div>
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>

        {type === 'in' && bsOpen && ifx.dual && ifx.rate && (
          <FromLocalHelper
            ifx={ifx}
            title="Calcular el costo unitario desde Bs"
            applyLabel="Usar como costo"
            money={money}
            onApply={(usd) => {
              setUnitCost(usd);
              setBsOpen(false);
              setTimeout(() => document.getElementById('move-cost')?.focus(), 30);
            }}
            onClose={() => setBsOpen(false)}
          />
        )}

        {/* Motivo */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Motivo" required htmlFor="move-reason">
            <Select id="move-reason" value={reason} onChange={(e) => setReason(e.target.value)} options={MOVE_REASONS.map((r) => ({ value: r, label: r }))} />
          </Field>
          {reason === 'Otro' && (
            <Field label="Describe el motivo" required htmlFor="move-other">
              <Input id="move-other" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} placeholder="Ej. Muestra para cliente" maxLength={120} />
            </Field>
          )}
        </div>

        {/* Resultado */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container-low px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-label-sm text-on-surface-variant uppercase">Stock actual</span>
              <span className="text-headline-sm text-on-surface tnum">
                {formatNumber(current, locale)} <span className="text-body-sm text-on-surface-variant">{unit}</span>
              </span>
            </div>
            <ArrowRight className="size-5 text-on-surface-variant" aria-hidden />
            <div className="flex flex-col">
              <span className="text-label-sm text-on-surface-variant uppercase">Stock resultante</span>
              <span
                className={cn(
                  'text-headline-sm tnum',
                  resulting === null ? 'text-slate-400' : resulting < 0 ? 'text-error' : resulting <= (Number(product.minStock) || 0) ? 'text-amber-700' : 'text-primary'
                )}
              >
                {resulting === null ? '—' : formatNumber(resulting, locale)} <span className="text-body-sm text-on-surface-variant">{unit}</span>
              </span>
            </div>
          </div>
          {resulting !== null && resulting > 0 && resulting <= (Number(product.minStock) || 0) && (
            <span className="text-body-sm text-amber-700">Seguirá bajo el mínimo ({formatNumber(product.minStock, locale)})</span>
          )}
        </div>

        {touched && error && (
          <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-body-sm text-red-800" role="alert">
            <TriangleAlert className="mt-px size-4 shrink-0" />
            {error}
          </p>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
