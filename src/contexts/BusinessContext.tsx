import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getDoc, onSnapshot } from 'firebase/firestore';
import { DEFAULT_INVENTORY_SETTINGS } from '@/config/app';
import { currencySymbol, formatMoney, formatMoneyCompact, toDate } from '@/lib/format';
import { refs, type Actor } from '@/services/refs';
import { setLastBusiness } from '@/services/profile';
import { touchMember } from '@/services/members';
import type { Business, Member, Permission, Role } from '@/types';
import { useAuth } from './AuthContext';

export interface BusinessSummary {
  id: string;
  name: string;
  logoUrl?: string | null;
  businessType?: string;
}

export type BusinessStatus = 'loading' | 'none' | 'ready' | 'no-access';

interface BusinessContextValue {
  status: BusinessStatus;
  businessId: string | null;
  business: Business | null;
  member: Member | null;
  role: Role | null;
  /** Negocios a los que pertenece el usuario (para el selector). */
  businesses: BusinessSummary[];
  switchBusiness: (id: string) => void;
  /** ¿El usuario actual tiene este permiso? (propietario y admin: todos) */
  can: (perm: Permission) => boolean;
  /** Quién ejecuta las acciones (para servicios). */
  actor: Actor;
  /** Formatea dinero con la moneda y locale del negocio. */
  money: (amount: number | null | undefined) => string;
  /** Formato compacto para ejes de gráficas ($1.2 k). */
  moneyCompact: (amount: number) => string;
  /** Símbolo de la moneda del negocio ("$", "€", "S/"…). */
  currencySymbol: string;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

const LS_KEY = 'nabux:lastBusinessId';

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LS_KEY);
    } catch {
      return null;
    }
  });
  const [business, setBusiness] = useState<Business | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [businessLoaded, setBusinessLoaded] = useState(false);
  const [memberLoaded, setMemberLoaded] = useState(false);
  const [denied, setDenied] = useState(false);
  const [summaries, setSummaries] = useState<BusinessSummary[]>([]);

  const businessIds = useMemo(() => profile?.businessIds ?? [], [profile?.businessIds]);

  // Negocio activo: el elegido si sigue en la lista, si no el último usado, si no el primero.
  const businessId = useMemo(() => {
    if (!businessIds.length) return null;
    if (selectedId && businessIds.includes(selectedId)) return selectedId;
    if (profile?.lastBusinessId && businessIds.includes(profile.lastBusinessId)) return profile.lastBusinessId;
    return businessIds[0];
  }, [businessIds, selectedId, profile?.lastBusinessId]);

  useEffect(() => {
    setBusiness(null);
    setMember(null);
    setBusinessLoaded(false);
    setMemberLoaded(false);
    setDenied(false);
    if (!user || !businessId) return;

    const unsubMember = onSnapshot(
      refs.member(businessId, user.uid),
      (snap) => {
        setMember(snap.exists() ? ({ uid: snap.id, ...snap.data() } as Member) : null);
        setMemberLoaded(true);
      },
      () => {
        setMember(null);
        setMemberLoaded(true);
      }
    );
    const unsubBiz = onSnapshot(
      refs.business(businessId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<Business, 'id'>;
          setBusiness({
            ...data,
            id: snap.id,
            categories: data.categories ?? [],
            settings: { ...DEFAULT_INVENTORY_SETTINGS, ...(data.settings ?? {}) },
            taxRate: Number(data.taxRate) || 0,
            taxName: data.taxName || 'IVA',
            currency: data.currency || 'MXN',
            locale: data.locale || 'es-MX',
            pricesIncludeTax: data.pricesIncludeTax !== false
          });
        } else setBusiness(null);
        setBusinessLoaded(true);
      },
      () => {
        setDenied(true);
        setBusinessLoaded(true);
      }
    );
    return () => {
      unsubMember();
      unsubBiz();
    };
  }, [user, businessId]);

  // Resumen de todos los negocios del usuario para el selector.
  useEffect(() => {
    let cancelled = false;
    if (!businessIds.length) {
      setSummaries([]);
      return;
    }
    Promise.all(
      businessIds.map(async (id) => {
        try {
          const snap = await getDoc(refs.business(id));
          if (!snap.exists()) return null;
          const d = snap.data();
          return { id, name: d.name as string, logoUrl: d.logoUrl ?? null, businessType: d.businessType } as BusinessSummary;
        } catch {
          return null;
        }
      })
    ).then((list) => {
      if (!cancelled) setSummaries(list.filter(Boolean) as BusinessSummary[]);
    });
    return () => {
      cancelled = true;
    };
  }, [businessIds]);

  // Registrar "última actividad" como máximo cada 5 minutos.
  useEffect(() => {
    if (!user || !businessId || !member || member.status !== 'active') return;
    const last = toDate(member.lastActiveAt)?.getTime() ?? 0;
    if (Date.now() - last > 5 * 60 * 1000) touchMember(businessId, user.uid);
  }, [user, businessId, member]);

  const switchBusiness = useCallback(
    (id: string) => {
      setSelectedId(id);
      try {
        localStorage.setItem(LS_KEY, id);
      } catch {
        /* sin almacenamiento local */
      }
      if (user) setLastBusiness(user.uid, id);
    },
    [user]
  );

  const status: BusinessStatus = useMemo(() => {
    if (!businessIds.length) return 'none';
    if (!businessLoaded || !memberLoaded) return 'loading';
    if (denied || !business || !member || member.status !== 'active') return 'no-access';
    return 'ready';
  }, [businessIds.length, businessLoaded, memberLoaded, denied, business, member]);

  const can = useCallback(
    (perm: Permission) => {
      if (!member || member.status !== 'active') return false;
      if (member.role === 'owner' || member.role === 'admin') return true;
      return (member.permissions ?? []).includes(perm);
    },
    [member]
  );

  const actor = useMemo<Actor>(
    () => ({ uid: user?.uid ?? '', name: member?.displayName || profile?.displayName || user?.email || 'Usuario' }),
    [user, member?.displayName, profile?.displayName]
  );

  const money = useCallback(
    (amount: number | null | undefined) => formatMoney(amount, business?.currency ?? 'MXN', business?.locale ?? 'es-MX'),
    [business?.currency, business?.locale]
  );

  const moneyCompact = useCallback(
    (amount: number) => formatMoneyCompact(amount, business?.currency ?? 'MXN', business?.locale ?? 'es-MX'),
    [business?.currency, business?.locale]
  );

  const symbol = useMemo(() => currencySymbol(business?.currency ?? 'MXN', business?.locale ?? 'es-MX'), [business?.currency, business?.locale]);

  const value = useMemo<BusinessContextValue>(
    () => ({
      status,
      businessId,
      business,
      member,
      role: member?.role ?? null,
      businesses: summaries,
      switchBusiness,
      can,
      actor,
      money,
      moneyCompact,
      currencySymbol: symbol
    }),
    [status, businessId, business, member, summaries, switchBusiness, can, actor, money, moneyCompact, symbol]
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness debe usarse dentro de <BusinessProvider>');
  return ctx;
}

/**
 * Igual que useBusiness, pero garantiza negocio y miembro cargados.
 * Úsalo solo en páginas dentro del layout de la app (allí ya están garantizados).
 */
export function useActiveBusiness() {
  const ctx = useBusiness();
  if (!ctx.business || !ctx.member || !ctx.businessId) {
    throw new Error('No hay un negocio activo');
  }
  return { ...ctx, business: ctx.business, member: ctx.member, businessId: ctx.businessId };
}
