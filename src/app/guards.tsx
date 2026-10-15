import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { Building2, LogOut, ShieldOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { PERMISSION_LABELS } from '@/config/app';
import type { Permission } from '@/types';
import { Button, EmptyState, MenuItem, PageLoader } from '@/components/ui';
import { Logo } from '@/components/layout/Logo';

/** Solo para usuarios con sesión iniciada. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Login/registro: si ya hay sesión, va al panel. */
export function PublicOnly() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Exige un negocio activo y membresía vigente. */
export function RequireBusiness() {
  const { status } = useBusiness();
  if (status === 'loading') return <FullScreenLoader label="Cargando tu negocio…" />;
  if (status === 'none') return <Navigate to="/bienvenida" replace />;
  if (status === 'no-access') return <NoAccess />;
  return <Outlet />;
}

export function RequirePermission({ perm, children }: { perm: Permission; children: ReactNode }) {
  const { can } = useBusiness();
  if (!can(perm)) {
    return (
      <EmptyState
        className="min-h-[60vh]"
        icon={ShieldOff}
        title="No tienes acceso a esta sección"
        description={`Necesitas el permiso “${PERMISSION_LABELS[perm].label}”. Pídeselo al administrador del negocio.`}
      />
    );
  }
  return <>{children}</>;
}

function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6">
      <Logo />
      <PageLoader label={label} />
    </div>
  );
}

function NoAccess() {
  const { businesses, businessId, switchBusiness } = useBusiness();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const others = businesses.filter((b) => b.id !== businessId);
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <Logo />
        <EmptyState
          className="py-2"
          icon={ShieldOff}
          title="Tu acceso a este negocio no está activo"
          description="El administrador pudo haberte dado de baja o suspendido. Si crees que es un error, contáctalo."
        />
        {others.length > 0 && (
          <div className="flex w-full flex-col gap-1 text-left">
            <p className="px-3 text-label-sm text-slate-500 uppercase">Cambiar a otro negocio</p>
            {others.map((b) => (
              <MenuItem key={b.id} icon={Building2} onClick={() => switchBusiness(b.id)}>
                {b.name}
              </MenuItem>
            ))}
          </div>
        )}
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button variant="secondary" fullWidth onClick={() => navigate('/bienvenida?nuevo=1')}>
            Crear un negocio
          </Button>
          <Button variant="ghost" fullWidth icon={LogOut} onClick={() => signOut()}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
