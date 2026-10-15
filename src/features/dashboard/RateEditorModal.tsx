import { useEffect, useId, useState, type ReactNode } from 'react';
import { ArrowRightLeft, CloudDownload, Save } from 'lucide-react';
import { RATE_SOURCE_LABELS } from '@/config/app';
import { useFx } from '@/contexts/FxContext';
import { caracasToday } from '@/lib/fx';
import { formatPercent } from '@/lib/format';
import { errorMessage } from '@/lib/utils';
import { Badge, Button, Field, Input, Modal, NumberInput, useToast } from '@/components/ui';
import type { RatesPatch } from '@/services/fx';
import type { RateSource } from '@/types';
import { rateNumber } from './fxText';

type Value = number | '';

const toValue = (v: number | null | undefined): Value => (v && v > 0 ? v : '');
const toRate = (v: Value): number | null => (v === '' || !(v > 0) ? null : v);

/** Aviso si la tasa nueva se aleja mucho de la anterior (posible error de tipeo). */
function jumpHint(next: Value, prev: number | null | undefined): ReactNode {
  if (next === '' || !prev || !(next > 0)) return null;
  const pct = (next / prev - 1) * 100;
  if (Math.abs(pct) < 20) return null;
  return (
    <span className="text-amber-700">
      Cambia {formatPercent(pct, 1, true)} respecto a la anterior ({rateNumber(prev)}). Revisa que esté bien escrita.
    </span>
  );
}

/** Edición manual de las tasas (BCV con su fecha de vigencia, paralelo y propia). */
export function RateEditorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fx = useFx();
  const toast = useToast();
  const ids = { bcv: useId(), date: useId(), parallel: useId(), custom: useId() };
  const [bcv, setBcv] = useState<Value>('');
  const [bcvDate, setBcvDate] = useState('');
  const [parallel, setParallel] = useState<Value>('');
  const [custom, setCustom] = useState<Value>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prev = fx.rates;

  // Se cargan los valores vigentes solo al abrir (una actualización automática no pisa lo que se está escribiendo).
  useEffect(() => {
    if (!open) return;
    setBcv(toValue(fx.rates?.bcv));
    setBcvDate(fx.rates?.bcvDate ?? caracasToday());
    setParallel(toValue(fx.rates?.parallel));
    setCustom(toValue(fx.rates?.custom));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const next: Record<RateSource, number | null> = { bcv: toRate(bcv), parallel: toRate(parallel), custom: toRate(custom) };
  const effective = (next[fx.rateSource] ?? 0) > 0 ? next[fx.rateSource] : next.bcv;
  const busy = saving || fx.refreshing;
  const base = (n: number) => fx.moneyIn(n, fx.baseCurrency).replace(/[.,]00$/, '');

  const fetchOnline = async () => {
    setError(null);
    try {
      const r = await fx.refreshFromInternet();
      if (!r.bcv && !r.parallel) {
        toast.warning('El servicio no devolvió tasas. Cárgalas a mano.');
        return;
      }
      if (r.bcv) setBcv(r.bcv);
      if (r.bcvDate) setBcvDate(r.bcvDate);
      if (r.parallel) setParallel(r.parallel);
      toast.success('Tasas BCV y paralelo actualizadas desde internet.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const submit = async () => {
    if (!effective) {
      setError(`Ingresa la tasa ${RATE_SOURCE_LABELS[fx.rateSource]} (la que usa el POS) o al menos la tasa BCV.`);
      return;
    }
    const patch: RatesPatch = {};
    if (next.bcv !== (prev?.bcv ?? null)) patch.bcv = next.bcv;
    if (next.parallel !== (prev?.parallel ?? null)) patch.parallel = next.parallel;
    if (next.custom !== (prev?.custom ?? null)) patch.custom = next.custom;
    if (bcvDate && (patch.bcv !== undefined || bcvDate !== (prev?.bcvDate ?? ''))) patch.bcvDate = bcvDate;
    if (!Object.keys(patch).length) {
      toast.info('No hubo cambios en las tasas.');
      onClose();
      return;
    }
    setSaving(true);
    try {
      await fx.updateRates(patch);
      toast.success('Tasas guardadas. El POS ya cobra con la nueva tasa.');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const inUse = (s: RateSource) =>
    (fx.rateSource === s || (s === 'bcv' && !(next[fx.rateSource] ?? 0))) && <Badge tone="primary" size="xs">La usa el POS</Badge>;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tasas de cambio"
      subtitle="Bolívares por cada dólar. Se guardan en el historial con tu nombre."
      icon={ArrowRightLeft}
      size="md"
      dismissible={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button icon={Save} loading={saving} disabled={fx.refreshing} onClick={submit}>
            Guardar tasas
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body-sm text-on-surface-variant">Consulta BCV y paralelo en ve.dolarapi.com y guárdalos al instante.</p>
          <Button type="button" size="sm" variant="secondary" icon={CloudDownload} loading={fx.refreshing} disabled={saving} onClick={fetchOnline} className="shrink-0">
            Traer de internet
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <Field label="Tasa BCV (oficial)" htmlFor={ids.bcv} aside={inUse('bcv')} hint={jumpHint(bcv, prev?.bcv)}>
            <NumberInput id={ids.bcv} inputSize="lg" value={bcv} onValueChange={setBcv} suffix="Bs/$" placeholder="0,00" autoFocus />
          </Field>
          <Field label="Vigencia BCV" htmlFor={ids.date}>
            <Input id={ids.date} type="date" inputSize="lg" value={bcvDate} onChange={(e) => setBcvDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Tasa paralelo" htmlFor={ids.parallel} aside={inUse('parallel')} hint={jumpHint(parallel, prev?.parallel)}>
          <NumberInput id={ids.parallel} inputSize="lg" value={parallel} onValueChange={setParallel} suffix="Bs/$" placeholder="0,00" />
        </Field>
        <Field
          label="Tasa propia"
          htmlFor={ids.custom}
          aside={inUse('custom')}
          hint={jumpHint(custom, prev?.custom) ?? 'Opcional: si cobras a una tasa distinta a BCV o paralelo.'}
        >
          <NumberInput id={ids.custom} inputSize="lg" value={custom} onValueChange={setCustom} suffix="Bs/$" placeholder="Opcional" />
        </Field>

        {effective ? (
          <p className="rounded-xl border border-slate-200 px-3 py-2.5 text-body-sm text-on-surface-variant tnum">
            Con esta tasa:{' '}
            <b className="text-on-surface">
              {base(1)} = {fx.formatLocal(effective)}
            </b>{' '}
            · {base(10)} = {fx.formatLocal(effective * 10)} · {base(100)} = {fx.formatLocal(effective * 100)}
          </p>
        ) : null}
        {error && (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
