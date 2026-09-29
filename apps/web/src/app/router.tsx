import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout, PublicLayout } from "@/layouts/Layouts";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { HomePage } from "@/pages/HomePage";
import { PricingPage } from "@/pages/PricingPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { ForgotPasswordPage, ResetPasswordPage } from "@/pages/ForgotResetPages";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";
import { DashboardPage } from "@/pages/DashboardPage";
import {
  SettingsAccountPage,
  SettingsBillingPage,
  SettingsConnectionsPage,
  SettingsDevicesPage,
  SettingsSecurityPage,
} from "@/pages/SettingsPages";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsAccountPage />} />
          <Route path="/settings/security" element={<SettingsSecurityPage />} />
          <Route path="/settings/devices" element={<SettingsDevicesPage />} />
          <Route path="/settings/connections" element={<SettingsConnectionsPage />} />
          <Route path="/settings/billing" element={<SettingsBillingPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
