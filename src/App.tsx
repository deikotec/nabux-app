import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { BusinessProvider } from '@/contexts/BusinessContext';
import { CatalogProvider } from '@/contexts/CatalogContext';
import { CashProvider } from '@/contexts/CashContext';
import { ConfirmProvider, PageLoader, ToastProvider } from '@/components/ui';
import { AppLayout } from '@/components/layout/AppLayout';
import { PublicOnly, RequireAuth, RequireBusiness, RequirePermission } from '@/app/guards';
import { firebaseConfigMissing } from '@/lib/firebase';
import type { Permission } from '@/types';
import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage';
import OnboardingPage from '@/features/onboarding/OnboardingPage';
import { SetupRequired } from '@/app/SetupRequired';

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const PosPage = lazy(() => import('@/features/pos/PosPage'));
const InventoryPage = lazy(() => import('@/features/inventory/InventoryPage'));
const SalesPage = lazy(() => import('@/features/sales/SalesPage'));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
const StaffPage = lazy(() => import('@/features/staff/StaffPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));

function Page({ children, perm }: { children: ReactNode; perm?: Permission }) {
  const content = <Suspense fallback={<PageLoader />}>{children}</Suspense>;
  return perm ? <RequirePermission perm={perm}>{content}</RequirePermission> : content;
}

export default function App() {
  if (firebaseConfigMissing) return <SetupRequired />;

  return (
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <BusinessProvider>
              <CatalogProvider>
                <CashProvider>
                  <Routes>
                    <Route element={<PublicOnly />}>
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/registro" element={<RegisterPage />} />
                      <Route path="/recuperar" element={<ForgotPasswordPage />} />
                    </Route>

                    <Route element={<RequireAuth />}>
                      <Route path="/bienvenida" element={<OnboardingPage />} />
                      <Route element={<RequireBusiness />}>
                        <Route element={<AppLayout />}>
                          <Route index element={<Page><DashboardPage /></Page>} />
                          <Route path="pos" element={<Page perm="pos"><PosPage /></Page>} />
                          <Route path="inventario" element={<Page><InventoryPage /></Page>} />
                          <Route path="ventas" element={<Page><SalesPage /></Page>} />
                          <Route path="reportes" element={<Page perm="reports"><ReportsPage /></Page>} />
                          <Route path="personal" element={<Page perm="staff"><StaffPage /></Page>} />
                          <Route path="configuracion" element={<Page perm="settings"><SettingsPage /></Page>} />
                          <Route path="perfil" element={<Page><ProfilePage /></Page>} />
                        </Route>
                      </Route>
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </CashProvider>
              </CatalogProvider>
            </BusinessProvider>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
