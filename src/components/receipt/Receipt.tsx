import { createPortal } from 'react-dom';
import { Printer, ReceiptText } from 'lucide-react';
import { PAYMENT_LABELS } from '@/config/app';
import { formatDate, formatMoney, formatTime } from '@/lib/format';
import type { Business, Sale } from '@/types';
import { Badge, Button, Modal } from '@/components/ui';

type ReceiptBusiness = Pick<Business, 'name' | 'legalName' | 'taxId' | 'address' | 'phone' | 'currency' | 'locale' | 'taxName' | 'taxRate' | 'receiptFooter' | 'logoUrl'>;

/** Ticket en formato 80 mm. Se usa en pantalla y para impresión. */
export function Receipt({ sale, business }: { sale: Sale; business: ReceiptBusiness }) {
  const m = (n: number | null | undefined) => formatMoney(n, business.currency, business.locale);
  return (
    <div className="mx-auto w-full max-w-[300px] bg-white font-mono text-[12px] leading-snug text-black">
      <div className="flex flex-col items-center gap-0.5 text-center">
        {business.logoUrl && <img src={business.logoUrl} alt="" className="mb-1 h-10 w-auto object-contain grayscale" />}
        <div className="text-[14px] font-bold uppercase">{business.name}</div>
        {business.legalName && business.legalName !== business.name && <div>{business.legalName}</div>}
        {business.taxId && <div>RFC/NIT: {business.taxId}</div>}
        {business.address && <div>{business.address}</div>}
        {business.phone && <div>Tel. {business.phone}</div>}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between">
        <span>Ticket</span>
        <span className="font-bold">{sale.folio}</span>
      </div>
      <div className="flex justify-between">
        <span>Fecha</span>
        <span>
          {formatDate(sale.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' })} {formatTime(sale.createdAt)}
        </span>
      </div>
      <div className="flex justify-between">
        <span>Atendió</span>
        <span>{sale.cashierName}</span>
      </div>
      {sale.customerName && (
        <div className="flex justify-between">
          <span>Cliente</span>
          <span className="max-w-[60%] truncate text-right">{sale.customerName}</span>
        </div>
      )}
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex flex-col gap-1">
        {sale.items.map((it, i) => (
          <div key={i}>
            <div className="break-words">{it.name}</div>
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
        <div className="mt-1 flex justify-between text-[15px] font-bold">
          <span>TOTAL</span>
          <span>{m(sale.total)}</span>
        </div>
        <Row label={`Pago: ${PAYMENT_LABELS[sale.paymentMethod]}`} value={sale.paymentMethod === 'cash' ? m(sale.cashReceived) : m(sale.total)} />
        {sale.paymentMethod === 'cash' && <Row label="Cambio" value={m(sale.change)} />}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="text-center">Artículos: {sale.itemCount}</div>
      {sale.status === 'voided' && <div className="mt-1 text-center text-[14px] font-bold">*** VENTA ANULADA ***</div>}
      {sale.offline && <div className="mt-1 text-center">Registrado sin conexión</div>}
      {business.receiptFooter && <div className="mt-2 text-center whitespace-pre-line">{business.receiptFooter}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <span>{value}</span>
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
  return (
    <Modal
      open={!!sale}
      onClose={onClose}
      title={title}
      subtitle={sale ? `${sale.folio} · ${formatMoney(sale.total, business.currency, business.locale)}` : undefined}
      icon={ReceiptText}
      badge={sale?.status === 'voided' ? <Badge tone="danger">Anulada</Badge> : sale?.offline ? <Badge tone="warning">Sin conexión</Badge> : undefined}
      size="sm"
      bodyClassName="bg-slate-100"
      footer={
        <>
          {actions}
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
            Imprimir
          </Button>
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
