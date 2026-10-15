import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { limit, onSnapshot, query, where } from 'firebase/firestore';
import { Banknote, CreditCard, Landmark, LockKeyhole, Printer, Wallet } from 'lucide-react';
import { Badge, Button, Field, Modal, NumberInput, Spinner, Textarea, useToast } from '@/components/ui';
import { PrintArea } from '@/components/receipt/Receipt';
import { formatDateTime } from '@/lib/format';
import { cn, errorMessage, round2 } from '@/lib/utils';
import { closeCashSession, getSessionSummary, openCashSession } from '@/services/cash';
import { refs } from '@/services/refs';
import type { CashSession, PaymentTotals } from '@/types';
import { useBusiness } from './BusinessContext';

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
  const [session, setSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);

  useEffect(() => {
    setSession(null);
    setLoading(true);
    if (!businessId || status !== 'ready' || !actor.uid || !can('pos')) {
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
  }, [businessId, status, actor.uid, can]);

  const requestOpen = useCallback(() => setOpenModal(true), []);
  const requestClose = useCallback(() => setCloseModal(true), []);

  const value = useMemo(() => ({ session, loading, requestOpen, requestClose }), [session, loading, requestOpen, requestClose]);

  return (
    <CashContext.Provider value={value}>
      {children}
      <OpenCashModal open={openModal} onClose={() => setOpenModal(false)} />
      {session && <CloseCashModal open={closeModal} onClose={() => setCloseModal(false)} session={session} />}
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
  const toast = useToast();
  const [amount, setAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount('');
      setNotes('');
    }
  }, [open]);

  const submit = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      await openCashSession(businessId, actor, Number(amount) || 0, notes.trim());
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
      subtitle="Registra el fondo inicial en efectivo con el que comienzas el turno."
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
        <Field label="Fondo inicial (efectivo)" hint="Billetes y monedas en el cajón al iniciar.">
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
          {[0, 500, 1000, 2000].map((v) => (
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
        <Field label="Notas (opcional)">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. Turno mañana, caja 1" />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function CloseCashModal({ open, onClose, session }: { open: boolean; onClose: () => void; session: CashSession }) {
  const { businessId, actor, money, business, currencySymbol } = useBusiness();
  const toast = useToast();
  const [summary, setSummary] = useState<{ totals: PaymentTotals; expectedCash: number } | null>(null);
  const [declared, setDeclared] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [closed, setClosed] = useState<{ totals: PaymentTotals; expectedCash: number; difference: number; declared: number } | null>(null);

  useEffect(() => {
    if (!open || !businessId) return;
    setSummary(null);
    setDeclared('');
    setNotes('');
    setClosed(null);
    getSessionSummary(businessId, session)
      .then(({ totals, expectedCash }) => setSummary({ totals, expectedCash }))
      .catch((e) => toast.error(errorMessage(e)));
  }, [open, businessId, session, toast]);

  const difference = summary && declared !== '' ? round2(Number(declared) - summary.expectedCash) : null;

  const submit = async () => {
    if (!businessId || declared === '') return;
    setSaving(true);
    try {
      const res = await closeCashSession(businessId, actor, session, Number(declared), notes.trim());
      setClosed({ ...res, declared: Number(declared) });
      toast.success('Corte de caja registrado');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const data = closed ?? (summary ? { ...summary, difference, declared } : null);

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
            <Button onClick={submit} loading={saving} disabled={!summary || declared === ''} icon={LockKeyhole}>
              Cerrar caja
            </Button>
          </>
        )
      }
    >
      {!summary && !closed ? (
        <div className="flex justify-center py-10">
          <Spinner className="size-7" />
        </div>
      ) : (
        data && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={Wallet} label="Fondo inicial" value={money(session.openingFloat)} />
              <Stat icon={Banknote} label="Efectivo" value={money(data.totals.cash)} />
              <Stat icon={CreditCard} label="Tarjeta" value={money(data.totals.card)} />
              <Stat icon={Landmark} label="Transf. / QR" value={money(data.totals.transfer)} />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3">
              <div className="flex flex-col">
                <span className="text-label-md text-on-surface-variant">Ventas del turno</span>
                <span className="text-body-sm text-on-surface-variant">{data.totals.count} tickets</span>
              </div>
              <span className="text-headline-md tnum">{money(data.totals.total)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary-fixed/15 px-4 py-3">
              <span className="text-label-lg text-on-primary-fixed-variant">Efectivo esperado en caja</span>
              <span className="text-headline-md text-primary tnum">{money(data.expectedCash)}</span>
            </div>
            {closed ? (
              <DiffRow declared={closed.declared} difference={closed.difference} money={money} />
            ) : (
              <>
                <Field label="Efectivo contado" required hint="Cuenta billetes y monedas del cajón (incluye el fondo inicial).">
                  <NumberInput autoFocus inputSize="lg" prefix={currencySymbol} value={declared} onValueChange={setDeclared} placeholder="0.00" />
                </Field>
                {difference !== null && <DiffRow declared={Number(declared)} difference={difference} money={money} />}
                <Field label="Observaciones">
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. faltante por cambio mal entregado" />
                </Field>
              </>
            )}
          </div>
        )
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
            <PrintRow label="Ventas efectivo" value={money(closed.totals.cash)} />
            <PrintRow label="Ventas tarjeta" value={money(closed.totals.card)} />
            <PrintRow label="Transferencia/QR" value={money(closed.totals.transfer)} />
            <PrintRow label="Total ventas" value={money(closed.totals.total)} />
            <PrintRow label="Tickets" value={String(closed.totals.count)} />
            <div className="my-2 border-t border-dashed border-black" />
            <PrintRow label="Efectivo esperado" value={money(closed.expectedCash)} />
            <PrintRow label="Efectivo contado" value={money(closed.declared)} />
            <PrintRow label="Diferencia" value={money(closed.difference)} />
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
    <div className="flex justify-between">
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

function DiffRow({ declared, difference, money }: { declared: number; difference: number; money: (n: number) => string }) {
  const tone = Math.abs(difference) < 0.005 ? 'success' : difference > 0 ? 'info' : 'danger';
  const label = Math.abs(difference) < 0.005 ? 'Cuadrada' : difference > 0 ? 'Sobrante' : 'Faltante';
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
      <div className="flex flex-col">
        <span className="text-label-md text-on-surface-variant">Contado: {money(declared)}</span>
        <span className="text-body-sm text-on-surface-variant">Diferencia contra lo esperado</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={tone} dot>
          {label}
        </Badge>
        <span className={cn('text-headline-sm tnum', tone === 'danger' ? 'text-error' : tone === 'info' ? 'text-secondary' : 'text-primary')}>
          {difference > 0 ? '+' : ''}
          {money(difference)}
        </span>
      </div>
    </div>
  );
}
