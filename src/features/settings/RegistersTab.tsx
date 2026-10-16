import { useState } from 'react';
import { Pencil, Plus, Store, Users } from 'lucide-react';
import { useActiveBusiness } from '@/contexts/BusinessContext';
import { useCash } from '@/contexts/CashContext';
import { formatTime } from '@/lib/format';
import { newRegisterId, registersOf } from '@/lib/registers';
import { cn, errorMessage, normalize } from '@/lib/utils';
import { logActivity } from '@/services/activity';
import { saveRegisters } from '@/services/business';
import type { CashRegister } from '@/types';
import { Badge, Button, IconButton, Input, StatusDot, Toggle, useConfirm, useToast } from '@/components/ui';
import { Callout, SettingsCard } from './SettingsUI';

const NAME_MAX = 30;

/** Cajas registradoras del negocio: cuántas hay y cómo se llaman. Los cambios se guardan al instante. */
export function RegistersTab() {
  const { business, businessId, actor, can } = useActiveBusiness();
  const { registers: views } = useCash();
  const toast = useToast();
  const { prompt } = useConfirm();
  const canEdit = can('settings');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const list = registersOf(business);
  const activeCount = list.filter((r) => r.active).length;
  const stateOf = (id: string) => views.find((v) => v.register.id === id)?.openBy ?? null;
  const taken = (name: string, except?: string) => list.some((r) => r.id !== except && normalize(r.name) === normalize(name));

  const persist = async (next: CashRegister[], message: string, key: string) => {
    setBusy(key);
    try {
      await saveRegisters(businessId, next);
      logActivity(businessId, actor, { type: 'settings_update', message });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const add = async () => {
    const name = newName.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (name.length > NAME_MAX) return toast.error(`Máximo ${NAME_MAX} caracteres.`);
    if (taken(name)) return toast.warning(`Ya existe una caja llamada “${name}”.`);
    await persist([...list, { id: newRegisterId(list), name, active: true }], `Agregó la caja “${name}”`, '__add');
    setNewName('');
    toast.success(`“${name}” agregada. Cada equipo elige en qué caja cobra al abrir el POS.`);
  };

  const rename = async (r: CashRegister) => {
    const value = await prompt({
      title: 'Renombrar caja',
      inputLabel: 'Nombre',
      defaultValue: r.name,
      required: true,
      confirmLabel: 'Guardar',
      tone: 'primary'
    });
    const name = value?.trim().replace(/\s+/g, ' ');
    if (!name || name === r.name) return;
    if (name.length > NAME_MAX) return toast.error(`Máximo ${NAME_MAX} caracteres.`);
    if (taken(name, r.id)) return toast.warning(`Ya existe una caja llamada “${name}”.`);
    await persist(
      list.map((x) => (x.id === r.id ? { ...x, name } : x)),
      `Renombró la caja “${r.name}” a “${name}”`,
      r.id
    );
  };

  const toggle = async (r: CashRegister, active: boolean) => {
    if (!active) {
      if (stateOf(r.id)) return toast.warning(`${r.name} tiene un turno abierto: haz el corte antes de desactivarla.`);
      if (activeCount <= 1) return toast.warning('El negocio necesita al menos una caja activa.');
    }
    await persist(
      list.map((x) => (x.id === r.id ? { ...x, active } : x)),
      `${active ? 'Activó' : 'Desactivó'} la caja “${r.name}”`,
      r.id
    );
  };

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <SettingsCard
        icon={Store}
        title="Cajas registradoras"
        subtitle="Cuántos puntos de cobro (cajones) tiene el negocio. Cada caja tiene su propio turno y su propio corte."
        badge={<Badge tone="primary">{activeCount === 1 ? '1 caja activa' : `${activeCount} cajas activas`}</Badge>}
      >
        <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200">
          {list.map((r) => {
            const openBy = stateOf(r.id);
            return (
              <div key={r.id} className={cn('flex items-center gap-3 px-4 py-3', !r.active && 'bg-surface-container-low/60')}>
                <StatusDot tone={!r.active ? 'neutral' : openBy ? 'success' : 'warning'} pulse={!!openBy} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className={cn('truncate text-label-lg', r.active ? 'text-on-surface' : 'text-on-surface-variant line-through')}>{r.name}</span>
                  <span className="truncate text-body-sm text-on-surface-variant">
                    {!r.active
                      ? 'Desactivada: no aparece en el POS'
                      : openBy
                        ? `Abierta por ${openBy.name}${openBy.at ? ` desde las ${formatTime(openBy.at)}` : ''}`
                        : 'Cerrada'}
                  </span>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton icon={Pencil} label={`Renombrar ${r.name}`} onClick={() => rename(r)} disabled={!!busy} />
                    <Toggle checked={r.active} onChange={(v) => toggle(r, v)} disabled={!!busy} ariaLabel={`${r.active ? 'Desactivar' : 'Activar'} ${r.name}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {canEdit && (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Ej. Caja ${list.length + 1}`}
              maxLength={NAME_MAX}
              aria-label="Nombre de la nueva caja"
              className="sm:flex-1"
            />
            <Button type="submit" icon={Plus} loading={busy === '__add'} disabled={!newName.trim() || !!busy}>
              Agregar caja
            </Button>
          </form>
        )}
      </SettingsCard>

      <Callout icon={Users} title="Cómo funcionan las cajas">
        <span>
          <strong>Una sola caja:</strong> cuando alguien la abre, los demás la ven abierta al entrar al POS y cobran en el mismo turno. No se
          puede abrir dos veces.
        </span>
        <span>
          <strong>Varias cajas:</strong> cada equipo elige en qué caja cobra (se recuerda en ese equipo). Cada caja se abre y se cierra por
          separado.
        </span>
        <span>
          <strong>Corte:</strong> suma las ventas de todas las personas que cobraron en el turno; lo puede hacer cualquiera con permiso de
          vender.
        </span>
      </Callout>
    </div>
  );
}
