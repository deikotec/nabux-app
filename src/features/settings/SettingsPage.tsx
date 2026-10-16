import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowLeftRight, CircleCheck, ReceiptText, RotateCcw, ScanBarcode, ShieldCheck, SlidersHorizontal, Store, Tags, Truck, WalletCards } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useFx } from '@/contexts/FxContext';
import { formatDateTime, formatRelative } from '@/lib/format';
import { formatRate } from '@/lib/fx';
import { Badge, Button, PageHeader, TabBar, useConfirm, type TabOption } from '@/components/ui';
import { BusinessTab } from './BusinessTab';
import { CategoriesTab } from './CategoriesTab';
import { CurrencyRatesTab } from './CurrencyRatesTab';
import { InventoryRulesTab } from './InventoryRulesTab';
import { PaymentMethodsTab } from './PaymentMethodsTab';
import { RegistersTab } from './RegistersTab';
import { activeRegisters } from '@/lib/registers';
import { countActiveRules } from './rules';
import { ScannerTab } from './ScannerTab';
import { PendingContext, useNow, type PendingChanges, type SettingsTabId } from './settingsState';
import { SaveBar } from './SettingsUI';
import { SuppliersTab } from './SuppliersTab';
import { TaxReceiptTab } from './TaxReceiptTab';

const TAB_IDS: SettingsTabId[] = ['negocio', 'impuestos', 'moneda', 'pagos', 'cajas', 'reglas', 'categorias', 'proveedores', 'lector'];

export default function SettingsPage() {
  const { business, businessId, can } = useActiveBusiness();
  const { suppliers, categories } = useCatalog();
  const fx = useFx();
  const { confirm } = useConfirm();
  const [params, setParams] = useSearchParams();
  const [pending, setPending] = useState<PendingChanges | null>(null);
  useNow(60_000);

  const tabParam = params.get('tab') as SettingsTabId | null;
  const tab: SettingsTabId = tabParam && TAB_IDS.includes(tabParam) ? tabParam : 'negocio';
  const dirty = !!pending?.dirty;

  const tabs = useMemo<TabOption<SettingsTabId>[]>(
    () => [
      { value: 'negocio', label: 'Negocio', icon: Store },
      { value: 'impuestos', label: 'Impuestos y ticket', icon: ReceiptText },
      { value: 'moneda', label: 'Moneda y tasas', icon: ArrowLeftRight },
      { value: 'pagos', label: 'Formas de pago', icon: WalletCards, count: fx.methods.length },
      { value: 'cajas', label: 'Cajas', icon: Store, count: activeRegisters(business).length },
      { value: 'reglas', label: 'Reglas de inventario', icon: SlidersHorizontal },
      { value: 'categorias', label: 'Categorías', icon: Tags, count: categories.length },
      { value: 'proveedores', label: 'Proveedores', icon: Truck, count: suppliers.length },
      { value: 'lector', label: 'Lector y códigos', icon: ScanBarcode }
    ],
    [categories.length, suppliers.length, fx.methods.length, business]
  );

  const goTo = useCallback(
    async (next: SettingsTabId) => {
      if (next === tab) return;
      if (dirty) {
        const ok = await confirm({
          title: 'Tienes cambios sin guardar',
          message: `Si cambias de pestaña se perderán los cambios en ${pending?.area ?? 'esta sección'}. ¿Quieres descartarlos?`,
          confirmLabel: 'Descartar y continuar',
          cancelLabel: 'Seguir editando',
          tone: 'danger'
        });
        if (!ok) return;
      }
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === 'negocio') p.delete('tab');
          else p.set('tab', next);
          return p;
        },
        { replace: true }
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [tab, dirty, pending?.area, confirm, setParams]
  );

  // Aviso del navegador al cerrar o recargar con cambios pendientes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const rules = countActiveRules(business.settings);

  return (
    <PendingContext.Provider value={setPending}>
      <div className="flex flex-col">
        <PageHeader
          eyebrow={
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-primary" />
              Configuración
              <span className="text-outline-variant">•</span>
              <span className="text-on-surface-variant">Ajustes y reglas operativas</span>
            </span>
          }
          title="Configuración del negocio"
          description="Personaliza los datos de tu negocio, impuestos y ticket, moneda y tasas de cambio, formas de pago, las reglas de inventario y punto de venta, tus categorías, proveedores y lectores de código de barras."
          actions={
            pending ? (
              // En móvil basta la barra fija inferior.
              <div className="hidden items-center gap-2 sm:flex">
                <Button variant="soft" icon={RotateCcw} onClick={pending.discard} disabled={!dirty || pending.saving}>
                  Descartar cambios
                </Button>
                <Button icon={CircleCheck} onClick={pending.save} loading={pending.saving} disabled={!dirty || !pending.canSave}>
                  Guardar configuración
                </Button>
              </div>
            ) : undefined
          }
          className="pb-3"
        />

        <TabBar tabs={tabs} value={tab} onChange={goTo} className="-mx-4 px-4 pb-1 sm:mx-0 sm:px-0" />

        {/* Barra de estado del motor de políticas */}
        <div className="mt-4 mb-5 flex flex-col gap-3 rounded-2xl bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-6" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-label-md text-on-surface">Motor de políticas del negocio</span>
              <span className="text-body-sm text-on-surface-variant">
                Última actualización:{' '}
                <strong className="font-semibold text-on-surface" title={formatDateTime(business.updatedAt)}>
                  {business.updatedAt ? formatRelative(business.updatedAt) : 'sin cambios registrados'}
                </strong>
                {can('settings') ? ' · Los cambios se aplican al instante en todas las cajas.' : ''}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={rules.active === rules.total ? 'primary' : 'warning'} size="md">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-50" />
                <span className="relative inline-flex size-1.5 rounded-full bg-current" />
              </span>
              <span className="tnum">
                {rules.active} de {rules.total} reglas activas
              </span>
            </Badge>
            <span className="rounded-md bg-white px-2 py-1 text-data-mono text-on-surface-variant shadow-card tnum">
              {fx.enabled ? `${business.currency} + Bs` : business.currency} · {business.taxName} {business.taxRate}% {business.pricesIncludeTax ? 'incluido' : 'adicional'}
              {fx.enabled && fx.settings.igtfEnabled ? ` · IGTF ${fx.settings.igtfRate}%` : ''}
            </span>
            {fx.enabled && (
              <Badge tone={fx.rate && !fx.stale ? 'neutral' : 'warning'} size="md">
                <span className="tnum">{fx.rate ? `Tasa ${formatRate(fx.rate)}` : 'Sin tasa del día'}</span>
              </Badge>
            )}
          </div>
        </div>

        <div key={`${businessId}:${tab}`} className="animate-fade-in">
          {tab === 'negocio' && <BusinessTab />}
          {tab === 'impuestos' && <TaxReceiptTab onNavigate={goTo} />}
          {tab === 'moneda' && <CurrencyRatesTab onNavigate={goTo} />}
          {tab === 'pagos' && <PaymentMethodsTab onNavigate={goTo} />}
          {tab === 'cajas' && <RegistersTab />}
          {tab === 'reglas' && <InventoryRulesTab onNavigate={goTo} />}
          {tab === 'categorias' && <CategoriesTab />}
          {tab === 'proveedores' && <SuppliersTab />}
          {tab === 'lector' && <ScannerTab onNavigate={goTo} />}
        </div>

        {pending?.dirty && <SaveBar pending={pending} />}
      </div>
    </PendingContext.Provider>
  );
}
