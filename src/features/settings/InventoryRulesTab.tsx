import { useMemo, useState } from 'react';
import {
  BellRing,
  Boxes,
  ChartColumn,
  ClipboardCheck,
  Coins,
  Hash,
  ListChecks,
  ScanBarcode,
  ShoppingCart,
  TriangleAlert,
  Volume2
} from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useOnline } from '@/hooks/data';
import { formatNumber, formatPercent } from '@/lib/format';
import { beep, cn, errorMessage, generateSku, marginPct, stockStatus } from '@/lib/utils';
import { logActivity } from '@/services/activity';
import { updateInventorySettings } from '@/services/business';
import type { InventorySettings } from '@/types';
import { Badge, Button, Input, NumberInput, ProgressBar, StatusDot, useToast } from '@/components/ui';
import { countActiveRules, suggestedPrice } from './rules';
import { persist, usePendingChanges, useSyncedForm, type SettingsTabId } from './settingsState';
import { Callout, InsetPanel, RuleToggle, SettingsCard, StatTile } from './SettingsUI';

type RulesForm = Omit<InventorySettings, 'lowStockDefault' | 'minMarginPct' | 'maxDiscountPct'> & {
  lowStockDefault: number | '';
  minMarginPct: number | '';
  maxDiscountPct: number | '';
};

const SKU_PREFIX_RE = /^[A-Z0-9-]{1,8}$/;
const EXAMPLE_COST = 2.14;

const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;

export function InventoryRulesTab({ onNavigate }: { onNavigate: (tab: SettingsTabId) => void }) {
  const { business, businessId, actor, currencySymbol } = useActiveBusiness();
  const { products, lowStock, outOfStock, loading } = useCatalog();
  const toast = useToast();
  const online = useOnline();

  const source = useMemo<RulesForm>(() => {
    const s = business.settings;
    return {
      lowStockDefault: s.lowStockDefault,
      allowNegativeStock: s.allowNegativeStock,
      minMarginPct: s.minMarginPct,
      requireCashSession: s.requireCashSession,
      maxDiscountPct: s.maxDiscountPct,
      skuPrefix: s.skuPrefix,
      scanBeep: s.scanBeep
    };
  }, [business.settings]);
  const form = useSyncedForm(source);
  const v = form.values;
  const [saving, setSaving] = useState(false);

  const errors = {
    lowStockDefault: v.lowStockDefault === '' ? 'Indica un número (0 si no quieres alerta).' : null,
    minMarginPct: v.minMarginPct === '' ? 'Indica un porcentaje.' : v.minMarginPct >= 95 ? 'Debe ser menor a 95%.' : null,
    maxDiscountPct: v.maxDiscountPct === '' ? 'Indica un porcentaje.' : v.maxDiscountPct > 100 ? 'Máximo 100%.' : null,
    skuPrefix: !SKU_PREFIX_RE.test(v.skuPrefix) ? 'De 1 a 8 caracteres: letras, números o guion.' : null
  };
  const valid = !Object.values(errors).some(Boolean);

  const toSettings = (f: RulesForm): InventorySettings => ({
    lowStockDefault: Math.max(0, Math.round(Number(f.lowStockDefault) || 0)),
    allowNegativeStock: f.allowNegativeStock,
    minMarginPct: Number(f.minMarginPct) || 0,
    requireCashSession: f.requireCashSession,
    maxDiscountPct: Number(f.maxDiscountPct) || 0,
    skuPrefix: f.skuPrefix.trim().toUpperCase(),
    scanBeep: f.scanBeep
  });

  const save = async () => {
    if (!valid) {
      toast.error('Revisa los campos marcados.');
      return;
    }
    const settings = toSettings(v);
    form.patch(settings);
    setSaving(true);
    try {
      const synced = await persist(updateInventorySettings(businessId, settings), online);
      logActivity(businessId, actor, { type: 'settings_update', message: 'Actualizó las reglas de inventario y punto de venta' });
      if (synced) toast.success('Reglas de inventario guardadas');
      else toast.info('Guardado en este dispositivo. Se sincronizará al recuperar la conexión.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  usePendingChanges({ area: 'las reglas de inventario', dirty: form.dirty, saving, canSave: valid, onSave: save, onDiscard: form.reset });

  // Vista previa de SKU (aleatoria): solo se regenera al cambiar el prefijo.
  const skuPreview = useMemo(() => generateSku(v.skuPrefix.trim().toUpperCase() || 'PRD', 'Abarrotes'), [v.skuPrefix]);

  // Calculadora de margen
  const [testCost, setTestCost] = useState<number | ''>(EXAMPLE_COST);
  const suggestion = suggestedPrice(Number(testCost) || 0, Number(v.minMarginPct) || 0);
  const fmt = (n: number) => `${currencySymbol}${n.toFixed(2)}`;

  // Indicadores reales del catálogo
  const stats = useMemo(() => {
    const active = products.filter((p) => p.active !== false);
    const ok = active.filter((p) => stockStatus(p) === 'ok').length;
    const priced = active.filter((p) => Number(p.salePrice) > 0 && Number(p.costPrice) > 0);
    const margins = priced.map((p) => marginPct(Number(p.costPrice), Number(p.salePrice)));
    const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : null;
    return { active: active.length, ok, okPct: active.length ? (ok / active.length) * 100 : 0, priced: priced.length, margins, avgMargin };
  }, [products]);
  const minMargin = Number(v.minMarginPct) || 0;
  const belowMin = stats.margins.filter((m) => m < minMargin).length;

  const rules = countActiveRules(toSettings(v));
  const inactive = rules.list.filter((r) => !r.active);

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        {/* Columna principal */}
        <div className="flex flex-col gap-5 lg:col-span-7 lg:gap-6">
          <SettingsCard
            icon={ClipboardCheck}
            title="Políticas de stock"
            subtitle="Umbrales de reabastecimiento y control de existencias al vender."
            badge={<Badge tone="primary">Alta prioridad</Badge>}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InsetPanel
                label="Stock mínimo por defecto"
                htmlFor="rule-lowstock"
                hint={errors.lowStockDefault ?? 'Se propone al crear productos nuevos; cada producto puede tener su propio mínimo.'}
              >
                <NumberInput
                  id="rule-lowstock"
                  value={v.lowStockDefault}
                  onValueChange={(n) => form.set('lowStockDefault', n)}
                  allowDecimals={false}
                  suffix="unidades"
                  invalid={!!errors.lowStockDefault}
                  className="bg-white"
                />
              </InsetPanel>
              <InsetPanel
                label="Alertas de reabastecimiento"
                aside={lowStock.length > 0 ? <StatusDot tone={outOfStock.length ? 'danger' : 'warning'} pulse /> : <StatusDot tone="success" />}
                hint="Productos activos en o por debajo de su mínimo. Se muestran en el panel y en la campana."
              >
                <div className="flex h-10 items-center justify-between rounded-lg bg-white px-3 shadow-card">
                  <span className="text-data-mono text-on-surface tnum">{loading ? '…' : formatNumber(lowStock.length)}</span>
                  <span className="text-body-sm text-on-surface-variant">
                    {outOfStock.length > 0 ? plural(outOfStock.length, 'agotado', 'agotados') : lowStock.length === 1 ? 'producto' : 'productos'}
                  </span>
                </div>
              </InsetPanel>
            </div>
            <RuleToggle
              label="Bloquear venta cuando el stock llega a 0"
              description="Evita vender en negativo y descuadres en el conteo físico. Desactívalo si vendes sobre pedido o registras las entradas después."
              checked={!v.allowNegativeStock}
              onChange={(on) => form.set('allowNegativeStock', !on)}
            />
            <RuleToggle
              label="Exigir caja abierta para cobrar"
              description="El cajero debe abrir caja con su fondo inicial antes de cobrar; así cada venta queda dentro de un corte."
              checked={v.requireCashSession}
              onChange={(on) => form.set('requireCashSession', on)}
            />
          </SettingsCard>

          <SettingsCard
            icon={Coins}
            title="Márgenes y precios"
            subtitle="Referencia de rentabilidad al fijar precios de venta."
            badge={<Badge tone="info">Finanzas</Badge>}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <InsetPanel
                label="Margen bruto mínimo recomendado"
                htmlFor="rule-margin"
                hint={
                  errors.minMarginPct ?? (
                    <span className="flex items-start gap-1.5">
                      <TriangleAlert className="mt-px size-3.5 shrink-0 text-tertiary" />
                      Se avisa en la ficha si un precio deja un margen menor al {formatPercent(minMargin, 0)}.
                    </span>
                  )
                }
              >
                <NumberInput
                  id="rule-margin"
                  value={v.minMarginPct}
                  onValueChange={(n) => form.set('minMarginPct', n)}
                  suffix="%"
                  invalid={!!errors.minMarginPct}
                  className="bg-white"
                />
              </InsetPanel>
              <InsetPanel
                label="Calculadora de precio sugerido"
                htmlFor="rule-cost"
                hint={
                  suggestion !== null ? (
                    <>
                      Ej.: costo <b className="tnum">{fmt(Number(testCost) || 0)}</b> con {formatPercent(minMargin, 0)} →{' '}
                      <b className="text-primary tnum">{fmt(suggestion)}</b> sugerido.
                    </>
                  ) : (
                    'Indica un margen válido para calcular.'
                  )
                }
              >
                <NumberInput id="rule-cost" value={testCost} onValueChange={setTestCost} prefix={currencySymbol} className="bg-white" aria-label="Costo de prueba" />
              </InsetPanel>
            </div>
            <div className="flex flex-col gap-3 rounded-xl bg-surface-container p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-label-md text-on-surface">
                  <ChartColumn className="size-5 text-primary" />
                  Margen actual del catálogo
                </span>
                <span className="text-label-md text-primary tnum">{stats.avgMargin === null ? '—' : `${formatPercent(stats.avgMargin)} promedio`}</span>
              </div>
              {stats.priced > 0 ? (
                <>
                  <ProgressBar value={stats.priced - belowMin} max={stats.priced} tone={belowMin ? 'tertiary' : 'primary'} />
                  <span className="text-body-sm text-on-surface-variant">
                    {belowMin > 0
                      ? `${formatNumber(belowMin)} de ${formatNumber(stats.priced)} productos con costo y precio quedan por debajo del ${formatPercent(minMargin, 0)}.`
                      : `Todos tus productos con costo y precio cumplen el margen mínimo.`}
                  </span>
                </>
              ) : (
                <span className="text-body-sm text-on-surface-variant">Aún no hay productos activos con costo y precio para calcular márgenes.</span>
              )}
            </div>
          </SettingsCard>
        </div>

        {/* Columna lateral */}
        <div className="flex flex-col gap-5 lg:col-span-5 lg:gap-6">
          <SettingsCard icon={ShoppingCart} iconTone="secondary" title="Punto de venta" subtitle="Límites y comportamiento de la caja." badge={<Badge tone="neutral">Caja</Badge>}>
            <InsetPanel
              label="Descuento máximo por ticket"
              htmlFor="rule-discount"
              hint={errors.maxDiscountPct ?? 'Tope que puede aplicar quien tiene permiso de descuentos.'}
            >
              <NumberInput
                id="rule-discount"
                value={v.maxDiscountPct}
                onValueChange={(n) => form.set('maxDiscountPct', n)}
                suffix="%"
                invalid={!!errors.maxDiscountPct}
                className="bg-white"
              />
            </InsetPanel>
            <RuleToggle
              label="Sonido al escanear"
              description="Un bip confirma cada producto agregado en el POS."
              checked={v.scanBeep}
              onChange={(on) => form.set('scanBeep', on)}
              extra={
                <Button size="sm" variant="secondary" icon={Volume2} onClick={() => beep()}>
                  Probar sonido
                </Button>
              }
            />
          </SettingsCard>

          <SettingsCard icon={Hash} title="Códigos" subtitle="Formato de los SKU internos autogenerados." badge={<Badge tone="primary">SKU</Badge>}>
            <InsetPanel label="Prefijo de SKU" htmlFor="rule-sku" hint={errors.skuPrefix ?? 'Se usa al generar SKU automáticos en productos nuevos.'}>
              <Input
                id="rule-sku"
                value={v.skuPrefix}
                onChange={(e) => form.set('skuPrefix', e.target.value.toUpperCase().replace(/\s+/g, ''))}
                maxLength={8}
                invalid={!!errors.skuPrefix}
                className="bg-white text-data-mono uppercase tnum"
                placeholder="PRD"
              />
            </InsetPanel>
            <div className="flex flex-wrap items-center justify-between gap-2 text-body-sm text-on-surface-variant">
              <span>Vista previa (categoría Abarrotes):</span>
              <span className="rounded bg-primary-fixed/30 px-2 py-0.5 text-data-mono font-bold text-on-primary-fixed-variant tnum">{skuPreview}</span>
            </div>
            <Button variant="ghost" size="sm" icon={ScanBarcode} onClick={() => onNavigate('lector')} className="self-start">
              Probar mi lector de códigos
            </Button>
          </SettingsCard>

          {!online && (
            <Callout tone="warning" title="Sin conexión">
              Puedes guardar: los cambios se aplican en este dispositivo y se sincronizan al reconectar.
            </Callout>
          )}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6">
        <StatTile
          label="Reglas activas"
          value={`${rules.active} / ${rules.total}`}
          icon={ListChecks}
          tone="primary"
          footer={
            inactive.length === 0 ? (
              <span className="font-semibold text-primary">Todas las reglas están activas</span>
            ) : (
              <span className="line-clamp-2">Inactivas: {inactive.map((r) => r.label.toLowerCase()).join(', ')}</span>
            )
          }
        />
        <StatTile
          label="Artículos bajo monitoreo"
          value={`${formatNumber(stats.active)} SKUs`}
          icon={Boxes}
          tone="secondary"
          loading={loading}
          footer={
            <span className="flex items-center gap-1.5">
              <StatusDot tone="success" />
              {stats.active ? `${formatPercent(stats.okPct)} con stock óptimo` : 'Aún no tienes productos activos'}
            </span>
          }
        />
        <StatTile
          label="Alertas actuales"
          value={formatNumber(lowStock.length)}
          icon={BellRing}
          tone={outOfStock.length ? 'error' : 'tertiary'}
          loading={loading}
          footer={
            <span className={cn(lowStock.length === 0 && 'font-semibold text-primary')}>
              {lowStock.length === 0
                ? 'Sin productos bajo su mínimo'
                : `${plural(outOfStock.length, 'agotado', 'agotados')} · ${formatNumber(lowStock.length - outOfStock.length)} bajo mínimo`}
            </span>
          }
        />
      </div>
    </div>
  );
}
