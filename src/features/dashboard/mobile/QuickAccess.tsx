import type { ComponentType } from 'react';
import { Link } from 'react-router';
import { ChartSpline, LockKeyhole, PackagePlus, Plus, ReceiptText, ScanBarcode, Wallet } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCash } from '@/contexts/CashContext';
import { cn } from '@/lib/utils';
import { MSectionHeader, SectionNote } from '@/components/mobile';
import { PosIcon } from '@/components/layout/icons';

type Tone = 'secondary' | 'tertiary' | 'neutral';

interface Tile {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone: Tone;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
}

const BOX: Record<Tone, string> = {
  secondary: 'bg-secondary-fixed text-on-secondary-fixed',
  tertiary: 'bg-tertiary-fixed text-on-tertiary-fixed',
  neutral: 'bg-surface-container-highest text-on-surface-variant'
};

/** Cuatro atajos del turno según los permisos (la primera, destacada). */
export function QuickAccess() {
  const { can } = useActiveBusiness();
  const { session, loading, requestOpen, requestClose } = useCash();

  const tiles: Tile[] = [];
  if (can('pos')) tiles.push({ key: 'sell', label: 'Nueva venta', icon: PosIcon, tone: 'neutral', to: '/pos' });
  tiles.push({ key: 'sku', label: 'Consultar SKU', icon: ScanBarcode, tone: 'secondary', to: '/inventario?buscar=1' });
  if (can('inventory')) tiles.push({ key: 'in', label: 'Ingreso stock', icon: PackagePlus, tone: 'tertiary', to: '/inventario?modo=entrada' });
  if (can('pos')) {
    tiles.push(
      session
        ? { key: 'cash', label: 'Corte de caja', icon: LockKeyhole, tone: 'neutral', onClick: requestClose }
        : { key: 'cash', label: 'Abrir caja', icon: Wallet, tone: 'neutral', onClick: requestOpen, disabled: loading }
    );
  }
  if (can('inventory')) tiles.push({ key: 'new', label: 'Nuevo producto', icon: Plus, tone: 'secondary', to: '/inventario?nuevo=1' });
  tiles.push({ key: 'sales', label: 'Ver ventas', icon: ReceiptText, tone: 'neutral', to: '/ventas' });
  if (can('reports')) tiles.push({ key: 'reports', label: 'Reportes', icon: ChartSpline, tone: 'tertiary', to: '/reportes' });
  const shown = tiles.slice(0, 4);

  return (
    <section className="flex flex-col gap-2" aria-label="Accesos rápidos">
      <MSectionHeader title="Accesos rápidos" aside={<SectionNote>Operaciones de turno</SectionNote>} />
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
        {shown.map((t, i) => {
          const main = i === 0;
          const cls = cn(
            'flex min-h-[5.25rem] flex-col items-center justify-center gap-1 rounded-xl p-2 text-center shadow-card transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60',
            main ? 'bg-primary text-on-primary hover:bg-primary-container' : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'
          );
          const body = (
            <>
              <span className={cn('flex size-10 items-center justify-center rounded-lg', main ? 'bg-white/20' : BOX[t.tone])}>
                <t.icon className="size-[22px]" />
              </span>
              <span className="line-clamp-2 text-label-sm leading-tight">{t.label}</span>
            </>
          );
          return t.to ? (
            <Link key={t.key} to={t.to} className={cls}>
              {body}
            </Link>
          ) : (
            <button key={t.key} type="button" onClick={t.onClick} disabled={t.disabled} className={cls}>
              {body}
            </button>
          );
        })}
      </div>
    </section>
  );
}
