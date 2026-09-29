import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/auth/authStore";
import { useState, type FormEvent } from "react";
import type { MfaMethodKind } from "@pvg/types";

export function MfaChallengeScreen() {
  const submitMfa = useAuthStore((s) => s.submitMfa);
  const methods = useAuthStore((s) => s.mfaMethods);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const setView = useAuthStore((s) => s.setView);
  const [method, setMethod] = useState<MfaMethodKind>(
    methods.includes("totp") ? "totp" : "recovery_code",
  );
  const [code, setCode] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    await submitMfa(method, code);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal-950 px-6">
      <GlassPanel className="w-full max-w-md p-8 animate-fade-rise" data-testid="mfa-challenge">
        <p className="font-display text-xl font-semibold">Two-factor authentication</p>
        <p className="mt-2 text-sm text-charcoal-400">
          Enter a code from your authenticator app or a recovery code. Paste is allowed.
        </p>

        <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <fieldset className="flex gap-3 text-sm">
            <legend className="sr-only">Verification method</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mfa-method"
                checked={method === "totp"}
                onChange={() => setMethod("totp")}
              />
              Authenticator (TOTP)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mfa-method"
                checked={method === "recovery_code"}
                onChange={() => setMethod("recovery_code")}
              />
              Recovery code
            </label>
          </fieldset>

          <label className="block text-xs text-charcoal-400">
            {method === "totp" ? "6-digit code" : "Recovery code"}
            <input
              name="mfa-code"
              autoComplete="one-time-code"
              inputMode={method === "totp" ? "numeric" : "text"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text) {
                  e.preventDefault();
                  setCode(text.trim());
                }
              }}
              className="mt-1 w-full rounded-xl border border-white/10 bg-charcoal-900 px-3 py-2.5 font-mono text-sm"
              data-testid="mfa-code"
              required
            />
          </label>

          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" data-testid="mfa-submit">
            Verify
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setView("login")}
          >
            Back
          </Button>
        </form>
      </GlassPanel>
    </div>
  );
}
