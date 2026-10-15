import { LockKeyhole, Wallet } from 'lucide-react';
import { Button } from '@/components/ui';

/** Aviso prominente cuando el negocio exige caja abierta para cobrar. */
export function CashNotice({ onOpen }: { onOpen: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-card sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <LockKeyhole className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-label-lg text-amber-900">Tu caja está cerrada</p>
          <p className="text-body-sm text-amber-800">
            Puedes armar el ticket, pero para cobrar necesitas abrir caja y registrar el fondo inicial en efectivo.
          </p>
        </div>
      </div>
      <Button icon={Wallet} onClick={onOpen} className="sm:ml-auto">
        Abrir caja
      </Button>
    </div>
  );
}
