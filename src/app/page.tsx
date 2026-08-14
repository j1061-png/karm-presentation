"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { ThemeSchema, type Slide } from "@/lib/schema";
import {
  Sun, Sparkles, Loader2, AlertCircle, MailCheck, ArrowLeft, Eye, EyeOff,
} from "lucide-react";

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

/** Live interactive demo slide rendered with the real presentation engine. */
const DEMO_THEME = ThemeSchema.parse({
  colors: { accent: "#f5a623" },
});

const DEMO_SLIDE: Slide = {
  id: "demo",
  name: "Demo",
  transition: "fade",
  elements: [
    { id: "d0", type: "shape", x: 6, y: 21, w: 4, h: 1, z: 1, opacity: 1, rotation: 0, props: { shape: "line", fill: "#f5a623" } },
    { id: "d1", type: "heading", x: 6, y: 8, w: 70, h: 12, z: 2, opacity: 1, rotation: 0, props: { text: "Solar capacity growth", level: 2 }, animation: { type: "fade-up", delay: 0.1, duration: 0.6 } },
    { id: "d2", type: "stat", x: 6, y: 28, w: 27, h: 28, z: 2, opacity: 1, rotation: 0, props: { value: "142", suffix: "MW", label: "Installed capacity", trend: { direction: "up", value: "18%" }, countUp: true, icon: "zap" }, animation: { type: "fade-up", delay: 0.3, duration: 0.6 }, style: { fontSize: 38 } },
    { id: "d3", type: "stat", x: 6, y: 60, w: 27, h: 28, z: 2, opacity: 1, rotation: 0, props: { value: "36", suffix: "K", label: "Tons CO₂ avoided", trend: { direction: "up", value: "24%" }, countUp: true, icon: "leaf" }, animation: { type: "fade-up", delay: 0.45, duration: 0.6 }, style: { fontSize: 38 } },
    { id: "d4", type: "chart", x: 37, y: 28, w: 57, h: 60, z: 2, opacity: 1, rotation: 0, props: { chartType: "area", labels: ["2021", "2022", "2023", "2024", "2025", "2026"], series: [{ name: "Capacity (MW)", data: [24, 41, 63, 88, 116, 142], color: "#f5a623" }], stacked: false, showLegend: false, showGrid: true, valueSuffix: " MW" }, animation: { type: "fade-up", delay: 0.6, duration: 0.7 } },
  ],
};

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
      return setNotice("Password reset email sent. Check your inbox and follow the link.");
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
      return setNotice("Account created. Check your inbox and confirm your email to sign in.");
    }

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(null);
      return setError(
        error.message === "Invalid login credentials"
          ? "Wrong email or password."
          : error.message
      );
    }
    window.location.assign(next);
  }

  const inputCls =
    "w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-[14px] outline-none focus:border-accent/60 transition-colors placeholder:text-text-tertiary";

  return (
    <main className="min-h-screen bg-bg relative overflow-hidden">
      {/* Ambient background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(800px 500px at 75% -10%, rgba(245,166,35,0.10), transparent 60%), radial-gradient(700px 500px at -10% 100%, rgba(79,156,249,0.06), transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 75%)",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 lg:px-10 flex flex-col min-h-screen">
        {/* Nav */}
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-lg shadow-accent/25">
              <Sun size={17} className="text-accent-text" strokeWidth={2.5} />
            </div>
            <span className="font-semibold text-[15px] tracking-tight">
              present<span className="text-accent">@</span>karm
            </span>
          </div>
          <span className="text-[12px] text-text-tertiary hidden sm:block">
            KarmSolar&apos;s AI presentation studio
          </span>
        </header>

        {/* Hero */}
        <div className="flex-1 grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-16 items-center py-10">
          {/* Left: pitch + live demo */}
          <div className="animate-in-fade order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 text-[12px] text-text-secondary border border-border rounded-full px-3.5 py-1.5 mb-6 bg-surface/70 backdrop-blur-sm">
              <Sparkles size={12} className="text-accent" />
              AI-generated · fully interactive · instantly shareable
            </div>
            <h1 className="text-[40px] lg:text-[52px] font-semibold tracking-tight leading-[1.06] mb-5">
              Presentations that feel like{" "}
              <span className="text-accent">living websites</span>
            </h1>
            <p className="text-[16px] text-text-secondary leading-relaxed mb-8 max-w-lg">
              Describe what you want to present, drop in your files, and AI builds an interactive
              presentation with live charts, timelines and maps — ready to edit, present and share
              with a link.
            </p>

            {/* Live demo — rendered by the real engine */}
            <div className="relative max-w-[560px] group">
              <div className="absolute -inset-3 rounded-2xl bg-accent/8 blur-2xl opacity-70 group-hover:opacity-100 transition-opacity" />
              <div className="relative rounded-xl overflow-hidden ring-1 ring-border-strong shadow-2xl shadow-black/60">
                <div className="h-8 bg-surface-2 border-b border-border flex items-center gap-1.5 px-3.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f0554d]/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f5a623]/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#43c98a]/70" />
                  <span className="text-[10.5px] text-text-tertiary ml-2 font-mono">
                    /p/solar-growth — live
                  </span>
                </div>
                <SlideRenderer slide={DEMO_SLIDE} theme={DEMO_THEME} mode="live" animateKey="demo" />
              </div>
              <div className="text-[11.5px] text-text-tertiary mt-3 text-center">
                ↑ This is a real slide — hover the chart, watch the numbers count.
              </div>
            </div>
          </div>

          {/* Right: auth card */}
          <div className="order-1 lg:order-2 w-full max-w-[400px] mx-auto lg:mx-0 animate-in-fade">
            <div className="bg-surface/80 backdrop-blur-xl border border-border rounded-2xl p-7 shadow-2xl shadow-black/40">
              {view === "forgot" ? (
                <>
                  <button
                    onClick={() => {
                      setView("signin");
                      resetFeedback();
                    }}
                    className="flex items-center gap-1.5 text-[12.5px] text-text-secondary hover:text-text transition-colors cursor-pointer mb-4"
                  >
                    <ArrowLeft size={13} /> Back to sign in
                  </button>
                  <h2 className="text-[19px] font-semibold tracking-tight mb-1">Reset your password</h2>
                  <p className="text-[13px] text-text-secondary mb-6">
                    We&apos;ll email you a secure link to set a new password.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-[19px] font-semibold tracking-tight mb-1">
                    {view === "signin" ? "Welcome back" : "Create your account"}
                  </h2>
                  <p className="text-[13px] text-text-secondary mb-6">
                    {view === "signin"
                      ? "Sign in to your presentations."
                      : "Start building interactive presentations in minutes."}
                  </p>

                  <button
                    onClick={() => void signInWithGoogle()}
                    disabled={busy !== null}
                    className="w-full flex items-center justify-center gap-2.5 bg-white text-[#1a1a1a] font-medium text-[14px] px-4 py-3 rounded-xl hover:bg-white/90 transition-all disabled:opacity-60 cursor-pointer"
                  >
                    {busy === "google" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <GoogleIcon />
                    )}
                    Continue with Google
                  </button>

                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[11px] text-text-tertiary uppercase tracking-wider">or</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                </>
              )}

              <form onSubmit={(e) => void submitEmail(e)} className="flex flex-col gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Work email"
                  autoComplete="email"
                  className={inputCls}
                />
                {view !== "forgot" && (
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={view === "signup" ? "Password (min. 8 characters)" : "Password"}
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
                    className="self-end text-[12px] text-text-secondary hover:text-accent transition-colors cursor-pointer -mt-1"
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
                  className="w-full flex items-center justify-center gap-2 bg-accent text-accent-text font-medium text-[14px] px-4 py-3 rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-60 cursor-pointer mt-1"
                >
                  {busy === "email" && <Loader2 size={15} className="animate-spin" />}
                  {view === "signin" ? "Sign in" : view === "signup" ? "Create account" : "Send reset link"}
                </button>
              </form>

              {view !== "forgot" && (
                <p className="text-[12.5px] text-text-secondary text-center mt-5">
                  {view === "signin" ? "New to present@karm? " : "Already have an account? "}
                  <button
                    onClick={() => {
                      setView(view === "signin" ? "signup" : "signin");
                      resetFeedback();
                    }}
                    className="text-accent hover:underline cursor-pointer font-medium"
                  >
                    {view === "signin" ? "Create an account" : "Sign in"}
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>

        <footer className="text-center text-[11.5px] text-text-tertiary py-6">
          present@karm — built for KarmSolar
        </footer>
      </div>
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
