import { useState } from 'react';
import { Ban } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { ReceiptModal } from '@/components/receipt/Receipt';
import { Button, useConfirm, useToast } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/utils';
import { voidSale } from '@/services/sales';
import type { Sale } from '@/types';
import { formatQty } from './saleUtils';

/**
 * Detalle de una venta (ticket imprimible) con la acción "Anular venta"
 * para quien tiene permiso `void`. Se usa en el historial y en el panel principal.
 * Pasa la venta "fresca" (de la lista en tiempo real) para que el estado se actualice tras anular.
 */
export function SaleDetailModal({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const { business, businessId, actor, can } = useActiveBusiness();
  const { prompt } = useConfirm();
  const toast = useToast();
  const [voiding, setVoiding] = useState(false);

  const canVoid = !!sale && sale.status === 'completed' && can('void');

  const handleVoid = async () => {
    if (!sale) return;
    const reason = await prompt({
      title: 'Anular venta',
      message: (
        <>
          El ticket <b className="tnum">{sale.folio}</b> quedará anulado y se devolverán{' '}
          <b className="tnum">{formatQty(Number(sale.itemCount) || 0)}</b> artículos al inventario. Esta acción no se puede deshacer.
        </>
      ),
      inputLabel: 'Motivo',
      placeholder: 'Ej. Cobro duplicado, devolución del cliente…',
      confirmLabel: 'Anular venta',
      required: true,
      tone: 'danger'
    });
    if (reason === null) return;
    setVoiding(true);
    try {
      await voidSale(businessId, actor, sale.id, reason.trim());
      toast.success(`Venta ${sale.folio} anulada. El stock se devolvió al inventario.`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setVoiding(false);
    }
  };

  const actions = sale ? (
    <>
      {sale.status === 'voided' && (
        <p className="text-body-sm text-on-surface-variant sm:mr-auto sm:max-w-[60%]">
          Anulada{sale.voidedByName ? ` por ${sale.voidedByName}` : ''}
          {sale.voidedAt ? ` · ${formatDateTime(sale.voidedAt)}` : ''}
          {sale.voidReason ? (
            <>
              <br />
              <span className="text-on-surface">Motivo: {sale.voidReason}</span>
            </>
          ) : null}
        </p>
      )}
      {canVoid && (
        <Button variant="danger" icon={Ban} loading={voiding} onClick={handleVoid}>
          Anular venta
        </Button>
      )}
    </>
  ) : null;

  return <ReceiptModal sale={sale} business={business} onClose={onClose} actions={actions} />;
}
