import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/app/layout/AppLayout";
import { AuthLayout } from "@/app/layout/AuthLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy-loaded pages
const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"));
const DashboardPage = lazy(() => import("@/features/dashboard/pages/DashboardPage"));
const OperationsListPage = lazy(() => import("@/features/operations/pages/OperationsListPage"));
const OperationFormPage = lazy(() => import("@/features/operations/pages/OperationFormPage"));
const OperationDetailPage = lazy(() => import("@/features/operations/pages/OperationDetailPage"));
const ParticipantsListPage = lazy(() => import("@/features/participants/pages/ParticipantsListPage"));
const ParticipantFormPage = lazy(() => import("@/features/participants/pages/ParticipantFormPage"));
const ParticipantDetailPage = lazy(() => import("@/features/participants/pages/ParticipantDetailPage"));
const CommissionRulesPage = lazy(() => import("@/features/commission-rules/pages/CommissionRulesPage"));
const CommissionRuleFormPage = lazy(() => import("@/features/commission-rules/pages/CommissionRuleFormPage"));
const PaymentsPage = lazy(() => import("@/features/payments/pages/PaymentsPage"));
const SimulationPage = lazy(() => import("@/features/simulation/pages/SimulationPage"));
const SettingsPage = lazy(() => import("@/features/settings/pages/SettingsPage"));

function PageLoader() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="mt-4 h-64 w-full rounded-xl" />
    </div>
  );
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Auth routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Protected app routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />

              <Route path="operations">
                <Route index element={<OperationsListPage />} />
                <Route path="new" element={<OperationFormPage />} />
                <Route path=":id" element={<OperationDetailPage />} />
                <Route path=":id/edit" element={<OperationFormPage />} />
              </Route>

              <Route path="participants">
                <Route index element={<ParticipantsListPage />} />
                <Route path="new" element={<ParticipantFormPage />} />
                <Route path=":id" element={<ParticipantDetailPage />} />
                <Route path=":id/edit" element={<ParticipantFormPage />} />
              </Route>

              <Route path="commission-rules">
                <Route index element={<CommissionRulesPage />} />
                <Route path="new" element={<CommissionRuleFormPage />} />
                <Route path=":id/edit" element={<CommissionRuleFormPage />} />
              </Route>

              <Route path="payments" element={<PaymentsPage />} />
              <Route path="simulation" element={<SimulationPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
