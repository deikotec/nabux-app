import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { limit, onSnapshot, query, where } from 'firebase/firestore';
import { Banknote, CreditCard, Landmark, LockKeyhole, Printer, Wallet } from 'lucide-react';
import { Badge, Button, Field, Modal, NumberInput, Spinner, Textarea, useToast } from '@/components/ui';
import { PrintArea } from '@/components/receipt/Receipt';
import { currencySymbol as currencySymbolOf, formatDateTime } from '@/lib/format';
import { cn, errorMessage, round2 } from '@/lib/utils';
import { closeCashSession, getSessionSummary, openCashSession } from '@/services/cash';
import { refs } from '@/services/refs';
import type { CashSession, PaymentTotals } from '@/types';
import { useBusiness } from './BusinessContext';
import { useFx } from './FxContext';

interface CashContextValue {
  /** Caja abierta del usuario actual (o null). */
  session: CashSession | null;
  loading: boolean;
  /** Abre el modal de apertura de caja. */
  requestOpen: () => void;
  /** Abre el modal de corte / cierre de caja. */
  requestClose: () => void;
}

const CashContext = createContext<CashContextValue | null>(null);

export function CashProvider({ children }: { children: ReactNode }) {
  const { businessId, actor, status, can } = useBusiness();
  const canPos = can('pos');
  const [session, setSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  // Copia fija de la sesión que se está cerrando: al cerrarla deja de estar "abierta" y el
  // modal debe seguir montado para mostrar el resumen del corte.
  const [closing, setClosing] = useState<CashSession | null>(null);
  const sessionRef = useRef<CashSession | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    setSession(null);
    setLoading(true);
    if (!businessId || status !== 'ready' || !actor.uid || !canPos) {
      setLoading(false);
      return;
    }
    return onSnapshot(
      query(refs.cashSessions(businessId), where('openedBy', '==', actor.uid), where('status', '==', 'open'), limit(1)),
      (snap) => {
        const d = snap.docs[0];
        setSession(d ? ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as CashSession) : null);
        setLoading(false);
      },
      (err) => {
        console.error('Error leyendo caja', err);
        setLoading(false);
      }
    );
  }, [businessId, status, actor.uid, canPos]);

  const requestOpen = useCallback(() => setOpenModal(true), []);
  const requestClose = useCallback(() => {
    if (!sessionRef.current) return;
    setClosing(sessionRef.current);
    setCloseModal(true);
  }, []);

  const value = useMemo(() => ({ session, loading, requestOpen, requestClose }), [session, loading, requestOpen, requestClose]);

  return (
    <CashContext.Provider value={value}>
      {children}
      <OpenCashModal open={openModal} onClose={() => setOpenModal(false)} />
      {closing && (
        <CloseCashModal
          open={closeModal}
          onClose={() => {
            setCloseModal(false);
            setClosing(null);
          }}
          session={closing}
        />
      )}
    </CashContext.Provider>
  );
}

export function useCash() {
  const ctx = useContext(CashContext);
  if (!ctx) throw new Error('useCash debe usarse dentro de <CashProvider>');
  return ctx;
}

/* ------------------------------------------------------------------ */

function OpenCashModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { businessId, actor, money, currencySymbol } = useBusiness();
  const fx = useFx();
  const toast = useToast();
  const [amount, setAmount] = useState<number | ''>('');
  const [amountLocal, setAmountLocal] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount('');
      setAmountLocal('');
      setNotes('');
    }
  }, [open]);

  const submit = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      await openCashSession(
        businessId,
        actor,
        Number(amount) || 0,
        notes.trim(),
        fx.enabled ? { amount: Number(amountLocal) || 0, currency: fx.localCurrency } : null
      );
      toast.success('Caja abierta. ¡Buen turno!');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Abrir caja"
      subtitle={
        fx.enabled
          ? 'Registra el efectivo con el que comienzas el turno, en cada moneda.'
          : 'Registra el fondo inicial en efectivo con el que comienzas el turno.'
      }
      icon={Wallet}
      size="sm"
      dismissible={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving} icon={LockKeyhole}>
            Abrir caja
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label={fx.enabled ? `Fondo inicial en ${fx.baseCurrency}` : 'Fondo inicial (efectivo)'}
          hint="Billetes y monedas en el cajón al iniciar."
        >
          <NumberInput
            autoFocus
            inputSize="lg"
            prefix={currencySymbol}
            value={amount}
            onValueChange={setAmount}
            placeholder="0.00"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          {(fx.enabled ? [0, 20, 50, 100] : [0, 500, 1000, 2000]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(v)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-label-md tnum transition-colors',
                amount === v ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white hover:bg-slate-50'
              )}
            >
              {money(v)}
            </button>
          ))}
        </div>
        {fx.enabled && (
          <Field label={`Fondo inicial en ${fx.localCurrency}`} hint="Efectivo en bolívares en el cajón (puede ser 0).">
            <NumberInput
              inputSize="lg"
              prefix={currencySymbolOf(fx.localCurrency)}
              value={amountLocal}
              onValueChange={setAmountLocal}
              placeholder="0,00"
            />
          </Field>
        )}
        <Field label="Notas (opcional)">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. Turno mañana, caja 1" />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

interface CloseResult {
  totals: PaymentTotals;
  expectedCash: number;
  expectedCashLocal: number | null;
  difference: number;
  differenceLocal: number | null;
  declared: number;
  declaredLocal: number | null;
}

function CloseCashModal({ open, onClose, session }: { open: boolean; onClose: () => void; session: CashSession }) {
  const { businessId, actor, money, business, currencySymbol } = useBusiness();
  const fx = useFx();
  const toast = useToast();
  const localCurrency = session.localCurrency ?? (fx.enabled ? fx.localCurrency : null);
  const dualSession = !!localCurrency;
  const baseCurrency = business?.currency;
  const allMethods = fx.allMethods;
  const opts = useMemo(() => ({ baseCurrency, localCurrency, methods: allMethods }), [baseCurrency, localCurrency, allMethods]);
  const [summary, setSummary] = useState<{ totals: PaymentTotals; expectedCash: number; expectedCashLocal: number | null } | null>(null);
  const [declared, setDeclared] = useState<number | ''>('');
  const [declaredLocal, setDeclaredLocal] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [closed, setClosed] = useState<CloseResult | null>(null);
  const moneyL = (n: number | null | undefined) => (localCurrency ? fx.moneyIn(n, localCurrency) : '—');

  useEffect(() => {
    if (!open || !businessId) return;
    setSummary(null);
    setDeclared('');
    setDeclaredLocal('');
    setNotes('');
    setClosed(null);
    getSessionSummary(businessId, session, opts)
      .then(({ totals, expectedCash, expectedCashLocal }) => setSummary({ totals, expectedCash, expectedCashLocal }))
      .catch((e) => toast.error(errorMessage(e)));
  }, [open, businessId, session, toast, opts]);

  const difference = summary && declared !== '' ? round2(Number(declared) - summary.expectedCash) : null;
  const differenceLocal =
    summary && summary.expectedCashLocal !== null && declaredLocal !== '' ? round2(Number(declaredLocal) - summary.expectedCashLocal) : null;
  const ready = !!summary && declared !== '' && (!dualSession || declaredLocal !== '');

  const submit = async () => {
    if (!businessId || !ready) return;
    setSaving(true);
    try {
      const res = await closeCashSession(
        businessId,
        actor,
        session,
        { base: Number(declared), local: dualSession ? Number(declaredLocal) : null },
        notes.trim(),
        opts
      );
      setClosed({ ...res, declared: Number(declared), declaredLocal: dualSession ? Number(declaredLocal) : null });
      toast.success('Corte de caja registrado');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const data = closed ?? summary;
  const methodRows = data ? Object.entries(data.totals.byMethod ?? {}).sort((a, b) => b[1].amountBase - a[1].amountBase) : [];
  const methodAmount = (amount: number, currency: string) => fx.moneyIn(amount, currency || baseCurrency || '');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={closed ? 'Caja cerrada' : 'Corte de caja'}
      subtitle={`Abierta ${formatDateTime(session.openedAt)} por ${session.openedByName}`}
      icon={Banknote}
      size="md"
      dismissible={!saving}
      footer={
        closed ? (
          <>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
              Imprimir corte
            </Button>
            <Button onClick={onClose}>Listo</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} loading={saving} disabled={!ready} icon={LockKeyhole}>
              Cerrar caja
            </Button>
          </>
        )
      }
    >
      {!data ? (
        <div className="flex justify-center py-10">
          <Spinner className="size-7" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className={cn('grid gap-3', dualSession ? 'grid-cols-2' : 'grid-cols-1')}>
            <Stat icon={Wallet} label={dualSession ? `Fondo inicial ${baseCurrency ?? ''}` : 'Fondo inicial'} value={money(session.openingFloat)} />
            {dualSession && <Stat icon={Wallet} label={`Fondo inicial ${localCurrency}`} value={moneyL(session.openingFloatLocal ?? 0)} />}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-label-md text-on-surface-variant uppercase">Ventas por forma de pago</span>
              <span className="text-body-sm text-on-surface-variant">
                {data.totals.count} {data.totals.count === 1 ? 'ticket' : 'tickets'}
              </span>
            </div>
            {methodRows.length === 0 ? (
              <p className="rounded-xl bg-surface-container-low px-4 py-3 text-body-md text-on-surface-variant">Sin ventas en este turno.</p>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200">
                {methodRows.map(([id, m]) => (
                  <div key={id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="flex items-center gap-2 text-label-md">
                      {m.kind === 'cash' ? (
                        <Banknote className="size-4 text-primary" />
                      ) : m.kind === 'card' ? (
                        <CreditCard className="size-4 text-secondary" />
                      ) : (
                        <Landmark className="size-4 text-tertiary" />
                      )}
                      {m.label}
                      <span className="text-body-sm text-on-surface-variant">· {m.count}</span>
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="text-label-lg tnum">{methodAmount(m.amount, m.currency)}</span>
                      {m.currency && m.currency !== baseCurrency && (
                        <span className="text-body-sm text-on-surface-variant tnum">≈ {money(m.amountBase)}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3">
              <span className="text-label-md text-on-surface-variant">
                Total vendido{data.totals.igtf ? ` · IGTF cobrado ${money(data.totals.igtf)}` : ''}
              </span>
              <span className="text-headline-sm tnum">{money(data.totals.total)}</span>
            </div>
          </div>

          <div className={cn('grid gap-3', dualSession && 'sm:grid-cols-2')}>
            <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary-fixed/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-label-md text-on-primary-fixed-variant">Efectivo esperado {dualSession ? baseCurrency : ''}</span>
                <span className="text-headline-sm text-primary tnum">{money(data.expectedCash)}</span>
              </div>
              {closed ? (
                <DiffRow declared={money(closed.declared)} difference={closed.difference} format={money} />
              ) : (
                <>
                  <Field label="Efectivo contado" required>
                    <NumberInput autoFocus prefix={currencySymbol} value={declared} onValueChange={setDeclared} placeholder="0.00" />
                  </Field>
                  {difference !== null && <DiffRow declared={money(Number(declared))} difference={difference} format={money} />}
                </>
              )}
            </div>
            {dualSession && data.expectedCashLocal !== null && (
              <div className="flex flex-col gap-3 rounded-xl border border-secondary/20 bg-secondary-fixed/20 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-label-md text-on-secondary-fixed-variant">Efectivo esperado {localCurrency}</span>
                  <span className="text-headline-sm text-secondary tnum">{moneyL(data.expectedCashLocal)}</span>
                </div>
                {closed ? (
                  closed.differenceLocal !== null && (
                    <DiffRow declared={moneyL(closed.declaredLocal)} difference={closed.differenceLocal} format={moneyL} />
                  )
                ) : (
                  <>
                    <Field label="Efectivo contado" required>
                      <NumberInput
                        prefix={currencySymbolOf(localCurrency ?? '')}
                        value={declaredLocal}
                        onValueChange={setDeclaredLocal}
                        placeholder="0,00"
                      />
                    </Field>
                    {differenceLocal !== null && (
                      <DiffRow declared={moneyL(Number(declaredLocal))} difference={differenceLocal} format={moneyL} />
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {!closed && (
            <Field label="Observaciones">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. faltante por cambio mal entregado" />
            </Field>
          )}
          {dualSession && (
            <p className="text-body-sm text-on-surface-variant">
              Los pagos electrónicos (pago móvil, punto, transferencias, Zelle, USDT) se concilian contra el banco; en el cajón solo se cuenta el
              efectivo.
            </p>
          )}
        </div>
      )}

      {closed && business && (
        <PrintArea>
          <div className="mx-auto w-full max-w-[300px] font-mono text-[12px] text-black">
            <div className="text-center text-[14px] font-bold uppercase">{business.name}</div>
            <div className="text-center">CORTE DE CAJA</div>
            <div className="my-2 border-t border-dashed border-black" />
            <div>Cajero: {session.openedByName}</div>
            <div>Apertura: {formatDateTime(session.openedAt)}</div>
            <div>Cierre: {formatDateTime(new Date())}</div>
            <div className="my-2 border-t border-dashed border-black" />
            <PrintRow label="Fondo inicial" value={money(session.openingFloat)} />
            {dualSession && <PrintRow label={`Fondo inicial ${localCurrency}`} value={moneyL(session.openingFloatLocal ?? 0)} />}
            <div className="my-2 border-t border-dashed border-black" />
            {methodRows.map(([id, m]) => (
              <PrintRow key={id} label={`${m.label} (${m.count})`} value={methodAmount(m.amount, m.currency)} />
            ))}
            <PrintRow label="Total ventas" value={money(closed.totals.total)} />
            {closed.totals.igtf ? <PrintRow label="IGTF" value={money(closed.totals.igtf)} /> : null}
            <PrintRow label="Tickets" value={String(closed.totals.count)} />
            <div className="my-2 border-t border-dashed border-black" />
            <PrintRow label="Efectivo esperado" value={money(closed.expectedCash)} />
            <PrintRow label="Efectivo contado" value={money(closed.declared)} />
            <PrintRow label="Diferencia" value={money(closed.difference)} />
            {dualSession && closed.expectedCashLocal !== null && (
              <>
                <div className="my-2 border-t border-dashed border-black" />
                <PrintRow label={`Esperado ${localCurrency}`} value={moneyL(closed.expectedCashLocal)} />
                <PrintRow label={`Contado ${localCurrency}`} value={moneyL(closed.declaredLocal)} />
                <PrintRow label={`Diferencia ${localCurrency}`} value={moneyL(closed.differenceLocal)} />
              </>
            )}
            <div className="mt-6 text-center">______________________</div>
            <div className="text-center">Firma</div>
          </div>
        </PrintArea>
      )}
    </Modal>
  );
}

function PrintRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-200 p-3">
      <span className="flex items-center gap-1.5 text-label-sm text-on-surface-variant uppercase">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="text-label-lg tnum">{value}</span>
    </div>
  );
}

function DiffRow({ declared, difference, format }: { declared: string; difference: number; format: (n: number) => string }) {
  const tone = Math.abs(difference) < 0.005 ? 'success' : difference > 0 ? 'info' : 'danger';
  const label = Math.abs(difference) < 0.005 ? 'Cuadrada' : difference > 0 ? 'Sobrante' : 'Faltante';
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-body-sm text-on-surface-variant">Contado: {declared}</span>
      <span className="flex items-center gap-2">
        <Badge tone={tone} dot>
          {label}
        </Badge>
        <span className={cn('text-label-lg tnum', tone === 'danger' ? 'text-error' : tone === 'info' ? 'text-secondary' : 'text-primary')}>
          {difference > 0 ? '+' : ''}
          {format(difference)}
        </span>
      </span>
    </div>
  );
}
