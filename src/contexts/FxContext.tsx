import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { formatMoney, toDate } from '@/lib/format';
import { caracasToday, effectiveRate, fetchVenezuelaRates, isRateStale, roundTo, type FetchedRates } from '@/lib/fx';
import { activePaymentMethods, fxSettingsOf, paymentMethodsOf } from '@/lib/payments';
import { refs } from '@/services/refs';
import { saveRates, type RatesPatch } from '@/services/fx';
import type { FxRates, FxSettings, PaymentMethodConfig, RateSource } from '@/types';
import { useBusiness } from './BusinessContext';

interface FxContextValue {
  /** Modo bimonetario activo. */
  enabled: boolean;
  settings: FxSettings;
  rates: FxRates | null;
  /** Tasa efectiva según la fuente configurada (Bs por $), o null si no hay. */
  rate: number | null;
  rateSource: RateSource;
  /** La tasa BCV no es la de hoy. */
  stale: boolean;
  loading: boolean;
  baseCurrency: string;
  localCurrency: string;
  /** $ → Bs (null si no hay tasa). */
  toLocal: (amountBase: number) => number | null;
  /** Bs → $ (null si no hay tasa). */
  fromLocal: (amountLocal: number) => number | null;
  /** Formatea un monto en $ como Bs ("Bs. 8.791,23"), o "—" sin tasa. */
  moneyLocal: (amountBase: number | null | undefined) => string;
  /** Formatea un monto ya expresado en moneda local. */
  formatLocal: (amountLocal: number | null | undefined) => string;
  /** Formatea un monto en cualquier moneda ISO ("USD", "VES"). */
  moneyIn: (amount: number | null | undefined, currency: string) => string;
  /** "$10,00 · Bs. 8.791,23" (o solo "$10,00" sin modo bimonetario). */
  dual: (amountBase: number | null | undefined) => string;
  /** Formas de pago activas del negocio. */
  methods: PaymentMethodConfig[];
  /** Todas las formas de pago (incluye inactivas). */
  allMethods: PaymentMethodConfig[];
  /** ¿El usuario puede actualizar tasas? (pos, inventario o configuración) */
  canEditRates: boolean;
  updateRates: (patch: RatesPatch) => Promise<void>;
  /** Consulta BCV y paralelo en internet y los guarda. */
  refreshFromInternet: () => Promise<FetchedRates>;
  refreshing: boolean;
}

const FxContext = createContext<FxContextValue | null>(null);

export function FxProvider({ children }: { children: ReactNode }) {
  const { business, businessId, status, actor, can } = useBusiness();
  const [rates, setRates] = useState<FxRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const settings = useMemo(() => fxSettingsOf(business), [business]);
  const enabled = settings.enabled;
  const canEditRates = can('settings') || can('pos') || can('inventory');

  useEffect(() => {
    setRates(null);
    setLoading(true);
    if (!businessId || status !== 'ready') return;
    return onSnapshot(
      refs.fx(businessId),
      (snap) => {
        setRates(snap.exists() ? (snap.data({ serverTimestamps: 'estimate' }) as FxRates) : null);
        setLoading(false);
      },
      (err) => {
        console.error('Error leyendo tasas', err);
        setLoading(false);
      }
    );
  }, [businessId, status]);

  const rate = useMemo(() => (enabled ? effectiveRate(rates, settings.rateSource) : null), [enabled, rates, settings.rateSource]);
  const stale = enabled && isRateStale(rates);

  const ratesRef = useRef(rates);
  ratesRef.current = rates;

  const updateRates = useCallback(
    async (patch: RatesPatch) => {
      if (!businessId) return;
      await saveRates(businessId, actor, ratesRef.current, patch, 'manual');
    },
    [businessId, actor]
  );

  const refreshFromInternet = useCallback(async () => {
    if (!businessId) throw new Error('Sin negocio activo');
    setRefreshing(true);
    try {
      const fetched = await fetchVenezuelaRates();
      const cur = ratesRef.current;
      const changed =
        (fetched.bcv && fetched.bcv !== cur?.bcv) ||
        (fetched.parallel && fetched.parallel !== cur?.parallel) ||
        (fetched.bcvDate && fetched.bcvDate !== cur?.bcvDate);
      if (changed) {
        const patch: RatesPatch = {};
        if (fetched.bcv) {
          patch.bcv = fetched.bcv;
          patch.bcvDate = fetched.bcvDate;
        }
        if (fetched.parallel) {
          patch.parallel = fetched.parallel;
          patch.parallelUpdatedAt = fetched.parallelUpdatedAt;
        }
        await saveRates(businessId, actor, cur, patch, 'auto');
      }
      return fetched;
    } finally {
      setRefreshing(false);
    }
  }, [businessId, actor]);

  // Actualización automática: al abrir y luego cada 2 horas, si la tasa está vieja.
  const autoRef = useRef<{ key: string; at: number }>({ key: '', at: 0 });
  useEffect(() => {
    if (!enabled || !settings.autoUpdate || !canEditRates || loading || !businessId) return;
    const run = () => {
      const now = Date.now();
      const key = businessId;
      const lastUpdate = toDate(rates?.updatedAt)?.getTime() ?? 0;
      const due = isRateStale(rates) || rates?.bcvDate !== caracasToday() || now - lastUpdate > 2 * 3600 * 1000;
      if (!due || (autoRef.current.key === key && now - autoRef.current.at < 30 * 60 * 1000)) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      autoRef.current = { key, at: now };
      refreshFromInternet().catch((e) => console.warn('No se pudo actualizar la tasa automáticamente', e));
    };
    run();
    const t = setInterval(run, 15 * 60 * 1000);
    return () => clearInterval(t);
  }, [enabled, settings.autoUpdate, canEditRates, loading, businessId, rates, refreshFromInternet]);

  const baseCurrency = business?.currency ?? 'USD';
  const baseLocale = business?.locale ?? 'es-VE';
  const localCurrency = settings.localCurrency;
  const localLocale = settings.localLocale;
  const step = settings.localRounding || 0.01;

  const toLocal = useCallback((amountBase: number) => (rate ? roundTo((Number(amountBase) || 0) * rate, step) : null), [rate, step]);
  const fromLocal = useCallback((amountLocal: number) => (rate ? (Number(amountLocal) || 0) / rate : null), [rate]);
  const formatLocal = useCallback((amountLocal: number | null | undefined) => formatMoney(amountLocal, localCurrency, localLocale), [localCurrency, localLocale]);
  const moneyLocal = useCallback(
    (amountBase: number | null | undefined) => {
      if (!rate || amountBase === null || amountBase === undefined) return '—';
      return formatMoney(roundTo(Number(amountBase) * rate, step), localCurrency, localLocale);
    },
    [rate, step, localCurrency, localLocale]
  );
  const moneyIn = useCallback(
    (amount: number | null | undefined, currency: string) =>
      formatMoney(amount, currency || baseCurrency, currency === localCurrency ? localLocale : baseLocale),
    [baseCurrency, baseLocale, localCurrency, localLocale]
  );
  const dual = useCallback(
    (amountBase: number | null | undefined) => {
      const base = formatMoney(amountBase, baseCurrency, baseLocale);
      return enabled && rate ? `${base} · ${moneyLocal(amountBase)}` : base;
    },
    [baseCurrency, baseLocale, enabled, rate, moneyLocal]
  );

  const methods = useMemo(() => activePaymentMethods(business), [business]);
  const allMethods = useMemo(() => paymentMethodsOf(business), [business]);

  const value = useMemo<FxContextValue>(
    () => ({
      enabled,
      settings,
      rates,
      rate,
      rateSource: settings.rateSource,
      stale,
      loading,
      baseCurrency,
      localCurrency,
      toLocal,
      fromLocal,
      moneyLocal,
      formatLocal,
      moneyIn,
      dual,
      methods,
      allMethods,
      canEditRates,
      updateRates,
      refreshFromInternet,
      refreshing
    }),
    [enabled, settings, rates, rate, stale, loading, baseCurrency, localCurrency, toLocal, fromLocal, moneyLocal, formatLocal, moneyIn, dual, methods, allMethods, canEditRates, updateRates, refreshFromInternet, refreshing]
  );

  return <FxContext.Provider value={value}>{children}</FxContext.Provider>;
}

export function useFx() {
  const ctx = useContext(FxContext);
  if (!ctx) throw new Error('useFx debe usarse dentro de <FxProvider>');
  return ctx;
}
