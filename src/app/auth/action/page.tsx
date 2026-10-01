"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { applyEmailCode, authErrorMessage, checkResetCode, confirmReset } from "@/lib/firebase-client";

// Handles the links in Firebase's auth emails (set this page as the custom action URL
// in Firebase Console → Authentication → Templates), so users stay inside the app.
function EmailAction() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = params.get("mode");
  const code = params.get("oobCode") ?? "";
  const [state, setState] = useState<"checking" | "ready" | "done" | "error">("checking");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fail = (e: unknown) => {
      setError(authErrorMessage(e) ?? "This link is invalid.");
      setState("error");
    };
    if (mode === "resetPassword") {
      checkResetCode(code)
        .then((addr) => {
          setEmail(addr);
          setState("ready");
        })
        .catch(fail);
    } else if (mode === "verifyEmail") {
      applyEmailCode(code)
        .then(() => router.replace("/login?verified=1"))
        .catch(fail);
    } else {
      fail(new Error("This link is invalid or unsupported."));
    }
  }, [mode, code, router]);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="card w-full max-w-sm p-6">
        <p className="text-sm font-semibold text-accent">Storeboard</p>
        <h1 className="mt-1 text-xl font-semibold">
          {mode === "resetPassword" ? "Set a new password" : "Verify your email"}
        </h1>

        {state === "checking" && <p className="mt-4 text-sm text-muted">Checking your link…</p>}

        {state === "ready" && (
          <form
            className="mt-6 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (password !== confirm) return setError("Passwords don't match.");
              setBusy(true);
              setError(null);
              try {
                await confirmReset(code, password);
                router.replace("/login?reset=1");
              } catch (err) {
                setError(authErrorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-sm text-muted">For {email}</p>
            <div>
              <label className="label" htmlFor="password">New password</label>
              <input id="password" className="input" type="password" required minLength={8}
                autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="confirm">Confirm new password</label>
              <input id="confirm" className="input" type="password" required minLength={8}
                autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <button className="btn btn-primary w-full" disabled={busy}>
              {busy ? "Saving…" : "Update password"}
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-sm text-negative" role="alert">{error}</p>}
        {state === "error" && (
          <p className="mt-5 text-center text-sm">
            <Link className="font-medium text-accent" href="/login">Back to sign in</Link>
          </p>
        )}
      </div>
    </main>
  );
}

export default function EmailActionPage() {
  return (
    <Suspense>
      <EmailAction />
    </Suspense>
  );
}
