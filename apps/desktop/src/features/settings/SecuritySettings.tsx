import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getApiClient } from "@/auth/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { scorePasswordStrength } from "@pvg/schemas";

export function SecuritySettings() {
  const qc = useQueryClient();
  const mfaQuery = useQuery({
    queryKey: ["mfa-status"],
    queryFn: () => getApiClient().getMfaStatus(),
    retry: false,
  });
  const devicesQuery = useQuery({
    queryKey: ["devices"],
    queryFn: () => getApiClient().listDevices(),
    retry: false,
  });
  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: () => getApiClient().listSessions(),
    retry: false,
  });
  const activityQuery = useQuery({
    queryKey: ["security-activity"],
    queryFn: () => getApiClient().listSecurityActivity(),
    retry: false,
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [enableSecret, setEnableSecret] = useState<string | null>(null);

  const strength = scorePasswordStrength(newPassword);

  async function changePassword() {
    setMessage(null);
    try {
      await getApiClient().changePassword({ currentPassword, newPassword });
      setMessage("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Password change failed");
    }
  }

  async function startEnableMfa() {
    setMessage(null);
    try {
      const start = await getApiClient().startMfaEnable();
      setEnableSecret(start.secret);
      setMessage("Confirm with a TOTP code to finish enabling 2FA.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not start 2FA");
    }
  }

  async function confirmEnableMfa() {
    try {
      const codes = await getApiClient().confirmMfaEnable({ code: totpCode });
      setRecoveryCodes(codes.codes);
      setEnableSecret(null);
      setMessage("2FA enabled. Store recovery codes now — they are shown once.");
      void qc.invalidateQueries({ queryKey: ["mfa-status"] });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "2FA confirm failed");
    }
  }

  async function disableMfa() {
    try {
      await getApiClient().disableMfa({ password: currentPassword, code: totpCode });
      setMessage("2FA disabled.");
      void qc.invalidateQueries({ queryKey: ["mfa-status"] });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Disable failed");
    }
  }

  return (
    <div className="space-y-6" data-testid="settings-security">
      <GlassPanel className="space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold">Change password</h2>
        <label className="block text-xs text-charcoal-400">
          Current password
          <input
            type="password"
            autoComplete="current-password"
            className="mt-1 pvg-input pvg-input--light"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </label>
        <label className="block text-xs text-charcoal-400">
          New password
          <input
            type="password"
            autoComplete="new-password"
            className="mt-1 pvg-input pvg-input--light"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>
        <p className="text-xs text-charcoal-500">
          Strength (client advisory): {strength.label} — server is authoritative.
        </p>
        <Button onClick={() => void changePassword()}>Update password</Button>
      </GlassPanel>

      <GlassPanel className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-semibold">Two-factor authentication</h2>
          {mfaQuery.data?.enabled ? <Badge tone="accent">Enabled</Badge> : <Badge>Off</Badge>}
        </div>
        <p className="text-sm text-charcoal-400">
          Recovery codes remaining: {mfaQuery.data?.recoveryCodesRemaining ?? "—"}
        </p>
        {enableSecret ? (
          <p className="rounded-xl border border-white/10 bg-charcoal-900/80 p-3 font-mono text-xs break-all">
            Secret (once): {enableSecret}
          </p>
        ) : null}
        <label className="block text-xs text-charcoal-400">
          TOTP / step-up code
          <input
            className="mt-1 pvg-input pvg-input--light font-mono"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            autoComplete="one-time-code"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void startEnableMfa()}>
            Enable 2FA
          </Button>
          <Button onClick={() => void confirmEnableMfa()}>Confirm enable</Button>
          <Button variant="danger" onClick={() => void disableMfa()}>
            Disable 2FA
          </Button>
        </div>
        {recoveryCodes ? (
          <div className="rounded-xl border border-warn/30 bg-warn-mute p-4" data-testid="recovery-codes-once">
            <p className="text-sm font-medium text-warn">Recovery codes (shown once)</p>
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {recoveryCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </GlassPanel>

      <GlassPanel className="space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">Devices</h2>
        {devicesQuery.isError ? (
          <p className="text-sm text-charcoal-500">Devices unavailable (API may still be landing).</p>
        ) : null}
        <ul className="space-y-2">
          {(devicesQuery.data ?? []).map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm"
            >
              <span>
                {d.name} · {d.platform}
                {d.current ? " (this device)" : ""}
              </span>
              {!d.current ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void getApiClient()
                      .revokeDevice(d.id)
                      .then(() => qc.invalidateQueries({ queryKey: ["devices"] }))
                  }
                >
                  Revoke
                </Button>
              ) : null}
            </li>
          ))}
          {!devicesQuery.data?.length && !devicesQuery.isLoading ? (
            <p className="text-sm text-charcoal-500">No devices returned.</p>
          ) : null}
        </ul>
      </GlassPanel>

      <GlassPanel className="space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">Sessions</h2>
        <ul className="space-y-2">
          {(sessionsQuery.data ?? []).map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm"
            >
              <span>
                {s.deviceName ?? "Session"} · {s.status}
                {s.current ? " (current)" : ""}
              </span>
              {!s.current ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void getApiClient()
                      .revokeSession(s.id)
                      .then(() => qc.invalidateQueries({ queryKey: ["sessions"] }))
                  }
                >
                  Revoke
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <Button
          variant="secondary"
          onClick={() =>
            void getApiClient()
              .revokeOtherSessions()
              .then(() => qc.invalidateQueries({ queryKey: ["sessions"] }))
          }
        >
          Revoke other sessions
        </Button>
      </GlassPanel>

      <GlassPanel className="space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">Security activity</h2>
        <ul className="space-y-2 text-sm text-charcoal-300">
          {(activityQuery.data ?? []).map((a) => (
            <li key={a.id} className="border-b border-white/5 py-2">
              <p>{a.summary}</p>
              <p className="text-xs text-charcoal-500">{a.createdAt}</p>
            </li>
          ))}
          {!activityQuery.data?.length ? (
            <p className="text-charcoal-500">No recent activity.</p>
          ) : null}
        </ul>
      </GlassPanel>

      {message ? <p className="text-sm text-charcoal-300">{message}</p> : null}
    </div>
  );
}
