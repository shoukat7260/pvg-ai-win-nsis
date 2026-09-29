import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { PvgInput } from "@/components/ui/PvgInput";
import { useAuthStore } from "@/auth/authStore";
import { getApiClient } from "@/auth/api";
import { useState } from "react";

export function AccountSettings() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile() {
    setBusy(true);
    setMessage(null);
    try {
      await getApiClient().updateMe({ displayName });
      setMessage("Profile update requested.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function requestDeactivate() {
    if (!password) {
      setMessage("Enter your password to request deactivation.");
      return;
    }
    setBusy(true);
    try {
      const res = await getApiClient().requestDeactivate({ password });
      setMessage(
        res.message ??
          "Deactivation request submitted. Your account will be disabled per policy — projects on this device are not deleted by logout.",
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function requestDelete() {
    if (!password) {
      setMessage("Enter your password to request deletion.");
      return;
    }
    setBusy(true);
    try {
      const res = await getApiClient().requestDelete({
        password,
        confirmation: "DELETE",
      });
      setMessage(
        res.message ??
          "Deletion request submitted. This is a careful account-closure request — it does not wipe local project files by itself.",
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="settings-account">
      <GlassPanel className="space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold">Profile</h2>
        <p className="text-sm text-charcoal-400">
          Signed in as <span className="text-charcoal-200">{user?.email}</span>
        </p>
        <label className="block text-xs text-charcoal-400">
          Display name
          <PvgInput
            surface="light"
            className="mt-1"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <Button disabled={busy} onClick={() => void saveProfile()}>
          Save profile
        </Button>
      </GlassPanel>

      <GlassPanel className="space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold">Account actions</h2>
        <p className="text-sm text-charcoal-400">
          Deactivate or delete are <strong className="font-medium text-charcoal-200">requests</strong>{" "}
          processed by the server. Logout never deletes projects.
        </p>
        <label className="block text-xs text-charcoal-400">
          Confirm with password
          <PvgInput
            surface="light"
            className="mt-1"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => void requestDeactivate()}>
            Request deactivation
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void requestDelete()}>
            Request account deletion
          </Button>
          <Button
            variant="ghost"
            onClick={() => void logout()}
            data-testid="logout-button"
          >
            Log out
          </Button>
        </div>
        {message ? <p className="text-sm text-charcoal-300">{message}</p> : null}
      </GlassPanel>
    </div>
  );
}
