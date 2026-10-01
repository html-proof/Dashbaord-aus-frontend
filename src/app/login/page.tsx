"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  authErrorMessage,
  completeRedirectSignIn,
  sendResetLink,
  signInWithEmail,
  signInWithProvider,
  signUpWithEmail,
  type ProviderId,
} from "@/lib/firebase-client";

const PROVIDERS: { id: ProviderId; label: string; icon: React.ReactNode }[] = [
  {
    id: "google",
    label: "Continue with Google",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.3 6.6 2.3 12s4.3 9.8 9.7 9.8c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
      </svg>
    ),
  },
  {
    id: "apple",
    label: "Continue with Apple",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
        <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.5 1.3-.1 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.5 1-1.4 1.3-2.8 1.4-2.8-.1 0-2.6-1-2.7-4.1zM13.9 5c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z" />
      </svg>
    ),
  },
];

type View = "signin" | "signup" | "reset";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/resume";
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    params.get("verified")
      ? "Email verified. You can sign in now."
      : params.get("reset")
        ? "Password updated. Sign in with your new password."
        : null,
  );
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const goTo = useCallback(
    (path: string) => {
      router.replace(path.startsWith("/") ? path : "/dashboards");
      router.refresh();
    },
    [router],
  );

  // Finish an Apple/Google sign-in that fell back to a full-page redirect.
  useEffect(() => {
    completeRedirectSignIn()
      .then((done) => done && goTo(next))
      .catch((e) => setError(authErrorMessage(e)));
  }, [goTo, next]);

  function switchView(v: View) {
    setView(v);
    setError(null);
    setNotice(null);
    setPassword("");
    setConfirm("");
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const title = view === "signin" ? "Sign in" : view === "signup" ? "Create your account" : "Reset your password";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="card w-full max-w-sm p-6">
        <p className="text-sm font-semibold text-accent">Storeboard</p>
        <h1 className="mt-1 text-xl font-semibold">{title}</h1>

        {view !== "reset" && (
          <>
            <div className="mt-6 space-y-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  className="btn w-full"
                  disabled={!!busy}
                  onClick={() =>
                    run(p.id, async () => {
                      await signInWithProvider(p.id);
                      goTo(next);
                    })
                  }
                >
                  {p.icon}
                  {busy === p.id ? "Signing in…" : p.label}
                </button>
              ))}
            </div>
            <div className="my-5 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        {view === "signin" && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run("email", async () => {
                await signInWithEmail(email, password);
                goTo(next);
              });
            }}
          >
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" className="input" type="email" autoComplete="off" required
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="password">Password</label>
                <button type="button" className="mb-1 text-xs font-medium text-accent" onClick={() => switchView("reset")}>
                  Forgot password?
                </button>
              </div>
              <input id="password" className="input" type="password" required autoComplete="new-password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary w-full" disabled={!!busy}>
              {busy === "email" ? "Please wait…" : "Sign in with email"}
            </button>
          </form>
        )}

        {view === "signup" && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (password !== confirm) return setError("Passwords don't match.");
              run("email", async () => {
                await signUpWithEmail(email, password);
                switchView("signin");
                setNotice(`We sent a verification link to ${email}. Click it, then sign in here.`);
              });
            }}
          >
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" className="input" type="email" autoComplete="off" required
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" className="input" type="password" required minLength={8}
                autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="confirm">Confirm password</label>
              <input id="confirm" className="input" type="password" required minLength={8}
                autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <button className="btn btn-primary w-full" disabled={!!busy}>
              {busy === "email" ? "Please wait…" : "Create account"}
            </button>
          </form>
        )}

        {view === "reset" && (
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run("email", async () => {
                await sendResetLink(email);
                setNotice(`If an account exists for ${email}, a reset link is on its way. Check your inbox and spam folder.`);
              });
            }}
          >
            <p className="text-sm text-muted">Enter your account email and we&apos;ll send you a link to set a new password.</p>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" className="input" type="email" autoComplete="off" required
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn btn-primary w-full" disabled={!!busy}>
              {busy === "email" ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        {notice && <p className="mt-4 text-sm text-positive" role="status">{notice}</p>}
        {error && <p className="mt-4 text-sm text-negative" role="alert">{error}</p>}

        <p className="mt-5 text-center text-sm text-muted">
          {view === "signin" ? "New here? " : view === "signup" ? "Already have an account? " : "Remembered it? "}
          <button className="font-medium text-accent" onClick={() => switchView(view === "signin" ? "signup" : "signin")}>
            {view === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
