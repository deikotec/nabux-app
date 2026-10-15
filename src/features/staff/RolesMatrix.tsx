import { Check, Minus, ShieldCheck, Sparkles, UserPlus } from 'lucide-react';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, PERMISSION_LABELS, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_TONES } from '@/config/app';
import { cn } from '@/lib/utils';
import type { Invite, Member, Role } from '@/types';
import { Badge, Card, CardHeader, ProgressBar, Table, TD, TH, THead, TR } from '@/components/ui';
import { isCustomized, roleBar, type AssignableRole } from './staffUtils';

const ROLES: Role[] = ['owner', 'admin', 'manager', 'cashier', 'warehouse'];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function RolesMatrix({
  members,
  invites,
  iAmAdmin,
  onInvite
}: {
  members: Member[];
  invites: Invite[];
  iAmAdmin: boolean;
  onInvite: (role: AssignableRole) => void;
}) {
  const total = members.length;
  const customCount = members.filter((m) => isCustomized(m.role, m.permissions)).length;
  const stats = ROLES.map((role) => {
    const list = members.filter((m) => m.role === role);
    return {
      role,
      count: list.length,
      suspended: list.filter((m) => m.status === 'suspended').length,
      pending: invites.filter((i) => i.role === role).length
    };
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Niveles de seguridad */}
      <section aria-labelledby="niveles-title" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-primary-fixed-dim/50 bg-primary-fixed/15 p-5">
          <div className="flex flex-col gap-2">
            <h2 id="niveles-title" className="flex items-center gap-2 text-headline-sm text-on-primary-fixed-variant">
              <ShieldCheck className="size-5" aria-hidden />
              Niveles de seguridad
            </h2>
            <p className="text-body-sm text-on-surface-variant">
              Cada rol trae un paquete de permisos. El propietario y los administradores tienen acceso total; el resto solo puede hacer lo
              que tenga marcado.
            </p>
          </div>
          <p className="flex items-start gap-2 rounded-xl bg-white/70 p-3 text-body-sm text-on-surface">
            <Sparkles className="mt-px size-4 shrink-0 text-primary" aria-hidden />
            <span>
              Los permisos se pueden personalizar por persona.
              {customCount > 0 && <b> {plural(customCount, 'persona tiene', 'personas tienen')} permisos personalizados.</b>}
            </span>
          </p>
        </div>

        {stats.map((s) => {
          const assignable = s.role !== 'owner' && (s.role !== 'admin' || iAmAdmin);
          return (
            <Card key={s.role} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="text-label-sm tracking-wider text-on-surface-variant uppercase">{ROLE_LABELS[s.role]}</span>
                  <span className="text-headline-md text-on-surface tnum">{plural(s.count, 'usuario', 'usuarios')}</span>
                </div>
                <Badge tone={ROLE_TONES[s.role]} size="xs">
                  {DEFAULT_ROLE_PERMISSIONS[s.role].length}/{ALL_PERMISSIONS.length} permisos
                </Badge>
              </div>
              <ProgressBar value={s.count} max={Math.max(total, 1)} tone={roleBar(s.role)} />
              <p className="text-body-sm text-on-surface-variant">{ROLE_DESCRIPTIONS[s.role]}</p>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-body-sm text-on-surface-variant">
                  {[
                    s.pending ? plural(s.pending, 'invitación pendiente', 'invitaciones pendientes') : null,
                    s.suspended ? plural(s.suspended, 'suspendido', 'suspendidos') : null
                  ]
                    .filter(Boolean)
                    .join(' · ') || (s.role === 'owner' ? 'Único e intransferible' : ' ')}
                </span>
                {assignable && (
                  <button
                    type="button"
                    onClick={() => onInvite(s.role as AssignableRole)}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-label-md text-primary hover:bg-primary-fixed/25"
                  >
                    <UserPlus className="size-3.5" aria-hidden />
                    Invitar
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </section>

      {/* Matriz */}
      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            icon={ShieldCheck}
            title="Matriz de permisos por rol"
            subtitle="Permisos por defecto que recibe cada rol al invitarlo. Los permisos se pueden personalizar por persona."
          />
        </div>
        <Table>
          <caption className="sr-only">Permisos por defecto de cada rol</caption>
          <THead>
            <TH scope="col" className="sticky left-0 z-10 min-w-[220px] bg-slate-50 pl-5">
              Permiso
            </TH>
            {ROLES.map((r) => (
              <TH key={r} scope="col" align="center" className="min-w-[120px]">
                <span className="inline-flex flex-col items-center gap-1 normal-case">
                  <Badge tone={ROLE_TONES[r]} dot size="xs">
                    {ROLE_LABELS[r]}
                  </Badge>
                </span>
              </TH>
            ))}
          </THead>
          <tbody>
            {ALL_PERMISSIONS.map((p) => (
              <TR key={p}>
                <TD className="sticky left-0 z-10 bg-white pl-5">
                  <span className="flex flex-col">
                    <span className="text-label-md text-on-surface">{PERMISSION_LABELS[p].label}</span>
                    <span className="text-body-sm text-on-surface-variant">{PERMISSION_LABELS[p].description}</span>
                  </span>
                </TD>
                {ROLES.map((r) => {
                  const has = DEFAULT_ROLE_PERMISSIONS[r].includes(p);
                  return (
                    <TD key={r} align="center">
                      {has ? (
                        <span className="inline-flex size-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                          <Check className="size-4" strokeWidth={3} aria-hidden />
                          <span className="sr-only">Sí</span>
                        </span>
                      ) : (
                        <span className="inline-flex size-7 items-center justify-center text-slate-300">
                          <Minus className="size-4" aria-hidden />
                          <span className="sr-only">No</span>
                        </span>
                      )}
                    </TD>
                  );
                })}
              </TR>
            ))}
            <tr className="bg-surface-container-low/60">
              <th scope="row" className="sticky left-0 z-10 bg-surface-container-low py-3 pr-4 pl-5 text-left text-label-md text-on-surface">
                Personas con este rol
              </th>
              {stats.map((s) => (
                <td key={s.role} className={cn('px-4 py-3 text-center text-label-lg tnum', s.count ? 'text-on-surface' : 'text-slate-400')}>
                  {s.count}
                </td>
              ))}
            </tr>
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
