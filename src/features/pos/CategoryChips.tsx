import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryChipsProps {
  categories: { name: string; count: number }[];
  total: number;
  value: string | null;
  onChange: (v: string | null) => void;
}

/** Filtro rápido por categoría (píldoras con scroll horizontal). */
export function CategoryChips({ categories, total, value, onChange }: CategoryChipsProps) {
  const chip = (active: boolean) =>
    cn(
      'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-label-md whitespace-nowrap shadow-card transition-all active:scale-95',
      active ? 'bg-primary text-on-primary' : 'border border-slate-200/80 bg-white text-on-surface hover:bg-surface-container-low'
    );
  const count = (n: number, active: boolean) => (
    <span className={cn('rounded-full px-1.5 text-[10px] font-bold tnum', active ? 'bg-white/20' : 'bg-surface-container text-on-surface-variant')}>{n}</span>
  );

  return (
    <div role="group" aria-label="Filtrar por categoría" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pt-0.5 pb-1 sm:mx-0 sm:px-0">
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={chip(value === null)}>
        <LayoutGrid className="size-4" />
        Todos
        {count(total, value === null)}
      </button>
      {categories.map((c) => {
        const active = value === c.name;
        return (
          <button key={c.name} type="button" aria-pressed={active} onClick={() => onChange(active ? null : c.name)} className={chip(active)}>
            {c.name}
            {count(c.count, active)}
          </button>
        );
      })}
    </div>
  );
}
