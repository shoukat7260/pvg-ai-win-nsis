import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@pvg/ui";
import { getApiClient } from "@/auth/api";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"loading" | "success" | "expired" | "invalid">(
    "loading",
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    void getApiClient()
      .verifyEmail({ token })
      .then((res) => {
        if (res.status === "verified") setState("success");
        else if (res.status === "expired") setState("expired");
        else setState("invalid");
        setMessage(res.message ?? null);
      })
      .catch(() => setState("invalid"));
  }, [token]);

  return (
    <section className="auth-split">
      <aside className="auth-split__brand">
        <p className="auth-split__meta">Email verification</p>
        <div>
          <h2>Confirm your address.</h2>
          <p>Verified accounts unlock the full cloud console experience.</p>
        </div>
        <p className="auth-split__meta">PVG AI</p>
      </aside>
      <div className="auth-split__form">
        <div className="auth-card" data-testid={`verify-email-${state}`}>
          {state === "loading" ? (
            <>
              <h1>Verifying email…</h1>
              <p className="auth-card__lead">Please wait.</p>
            </>
          ) : null}
          {state === "success" ? (
            <>
              <h1>Email verified</h1>
              <p className="auth-card__lead">{message ?? "Your email is confirmed."}</p>
              <Link to="/login">
                <Button className="mt-4 w-full">Sign in</Button>
              </Link>
            </>
          ) : null}
          {state === "expired" ? (
            <>
              <h1>Link expired</h1>
              <p className="auth-card__lead">
                {message ??
                  "This verification link is no longer valid. Request a new one from sign-in."}
              </p>
            </>
          ) : null}
          {state === "invalid" ? (
            <>
              <h1>Invalid link</h1>
              <p className="auth-card__lead">We could not verify this link.</p>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
