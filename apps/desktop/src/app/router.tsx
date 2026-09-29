import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AuthGate } from "@/features/auth/AuthGate";
import { WorkspaceHome } from "@/features/workspace/WorkspaceHome";
import { MediaWorkspace } from "@/features/media/MediaWorkspace";
import { EditorWorkspace } from "@/features/editor";
import {
  SettingsShell,
  PreferencesSettings,
} from "@/features/settings/SettingsShell";
import { AccountSettings } from "@/features/settings/AccountSettings";
import { SecuritySettings } from "@/features/settings/SecuritySettings";
import { ConnectionsSettings } from "@/features/settings/ConnectionsSettings";
import { BillingSettings } from "@/features/settings/BillingSettings";
import { SplashScreen } from "@/screens/SplashScreen";
import { AboutDiagnosticsScreen } from "@/screens/AboutDiagnosticsScreen";

function AuthenticatedApp() {
  const location = useLocation();
  const isEditor = location.pathname.startsWith("/app/edit");

  return (
    <AuthGate>
      {isEditor ? (
        <Outlet />
      ) : (
        <AppShell>
          <Outlet />
        </AppShell>
      )}
    </AuthGate>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<SplashScreen />} />
      <Route path="/login" element={<AuthGate><Navigate to="/app/home" replace /></AuthGate>} />
      <Route path="/app" element={<AuthenticatedApp />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<WorkspaceHome />} />
        <Route path="media" element={<MediaWorkspace />} />
        <Route path="edit" element={<EditorWorkspace />} />
        <Route path="settings" element={<SettingsShell />}>
          <Route index element={<Navigate to="account" replace />} />
          <Route path="account" element={<AccountSettings />} />
          <Route path="security" element={<SecuritySettings />} />
          <Route path="connections" element={<ConnectionsSettings />} />
          <Route path="billing" element={<BillingSettings />} />
          <Route path="preferences" element={<PreferencesSettings />} />
        </Route>
        <Route path="security" element={<Navigate to="/app/settings/security" replace />} />
        <Route path="about" element={<AboutDiagnosticsScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
