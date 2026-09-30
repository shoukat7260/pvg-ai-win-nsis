import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AuthGate } from "@/features/auth/AuthGate";
import { WorkspaceHome } from "@/features/workspace/WorkspaceHome";
import { MediaWorkspace } from "@/features/media/MediaWorkspace";
import { EditorWorkspace } from "@/features/editor";
import { ProjectsPage } from "@/features/projects/ProjectsPage";
import { LibraryPage } from "@/features/library/LibraryPage";
import { TemplatesPage } from "@/features/templates/TemplatesPage";
import { AiWorkspacePage } from "@/features/ai/AiWorkspacePage";
import {
  OnboardingPage,
  shouldShowOnboarding,
} from "@/features/onboarding/OnboardingPage";
import {
  SettingsShell,
  PreferencesSettings,
} from "@/features/settings/SettingsShell";
import { AccountSettings } from "@/features/settings/AccountSettings";
import { SecuritySettings } from "@/features/settings/SecuritySettings";
import { ConnectionsSettings } from "@/features/settings/ConnectionsSettings";
import { BillingSettings } from "@/features/settings/BillingSettings";
import { KeyboardShortcutsSettings } from "@/features/settings/KeyboardShortcutsSettings";
import { SplashScreen } from "@/screens/SplashScreen";
import { AboutDiagnosticsScreen } from "@/screens/AboutDiagnosticsScreen";

function AuthenticatedApp() {
  const location = useLocation();
  const isEditor = location.pathname.startsWith("/app/edit");
  const isOnboarding = location.pathname.startsWith("/app/onboarding");
  const [needOnboarding, setNeedOnboarding] = useState(false);

  useEffect(() => {
    setNeedOnboarding(shouldShowOnboarding());
  }, [location.pathname]);

  if (needOnboarding && !isOnboarding) {
    return (
      <AuthGate>
        <Navigate to="/app/onboarding" replace />
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      {isEditor || isOnboarding ? (
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
      <Route
        path="/login"
        element={
          <AuthGate>
            <Navigate to="/app/home" replace />
          </AuthGate>
        }
      />
      <Route path="/app" element={<AuthenticatedApp />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="home" element={<WorkspaceHome />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="ai" element={<AiWorkspacePage />} />
        <Route path="media" element={<MediaWorkspace />} />
        <Route path="edit" element={<EditorWorkspace />} />
        <Route path="settings" element={<SettingsShell />}>
          <Route index element={<Navigate to="account" replace />} />
          <Route path="account" element={<AccountSettings />} />
          <Route path="security" element={<SecuritySettings />} />
          <Route path="connections" element={<ConnectionsSettings />} />
          <Route path="billing" element={<BillingSettings />} />
          <Route path="preferences" element={<PreferencesSettings />} />
          <Route path="shortcuts" element={<KeyboardShortcutsSettings />} />
        </Route>
        <Route path="security" element={<Navigate to="/app/settings/security" replace />} />
        <Route path="about" element={<AboutDiagnosticsScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
