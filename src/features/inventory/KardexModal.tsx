import type { LucideIcon } from 'lucide-react';
import { ArrowLeftRight, ClipboardCheck, History, PackageCheck, PackageMinus, PackagePlus, ShoppingCart, Undo2 } from 'lucide-react';
import { Badge, Button, EmptyState, Modal, ProductThumb, Skeleton, StockBadge, type Tone } from '@/components/ui';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useMovements } from '@/hooks/data';
import { formatDateTime, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MovementType, Product } from '@/types';

const MOVEMENT_META: Record<MovementType, { label: string; tone: Tone; icon: LucideIcon }> = {
  initial: { label: 'Stock inicial', tone: 'info', icon: PackageCheck },
  in: { label: 'Entrada', tone: 'success', icon: PackagePlus },
  out: { label: 'Salida / merma', tone: 'danger', icon: PackageMinus },
  adjust: { label: 'Ajuste', tone: 'warning', icon: ClipboardCheck },
  sale: { label: 'Venta', tone: 'primary', icon: ShoppingCart },
  void: { label: 'Anulación', tone: 'violet', icon: Undo2 }
};

const LIMIT = 100;

export function KardexModal({ product, onClose, onRegister }: { product: Product; onClose: () => void; onRegister?: () => void }) {
  const { business, money } = useActiveBusiness();
  const { data, loading, error } = useMovements(product.id, LIMIT);
  const locale = business.locale;

  const totals = data.reduce(
    (acc, m) => {
      const q = Number(m.qty) || 0;
      if (q > 0) acc.in += q;
      else acc.out += -q;
      return acc;
    },
    { in: 0, out: 0 }
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      icon={History}
      iconTone="secondary"
      title="Movimientos de stock (kardex)"
      subtitle={`Últimos ${LIMIT} movimientos registrados para este producto.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          {onRegister && (
            <Button icon={ArrowLeftRight} onClick={onRegister}>
              Registrar movimiento
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <ProductThumb product={product} size="md" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-label-lg text-on-surface">{product.name}</span>
              <span className="text-body-sm text-on-surface-variant tnum">
                {product.sku}
                {product.barcode ? ` · ${product.barcode}` : ''}
              </span>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center sm:flex sm:gap-5 sm:text-right">
            <div>
              <dt className="text-label-sm text-on-surface-variant uppercase">Stock actual</dt>
              <dd className="flex items-center justify-center gap-1.5 text-headline-sm text-on-surface tnum sm:justify-end">
                {formatNumber(product.stock, locale)}
                <StockBadge product={product} className="hidden md:inline-flex" />
              </dd>
            </div>
            <div>
              <dt className="text-label-sm text-on-surface-variant uppercase">Entradas</dt>
              <dd className="text-headline-sm text-emerald-700 tnum">+{formatNumber(totals.in, locale)}</dd>
            </div>
            <div>
              <dt className="text-label-sm text-on-surface-variant uppercase">Salidas</dt>
              <dd className="text-headline-sm text-error tnum">−{formatNumber(totals.out, locale)}</dd>
            </div>
          </dl>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={History}
            title="No se pudo cargar el kardex"
            description="Revisa tu conexión e intenta de nuevo. Si el problema continúa, puede faltar un índice en la base de datos."
          />
        ) : data.length === 0 ? (
          <EmptyState icon={History} title="Sin movimientos todavía" description="Las entradas, salidas, ajustes y ventas de este producto aparecerán aquí." />
        ) : (
          <>
            {/* Escritorio */}
            <div className="hidden overflow-hidden rounded-xl border border-slate-200/80 md:block">
              <table className="w-full border-collapse text-left">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="h-10 px-4 text-label-sm text-slate-500 uppercase">Fecha y hora</th>
                    <th className="h-10 px-4 text-label-sm text-slate-500 uppercase">Tipo</th>
                    <th className="h-10 px-4 text-right text-label-sm text-slate-500 uppercase">Cantidad</th>
                    <th className="h-10 px-4 text-right text-label-sm text-slate-500 uppercase">Stock result.</th>
                    <th className="h-10 px-4 text-label-sm text-slate-500 uppercase">Motivo</th>
                    <th className="h-10 px-4 text-label-sm text-slate-500 uppercase">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((m) => {
                    const meta = MOVEMENT_META[m.type] ?? MOVEMENT_META.adjust;
                    const q = Number(m.qty) || 0;
                    return (
                      <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                        <td className="px-4 py-2.5 text-body-sm whitespace-nowrap text-on-surface-variant tnum">{formatDateTime(m.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <Badge tone={meta.tone} icon={meta.icon}>
                            {meta.label}
                          </Badge>
                        </td>
                        <td className={cn('px-4 py-2.5 text-right text-label-lg tnum', q > 0 ? 'text-emerald-700' : q < 0 ? 'text-error' : 'text-on-surface-variant')}>
                          {q > 0 ? '+' : q < 0 ? '−' : ''}
                          {formatNumber(Math.abs(q), locale)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-body-md text-on-surface tnum">
                          {m.stockAfter === null || m.stockAfter === undefined ? '—' : formatNumber(m.stockAfter, locale)}
                        </td>
                        <td className="max-w-64 px-4 py-2.5 text-body-sm text-on-surface">
                          <span className="line-clamp-2">{m.reason || '—'}</span>
                          {m.unitCost ? <span className="text-on-surface-variant tnum">Costo unit. {money(m.unitCost)}</span> : null}
                        </td>
                        <td className="px-4 py-2.5 text-body-sm text-on-surface-variant">{m.userName || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Móvil */}
            <ul className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200/80 md:hidden">
              {data.map((m) => {
                const meta = MOVEMENT_META[m.type] ?? MOVEMENT_META.adjust;
                const q = Number(m.qty) || 0;
                return (
                  <li key={m.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                    <div className="flex min-w-0 flex-col gap-1">
                      <Badge tone={meta.tone} icon={meta.icon} className="self-start">
                        {meta.label}
                      </Badge>
                      <span className="truncate text-body-sm text-on-surface">{m.reason || '—'}</span>
                      <span className="text-body-sm text-on-surface-variant">
                        {m.userName || '—'} · <span className="tnum">{formatDateTime(m.createdAt)}</span>
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span className={cn('text-label-lg tnum', q > 0 ? 'text-emerald-700' : q < 0 ? 'text-error' : 'text-on-surface-variant')}>
                        {q > 0 ? '+' : q < 0 ? '−' : ''}
                        {formatNumber(Math.abs(q), locale)}
                      </span>
                      <span className="text-body-sm text-on-surface-variant tnum">
                        Queda {m.stockAfter === null || m.stockAfter === undefined ? '—' : formatNumber(m.stockAfter, locale)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
