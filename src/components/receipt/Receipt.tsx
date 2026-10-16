import { createPortal } from 'react-dom';
import { Printer, ReceiptText, Share2 } from 'lucide-react';
import { RATE_SOURCE_LABELS } from '@/config/app';
import { formatDate, formatMoney, formatTime } from '@/lib/format';
import { formatRate } from '@/lib/fx';
import { fxSettingsOf, paymentMethodsOf, salePayments } from '@/lib/payments';
import { cn } from '@/lib/utils';
import type { Business, Sale } from '@/types';
import { Badge, Button, Modal, useToast } from '@/components/ui';

type ReceiptBusiness = Pick<
  Business,
  'name' | 'legalName' | 'taxId' | 'address' | 'phone' | 'currency' | 'locale' | 'taxName' | 'taxRate' | 'receiptFooter' | 'logoUrl' | 'fx' | 'country' | 'paymentMethods'
>;

/** Ticket en formato 80 mm. Se usa en pantalla y para impresión. */
export function Receipt({ sale, business }: { sale: Sale; business: ReceiptBusiness }) {
  const fx = fxSettingsOf(business);
  const baseCurrency = sale.currency || business.currency;
  const localCurrency = sale.localCurrency ?? null;
  const rate = sale.rate ?? null;
  const m = (n: number | null | undefined) => formatMoney(n, baseCurrency, business.locale);
  const inCurrency = (n: number | null | undefined, currency: string) =>
    formatMoney(n, currency || baseCurrency, currency === localCurrency ? fx.localLocale : business.locale);
  const local = (n: number | null | undefined) => (rate && localCurrency ? inCurrency((Number(n) || 0) * rate, localCurrency) : null);
  const payments = salePayments(sale);
  const hasExempt = sale.items.some((i) => i.taxExempt);
  const igtf = sale.igtf ?? 0;

  return (
    <div className="mx-auto w-full max-w-[300px] bg-white font-mono text-[12px] leading-snug text-black">
      <div className="flex flex-col items-center gap-0.5 text-center">
        {business.logoUrl && <img src={business.logoUrl} alt="" className="mb-1 h-10 w-auto object-contain grayscale" />}
        <div className="text-[14px] font-bold uppercase">{business.name}</div>
        {business.legalName && business.legalName !== business.name && <div>{business.legalName}</div>}
        {business.taxId && (
          <div>
            {fx.enabled || business.country === 'VE' ? 'RIF' : 'RFC/NIT'}: {business.taxId}
          </div>
        )}
        {business.address && <div>{business.address}</div>}
        {business.phone && <div>Tel. {business.phone}</div>}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <Row label="Ticket" value={sale.folio} bold />
      <Row label="Fecha" value={`${formatDate(sale.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' })} ${formatTime(sale.createdAt)}`} />
      <Row label="Atendió" value={sale.cashierName} />
      {sale.customerName && <Row label="Cliente" value={sale.customerName} />}
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex flex-col gap-1">
        {sale.items.map((it, i) => (
          <div key={i}>
            <div className="break-words">
              {it.name}
              {it.taxExempt ? ' (E)' : ''}
            </div>
            <div className="flex justify-between pl-2">
              <span>
                {it.qty} x {m(it.unitPrice)}
              </span>
              <span>{m(it.total)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex flex-col gap-0.5">
        {sale.discount > 0 && (
          <>
            <Row label="Importe" value={m(sale.gross)} />
            <Row label="Descuento" value={`-${m(sale.discount)}`} />
          </>
        )}
        <Row label="Subtotal" value={m(sale.subtotal)} />
        <Row label={`${business.taxName || 'IVA'} (${business.taxRate}%)`} value={m(sale.tax)} />
        {hasExempt && <div className="text-[11px]">(E) Exento de {business.taxName || 'IVA'}</div>}
        <div className="mt-1 flex justify-between text-[15px] font-bold">
          <span>TOTAL</span>
          <span>{m(sale.total)}</span>
        </div>
        {local(sale.total) && (
          <div className="flex justify-between font-bold">
            <span>TOTAL {localCurrency}</span>
            <span>{sale.totalLocal ? inCurrency(sale.totalLocal, localCurrency as string) : local(sale.total)}</span>
          </div>
        )}
        {igtf > 0 && (
          <>
            <Row label={`IGTF (${sale.igtfRate ?? fx.igtfRate}%)`} value={m(igtf)} />
            <Row label="Total pagado" value={m(sale.amountDue ?? sale.total + igtf)} bold />
          </>
        )}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex flex-col gap-0.5">
        <div className="font-bold">Forma de pago</div>
        {payments.map((p, i) => (
          <div key={i}>
            <Row label={p.label} value={inCurrency(p.amount, p.currency)} />
            {p.reference && <div className="pl-2 text-[11px]">Ref. {p.reference}</div>}
          </div>
        ))}
        {(sale.changeAmount ?? 0) > 0 ? (
          <Row
            label={`Vuelto${sale.changeMethodId ? ` (${payments.find((p) => p.methodId === sale.changeMethodId)?.label ?? paymentMethodsOf(business).find((x) => x.id === sale.changeMethodId)?.label ?? labelFromId(sale.changeMethodId)})` : ''}`}
            value={inCurrency(sale.changeAmount, sale.changeCurrency || baseCurrency)}
          />
        ) : sale.payments === undefined && sale.paymentMethod === 'cash' && (sale.change ?? 0) > 0 ? (
          <Row label="Cambio" value={m(sale.change)} />
        ) : null}
      </div>
      {rate && (
        <div className="mt-2 text-center text-[11px]">
          Tasa{sale.rateSource ? ` ${RATE_SOURCE_LABELS[sale.rateSource]}` : ''}: {formatRate(rate)}
        </div>
      )}
      <div className="my-2 border-t border-dashed border-black" />
      <div className="text-center">Artículos: {sale.itemCount}</div>
      {sale.status === 'voided' && <div className="mt-1 text-center text-[14px] font-bold">*** VENTA ANULADA ***</div>}
      {sale.offline && <div className="mt-1 text-center">Registrado sin conexión</div>}
      {business.receiptFooter && <div className="mt-2 text-center whitespace-pre-line">{business.receiptFooter}</div>}
    </div>
  );
}

function labelFromId(id: string) {
  return id.replace(/_/g, ' ');
}

/** El ticket como texto, para compartirlo por WhatsApp, correo, etc. (*negritas* al estilo WhatsApp). */
export function receiptText(sale: Sale, business: ReceiptBusiness): string {
  const fx = fxSettingsOf(business);
  const baseCurrency = sale.currency || business.currency;
  const localCurrency = sale.localCurrency ?? null;
  const rate = sale.rate ?? null;
  const m = (n: number | null | undefined) => formatMoney(n, baseCurrency, business.locale);
  const inCurrency = (n: number | null | undefined, currency: string) =>
    formatMoney(n, currency || baseCurrency, currency === localCurrency ? fx.localLocale : business.locale);
  const payments = salePayments(sale);
  const igtf = sale.igtf ?? 0;
  const lines: string[] = [`*${business.name}*`];
  if (business.taxId) lines.push(`${fx.enabled || business.country === 'VE' ? 'RIF' : 'RFC/NIT'}: ${business.taxId}`);
  lines.push(`Ticket ${sale.folio} · ${formatDate(sale.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' })} ${formatTime(sale.createdAt)}`);
  if (sale.status === 'voided') lines.push('*VENTA ANULADA*');
  lines.push('');
  for (const it of sale.items) lines.push(`${it.qty} x ${it.name}${it.taxExempt ? ' (E)' : ''} — ${m(it.total)}`);
  lines.push('');
  if (sale.discount > 0) lines.push(`Descuento: -${m(sale.discount)}`);
  lines.push(`Subtotal: ${m(sale.subtotal)}`);
  lines.push(`${business.taxName || 'IVA'} (${business.taxRate}%): ${m(sale.tax)}`);
  const totalLocal = rate && localCurrency ? inCurrency(sale.totalLocal ?? sale.total * rate, localCurrency) : null;
  lines.push(`*Total: ${m(sale.total)}*${totalLocal ? ` (${totalLocal})` : ''}`);
  if (igtf > 0) lines.push(`IGTF (${sale.igtfRate ?? fx.igtfRate}%): ${m(igtf)} · Total pagado: ${m(sale.amountDue ?? sale.total + igtf)}`);
  for (const p of payments) lines.push(`Pago: ${p.label} ${inCurrency(p.amount, p.currency)}${p.reference ? ` · Ref. ${p.reference}` : ''}`);
  if ((sale.changeAmount ?? 0) > 0) lines.push(`Vuelto: ${inCurrency(sale.changeAmount, sale.changeCurrency || baseCurrency)}`);
  if (rate) lines.push(`Tasa${sale.rateSource ? ` ${RATE_SOURCE_LABELS[sale.rateSource]}` : ''}: ${formatRate(rate)}`);
  if (business.receiptFooter) lines.push('', business.receiptFooter);
  return lines.join('\n');
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2${bold ? ' font-bold' : ''}`}>
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

/** Renderiza contenido solo para impresión (fuera del árbol visible). */
export function PrintArea({ children }: { children: React.ReactNode }) {
  const target = typeof document !== 'undefined' ? document.getElementById('print-root') : null;
  if (!target) return null;
  return createPortal(<div className="bg-white p-0 text-black">{children}</div>, target);
}

/** Modal con el ticket de una venta y botón de imprimir. */
export function ReceiptModal({
  sale,
  business,
  onClose,
  title = 'Ticket de venta',
  actions
}: {
  sale: Sale | null;
  business: ReceiptBusiness;
  onClose: () => void;
  title?: string;
  /** Botones extra en el pie (ej. "Nueva venta", "Anular"). */
  actions?: React.ReactNode;
}) {
  const toast = useToast();
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const share = async () => {
    if (!sale) return;
    try {
      await navigator.share({ title: `Ticket ${sale.folio} · ${business.name}`, text: receiptText(sale, business) });
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return; // la persona cerró el menú de compartir
      try {
        await navigator.clipboard.writeText(receiptText(sale, business));
        toast.success('No se pudo abrir el menú de compartir: el ticket se copió al portapapeles.');
      } catch {
        toast.error('No se pudo compartir el ticket.');
      }
    }
  };
  const subtitle = sale
    ? `${sale.folio} · ${formatMoney(sale.total, sale.currency || business.currency, business.locale)}${
        sale.rate && sale.localCurrency
          ? ` · ${formatMoney(sale.totalLocal ?? sale.total * sale.rate, sale.localCurrency, fxSettingsOf(business).localLocale)}`
          : ''
      }`
    : undefined;
  return (
    <Modal
      open={!!sale}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={ReceiptText}
      badge={sale?.status === 'voided' ? <Badge tone="danger">Anulada</Badge> : sale?.offline ? <Badge tone="warning">Sin conexión</Badge> : undefined}
      size="sm"
      bodyClassName="bg-slate-100"
      footer={
        <>
          {actions}
          {/* En el celular lo habitual es compartir el ticket (no hay impresora): ambos en una fila. */}
          <div className={cn('grid gap-2 sm:flex', canShare && 'grid-cols-2')}>
            {canShare && (
              <Button variant="secondary" icon={Share2} onClick={share}>
                Compartir
              </Button>
            )}
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
              Imprimir
            </Button>
          </div>
        </>
      }
    >
      {sale && (
        <>
          <div className="rounded-lg bg-white p-4 shadow-card">
            <Receipt sale={sale} business={business} />
          </div>
          <PrintArea>
            <Receipt sale={sale} business={business} />
          </PrintArea>
        </>
      )}
    </Modal>
  );
}
