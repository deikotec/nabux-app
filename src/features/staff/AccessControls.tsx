import { CircleCheck, Lock, RotateCcw, ShieldCheck } from 'lucide-react';
import { ALL_PERMISSIONS, ASSIGNABLE_ROLES, DEFAULT_ROLE_PERMISSIONS, PERMISSION_LABELS, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/config/app';
import { cn } from '@/lib/utils';
import { Badge, Checkbox } from '@/components/ui';
import type { Permission } from '@/types';
import { isCustomized, permissionLevel, roleDot, type AssignableRole } from './staffUtils';

/* ------------------------------------------------------------------ */
/* Selector de rol (tarjetas)                                          */
/* ------------------------------------------------------------------ */

export function RoleSelector({
  name,
  value,
  onChange,
  allowAdmin
}: {
  /** Nombre del grupo de radios (único por formulario). */
  name: string;
  value: AssignableRole;
  onChange: (role: AssignableRole) => void;
  /** Solo propietario/administrador pueden asignar el rol Administrador. */
  allowAdmin: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Rol del colaborador" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {ASSIGNABLE_ROLES.map((r) => {
        const selected = value === r;
        const locked = r === 'admin' && !allowAdmin;
        return (
          <label
            key={r}
            title={locked ? 'Solo el propietario o un administrador puede asignar este rol' : undefined}
            className={cn(
              'relative flex min-h-[92px] flex-col rounded-xl p-3 transition-all',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40',
              selected ? 'border-2 border-primary bg-primary-fixed/20' : 'border border-slate-200 bg-white',
              locked ? 'cursor-not-allowed opacity-55' : !selected && 'cursor-pointer hover:border-slate-300 hover:bg-surface-container-low/60'
            )}
          >
            <input
              type="radio"
              name={name}
              value={r}
              checked={selected}
              disabled={locked}
              onChange={() => onChange(r)}
              className="sr-only"
            />
            <span className="mb-1.5 flex items-center justify-between">
              <span className={cn('size-2 rounded-full', roleDot(r))} />
              {selected && <CircleCheck className="size-[18px] text-primary" aria-hidden />}
              {locked && <Lock className="size-4 text-slate-400" aria-hidden />}
            </span>
            <span className="text-label-md text-on-surface">{ROLE_LABELS[r]}</span>
            <span className="mt-0.5 text-[11px] leading-tight text-on-surface-variant">{ROLE_DESCRIPTIONS[r]}</span>
          </label>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Permisos                                                            */
/* ------------------------------------------------------------------ */

/** Permisos por defecto del rol, limitados a los que quien edita puede otorgar. */
export function defaultPermissionsFor(role: AssignableRole, grantable: (p: Permission) => boolean): Permission[] {
  return DEFAULT_ROLE_PERMISSIONS[role].filter(grantable);
}

const levelTone = { primary: 'primary', warning: 'warning', info: 'info', success: 'success', danger: 'danger' } as const;

/** Indicador "Nivel: …" para el encabezado de la sección de permisos. */
export function PermissionLevelTag({ role, permissions }: { role: AssignableRole; permissions: Permission[] }) {
  const level = permissionLevel(role, permissions);
  const custom = isCustomized(role, permissions);
  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5">
      <span className="text-data-mono text-on-surface-variant">Nivel:</span>
      <Badge tone={levelTone[level.tone]} size="xs">
        {level.label}
      </Badge>
      {custom && (
        <Badge tone="violet" size="xs">
          Personalizado
        </Badge>
      )}
    </span>
  );
}

export function PermissionsPicker({
  role,
  value,
  onChange,
  grantable
}: {
  role: AssignableRole;
  value: Permission[];
  onChange: (perms: Permission[]) => void;
  /** ¿Quien edita puede otorgar este permiso? (no se puede dar lo que no se tiene) */
  grantable: (p: Permission) => boolean;
}) {
  const isAdmin = role === 'admin';
  const custom = isCustomized(role, value);

  const toggle = (p: Permission, on: boolean) => {
    const next = on ? [...value, p] : value.filter((x) => x !== p);
    onChange(ALL_PERMISSIONS.filter((x) => next.includes(x)));
  };

  return (
    <div className="flex flex-col gap-3">
      {isAdmin ? (
        <p className="flex items-start gap-2 rounded-xl bg-primary-fixed/20 p-3 text-body-sm text-on-primary-fixed-variant">
          <ShieldCheck className="mt-px size-4 shrink-0" aria-hidden />
          Los administradores tienen todos los permisos, incluidos gestionar al personal y configurar el negocio.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-body-sm text-on-surface-variant">
            Se marcan los permisos habituales del rol <b>{ROLE_LABELS[role]}</b>. Puedes ajustarlos para esta persona.
          </p>
          {custom && (
            <button
              type="button"
              onClick={() => onChange(defaultPermissionsFor(role, grantable))}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-label-sm text-primary hover:bg-primary-fixed/25"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Restablecer
            </button>
          )}
        </div>
      )}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {ALL_PERMISSIONS.map((p) => {
          const canGrant = grantable(p);
          return (
            <Checkbox
              key={p}
              bordered
              checked={isAdmin || value.includes(p)}
              disabled={isAdmin || !canGrant}
              onChange={(on) => toggle(p, on)}
              label={PERMISSION_LABELS[p].label}
              description={
                !isAdmin && !canGrant ? 'No puedes otorgar un permiso que tú no tienes' : PERMISSION_LABELS[p].description
              }
            />
          );
        })}
      </div>
    </div>
  );
}
