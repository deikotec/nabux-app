import { ArchiveRestore, CirclePause, Trash2 } from 'lucide-react';
import { Button, EmptyState, IconButton, Modal } from '@/components/ui';
import { formatNumber, formatRelative, formatTime } from '@/lib/format';
import type { HeldTicket } from './types';

interface HeldTicketsModalProps {
  open: boolean;
  onClose: () => void;
  held: HeldTicket[];
  money: (n: number) => string;
  /** Hay un ticket en curso (se pondrá en espera al recuperar otro). */
  hasCurrent: boolean;
  onRestore: (id: string) => void;
  onDiscard: (ticket: HeldTicket) => void;
}

/** Lista de tickets pausados en este equipo para recuperar o descartar. */
export function HeldTicketsModal({ open, onClose, held, money, hasCurrent, onRestore, onDiscard }: HeldTicketsModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tickets en espera"
      subtitle={
        hasCurrent
          ? 'Al recuperar uno, el ticket actual se pone en espera automáticamente.'
          : 'Guardados en este equipo. Recupera uno para seguir cobrando.'
      }
      icon={CirclePause}
      iconTone="warning"
      size="md"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      {held.length === 0 ? (
        <EmptyState
          icon={CirclePause}
          title="No hay tickets en espera"
          description="Cuando un cliente necesite un momento, presiona F8 para pausar su ticket y atender al siguiente."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {held.map((t) => {
            const names = t.lines.map((l) => l.name);
            const preview = names.slice(0, 3).join(', ') + (names.length > 3 ? ` y ${names.length - 3} más` : '');
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-tertiary-fixed text-tertiary">
                  <CirclePause className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-label-lg text-on-surface">{t.customerName.trim() || 'Cliente mostrador'}</p>
                    <span className="shrink-0 text-label-lg text-on-surface tnum">{money(t.total)}</span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant tnum">
                    {formatNumber(t.itemCount)} art. · {formatTime(t.createdAt)} ({formatRelative(t.createdAt)}) · {t.cashierName}
                  </p>
                  <p className="truncate text-body-sm text-on-surface-variant" title={names.join(', ')}>
                    {preview}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <IconButton icon={Trash2} label="Descartar ticket en espera" size="icon-sm" className="hover:text-error" onClick={() => onDiscard(t)} />
                  <Button size="sm" icon={ArchiveRestore} onClick={() => onRestore(t.id)}>
                    Recuperar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
