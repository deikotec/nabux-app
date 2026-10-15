import { Columns3, Sparkles, TriangleAlert } from 'lucide-react';
import { Badge, Select } from '@/components/ui';
import { cn } from '@/lib/utils';
import { fieldLabel, fitsData, NUMERIC_FIELDS } from './fields';
import type { ColumnInfo, ColumnMapping, FieldKey, ImportTable, Target } from './types';

/** Avisos de una columna según lo que contiene. */
function columnWarnings(m: ColumnMapping, info: ColumnInfo): string[] {
  const out: string[] = [];
  if (m.target === 'ignorar') return out;
  if (info.filled === 0) out.push('La columna está vacía.');
  else if (!fitsData(m.target, info)) {
    out.push(NUMERIC_FIELDS.has(m.target) ? 'Muchos valores no son números.' : m.target === 'imagen' ? 'Los valores no parecen enlaces (http…).' : 'Los valores no encajan con este campo.');
  }
  if ((m.target === 'sku' || m.target === 'codigo_barras') && info.unique < info.filled) {
    out.push(`Hay ${info.filled - info.unique} valor(es) repetidos: esas filas darán error.`);
  }
  return out;
}

export function ColumnsStep({
  table,
  tables,
  tableIndex,
  onTable,
  infos,
  mapping,
  onChange,
  fields,
  missing,
  dual,
  taxName
}: {
  table: ImportTable;
  tables: ImportTable[];
  tableIndex: number;
  onTable: (i: number) => void;
  infos: ColumnInfo[];
  mapping: ColumnMapping[];
  onChange: (index: number, target: Target) => void;
  fields: FieldKey[];
  missing: string[];
  dual: boolean;
  taxName: string;
}) {
  const usedBy = new Map<Target, number>();
  mapping.forEach((m, i) => m.target !== 'ignorar' && usedBy.set(m.target, i));
  const options = [...fields, 'ignorar' as const];
  const fromAi = mapping.some((m) => m.source === 'ai');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-body-md text-on-surface-variant">
          Indica qué dato trae cada columna. {fromAi ? 'La IA ya propuso una opción para cada una;' : 'Ya detectamos las que pudimos;'} revisa sobre todo los
          precios.
          {table.headerLine > 1 && (
            <>
              {' '}
              Los encabezados están en la <b className="text-on-surface">fila {table.headerLine}</b>
              {table.sheet ? (
                <>
                  {' '}
                  de la hoja <b className="text-on-surface">«{table.sheet}»</b>
                </>
              ) : null}
              .
            </>
          )}
        </p>
        {tables.length > 1 && (
          <Select inputSize="sm" value={String(tableIndex)} onChange={(e) => onTable(Number(e.target.value))} className="sm:w-64" aria-label="Hoja a importar">
            {tables.map((t, i) => (
              <option key={`${t.sheet}-${t.headerLine}-${i}`} value={i}>
                {t.sheet || 'Tabla'} · {t.rows.length} filas
              </option>
            ))}
          </Select>
        )}
      </div>

      {missing.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-body-sm text-red-800" role="alert">
          <TriangleAlert className="mt-px size-4 shrink-0" />
          <span>
            Falta indicar: <b>{missing.join(', ')}</b>.
          </span>
        </div>
      )}

      <ul className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80">
        {infos.map((info) => {
          const m = mapping[info.index];
          const warnings = columnWarnings(m, info);
          return (
            <li key={info.index} className={cn('flex flex-col gap-2 bg-white px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4', m.target === 'ignorar' && 'bg-slate-50/60')}>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant">
                  <Columns3 className="size-4" />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className={cn('truncate text-label-lg', m.target === 'ignorar' ? 'text-on-surface-variant' : 'text-on-surface')}>{info.header}</span>
                  <span className="truncate text-body-sm text-on-surface-variant">
                    {info.samples.length ? info.samples.join(' · ') : <i>sin datos</i>}
                  </span>
                  {warnings.map((w) => (
                    <span key={w} className="text-body-sm text-amber-700">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 sm:w-72 sm:shrink-0">
                {m.source === 'ai' && m.target !== 'ignorar' && (
                  <Badge size="xs" tone="violet" icon={Sparkles}>
                    IA
                  </Badge>
                )}
                <Select
                  inputSize="sm"
                  value={m.target}
                  onChange={(e) => onChange(info.index, e.target.value as Target)}
                  aria-label={`Campo para la columna ${info.header}`}
                  className="flex-1"
                >
                  {options.map((f) => {
                    const other = usedBy.get(f);
                    const taken = f !== 'ignorar' && other !== undefined && other !== info.index;
                    return (
                      <option key={f} value={f}>
                        {fieldLabel(f, { dual, taxName })}
                        {taken ? ` (en «${infos[other].header}»)` : ''}
                      </option>
                    );
                  })}
                </Select>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
