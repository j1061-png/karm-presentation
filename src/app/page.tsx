"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sun, Loader2, AlertCircle, MailCheck, ArrowLeft, Eye, EyeOff } from "lucide-react";

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

type AuthView = "signin" | "signup" | "forgot";

function LoginContent() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<AuthView>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const next = searchParams.get("next") ?? "/dashboard";

  function resetFeedback() {
    setError(null);
    setNotice(null);
  }

  async function signInWithGoogle() {
    resetFeedback();
    setBusy("google");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(`Google sign-in failed: ${error.message}`);
      setBusy(null);
    }
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    if (!email.trim()) return setError("Enter your email address.");

    if (view === "forgot") {
      setBusy("email");
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
      });
      setBusy(null);
      if (error) return setError(error.message);
      return setNotice("Password reset email sent. Check your inbox.");
    }

    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy("email");

    if (view === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setBusy(null);
      if (error) return setError(error.message);
      if (data.session) {
        window.location.assign(next);
        return;
      }
      return setNotice("Account created. Confirm your email to sign in.");
    }

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(null);
      return setError(
        error.message === "Invalid login credentials" ? "Wrong email or password." : error.message
      );
    }
    window.location.assign(next);
  }

  const inputCls =
    "w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] outline-none focus:border-border-strong transition-colors placeholder:text-text-tertiary";

  return (
    <main className="min-h-screen bg-bg flex flex-col">
      {/* Top-left brand */}
      <header className="flex items-center px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] rounded-md bg-accent flex items-center justify-center">
            <Sun size={14} className="text-accent-text" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-[14px] tracking-tight">
            present<span className="text-accent">@</span>karm
          </span>
        </div>
      </header>

      {/* Centered auth */}
      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-[352px] animate-rise">
          {view === "forgot" ? (
            <>
              <button
                onClick={() => {
                  setView("signin");
                  resetFeedback();
                }}
                className="flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text transition-colors cursor-pointer mb-5"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <h1 className="text-[22px] font-semibold tracking-tight mb-1.5">Reset your password</h1>
              <p className="text-[13.5px] text-text-secondary mb-7">
                We&apos;ll email you a link to set a new password.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-[22px] font-semibold tracking-tight mb-1.5 text-center">
                {view === "signin" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="text-[13.5px] text-text-secondary mb-7 text-center">
                {view === "signin"
                  ? "Sign in to continue to present@karm."
                  : "Build interactive presentations with AI."}
              </p>

              <button
                onClick={() => void signInWithGoogle()}
                disabled={busy !== null}
                className="w-full flex items-center justify-center gap-2.5 bg-surface border border-border text-[14px] font-medium px-4 py-2.5 rounded-xl hover:bg-surface-2 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {busy === "google" ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />}
                Continue with Google
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-text-tertiary uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </>
          )}

          <form onSubmit={(e) => void submitEmail(e)} className="flex flex-col gap-2.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
              className={inputCls}
            />
            {view !== "forgot" && (
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete={view === "signup" ? "new-password" : "current-password"}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            )}

            {view === "signin" && (
              <button
                type="button"
                onClick={() => {
                  setView("forgot");
                  resetFeedback();
                }}
                className="self-end text-[12.5px] text-text-secondary hover:text-text transition-colors cursor-pointer"
              >
                Forgot password?
              </button>
            )}

            {error && (
              <div className="flex items-start gap-2 text-[12.5px] text-danger bg-danger/8 border border-danger/25 rounded-xl px-3.5 py-2.5">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}
            {notice && (
              <div className="flex items-start gap-2 text-[12.5px] text-success bg-success/8 border border-success/25 rounded-xl px-3.5 py-2.5">
                <MailCheck size={14} className="mt-0.5 flex-shrink-0" />
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={busy !== null}
              className="w-full flex items-center justify-center gap-2 bg-accent text-accent-text font-medium text-[14px] px-4 py-2.5 rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-60 cursor-pointer mt-0.5"
            >
              {busy === "email" && <Loader2 size={15} className="animate-spin" />}
              {view === "signin" ? "Continue" : view === "signup" ? "Create account" : "Send reset link"}
            </button>
          </form>

          {view !== "forgot" && (
            <p className="text-[13px] text-text-secondary text-center mt-6">
              {view === "signin" ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => {
                  setView(view === "signin" ? "signup" : "signin");
                  resetFeedback();
                }}
                className="text-text font-medium hover:underline cursor-pointer"
              >
                {view === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>
          )}
        </div>
      </div>

      <footer className="text-center text-[11.5px] text-text-tertiary pb-5">
        AI-powered interactive presentations for KarmSolar
      </footer>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
