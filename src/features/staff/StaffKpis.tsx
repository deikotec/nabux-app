import { CircleCheck, IdCard, MailPlus, ReceiptText, TriangleAlert } from 'lucide-react';
import { firstName, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CashSession, Invite, Member } from '@/types';
import type { ReactNode } from 'react';
import { KpiCard } from '@/components/ui';

const isZero = (n: number | null | undefined) => Math.abs(Number(n) || 0) < 0.005;

function FooterRow({ left, right, tone = 'muted' }: { left: ReactNode; right?: ReactNode; tone?: 'primary' | 'secondary' | 'error' | 'muted' }) {
  const color = { primary: 'text-primary', secondary: 'text-secondary', error: 'text-error', muted: 'text-on-surface-variant' }[tone];
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
      <span className={cn('flex min-w-0 items-center gap-1.5 text-label-sm', color)}>{left}</span>
      {right && <span className="shrink-0 text-right text-data-mono text-on-surface-variant tnum">{right}</span>}
    </div>
  );
}

export function StaffKpis({
  members,
  invites,
  openSessions,
  closedSessions,
  canReports,
  loading,
  money
}: {
  members: Member[];
  invites: Invite[];
  openSessions: CashSession[];
  closedSessions: CashSession[];
  canReports: boolean;
  loading: { members: boolean; invites: boolean; open: boolean; closed: boolean };
  money: (n: number | null | undefined) => string;
}) {
  const active = members.filter((m) => m.status !== 'suspended').length;
  const suspended = members.length - active;

  /* ---- En operación ---- */
  const openNames = openSessions.map((s) => firstName(s.openedByName) || 'Alguien');
  const namesText = openNames.length > 2 ? `${openNames.slice(0, 2).join(', ')} +${openNames.length - 2}` : openNames.join(' y ');
  const operation = canReports
    ? {
        value: `${openSessions.length} ${openSessions.length === 1 ? 'caja abierta' : 'cajas abiertas'}`,
        footer: (
          <FooterRow
            tone={openSessions.length ? 'primary' : 'muted'}
            left={
              <>
                <span className={cn('size-2 shrink-0 rounded-full', openSessions.length ? 'animate-pulse bg-primary' : 'bg-slate-300')} aria-hidden />
                <span className="truncate">{openSessions.length ? `En turno: ${namesText}` : 'Nadie tiene caja abierta'}</span>
              </>
            }
            right={`${active} ${active === 1 ? 'activo' : 'activos'}`}
          />
        )
      }
    : {
        value: `${active} ${active === 1 ? 'activo' : 'activos'}`,
        footer: (
          <FooterRow
            tone="primary"
            left={
              <>
                <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                <span className="truncate">Con acceso vigente</span>
              </>
            }
            right={`${suspended} ${suspended === 1 ? 'suspendido' : 'suspendidos'}`}
          />
        )
      };

  /* ---- Invitaciones ---- */
  const oldest = invites.reduce<Invite | null>((acc, i) => {
    const t = i.createdAt?.toMillis?.() ?? Infinity;
    const a = acc?.createdAt?.toMillis?.() ?? Infinity;
    return !acc || t < a ? i : acc;
  }, null);

  /* ---- Auditoría de cajas ---- */
  const last = closedSessions[0];
  const diff = Number(last?.difference) || 0;
  const conformes = closedSessions.filter((s) => isZero(s.difference)).length;
  let auditValue: string;
  let auditFooter: ReactNode;
  let auditTone: 'secondary' | 'error' = 'secondary';
  if (!last) {
    auditValue = 'Sin cortes';
    auditFooter = <FooterRow left={canReports ? 'Aún no hay cortes de caja' : 'Aún no tienes cortes de caja'} />;
  } else if (isZero(diff)) {
    auditValue = 'Conforme';
    auditFooter = (
      <FooterRow
        tone="secondary"
        left={
          <>
            <CircleCheck className="size-4 shrink-0" aria-hidden />
            <span className="truncate">Último corte {formatRelative(last.closedAt)}</span>
          </>
        }
        right={`Diferencia ${money(0)}`}
      />
    );
  } else {
    auditTone = 'error';
    auditValue = `${diff > 0 ? '+' : '−'}${money(Math.abs(diff))}`;
    auditFooter = (
      <FooterRow
        tone="error"
        left={
          <>
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            <span className="truncate">
              {diff > 0 ? 'Sobrante' : 'Faltante'} · {firstName(last.closedByName || last.openedByName)} · {formatRelative(last.closedAt)}
            </span>
          </>
        }
        right={`${conformes}/${closedSessions.length} conformes`}
      />
    );
  }

  return (
    <section aria-label="Indicadores del equipo" className="grid gap-4 md:grid-cols-3">
      <KpiCard
        label={<span className="tracking-wider uppercase">En operación</span>}
        value={operation.value}
        icon={IdCard}
        tone="primary"
        loading={loading.members || (canReports && loading.open)}
        footer={operation.footer}
      />
      <KpiCard
        label={<span className="tracking-wider uppercase">Invitaciones pendientes</span>}
        value={invites.length}
        icon={MailPlus}
        tone="tertiary"
        loading={loading.invites}
        footer={
          <FooterRow
            tone={invites.length ? 'muted' : 'primary'}
            left={invites.length ? 'Esperando que acepten' : 'Todo al día'}
            right={oldest ? `Más antigua ${formatRelative(oldest.createdAt)}` : undefined}
          />
        }
      />
      <KpiCard
        label={<span className="tracking-wider uppercase">Auditoría de cajas</span>}
        value={<span className={auditTone === 'error' ? 'text-error' : undefined}>{auditValue}</span>}
        icon={ReceiptText}
        tone={auditTone}
        loading={loading.closed}
        footer={auditFooter}
      />
    </section>
  );
}
