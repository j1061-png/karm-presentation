"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sun, Sparkles, MousePointerClick, BarChart3 } from "lucide-react";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const authError = searchParams.get("error") === "auth";

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const next = searchParams.get("next") ?? "/dashboard";
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <main className="min-h-screen flex flex-col bg-bg">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-5 max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Sun size={18} className="text-accent-text" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-[15px] tracking-tight">
            present<span className="text-accent">@</span>karm
          </span>
        </div>
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        <div className="text-center max-w-2xl animate-in-fade">
          <div className="inline-flex items-center gap-2 text-xs text-text-secondary border border-border rounded-full px-3.5 py-1.5 mb-8 bg-surface">
            <Sparkles size={13} className="text-accent" />
            AI presentation studio for KarmSolar
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05] mb-6">
            Presentations that feel
            <br />
            like <span className="text-accent">living websites</span>
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed mb-10 max-w-xl mx-auto">
            Describe what you want to present, drop in your source material, and let AI build an
            interactive presentation you can edit visually and launch instantly.
          </p>

          <button
            onClick={signIn}
            disabled={loading}
            className="inline-flex items-center gap-3 bg-text text-bg font-medium px-6 py-3.5 rounded-xl hover:bg-white transition-colors disabled:opacity-60 shadow-lg shadow-black/30"
          >
            {loading ? (
              <span
                className="w-[18px] h-[18px] border-2 border-bg/30 border-t-bg rounded-full"
                style={{ animation: "spin 0.8s linear infinite" }}
              />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          {authError && (
            <p className="mt-4 text-sm text-danger">Sign-in failed. Please try again.</p>
          )}
        </div>

        {/* Feature row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-20 max-w-3xl w-full">
          {[
            { icon: Sparkles, title: "AI generation", desc: "DeepSeek plans and designs every slide from your prompt and files." },
            { icon: MousePointerClick, title: "Visual editing", desc: "Drag, resize and restyle anything. Ask AI to change whatever you want." },
            { icon: BarChart3, title: "Truly interactive", desc: "Live charts, timelines, maps, tabs and quizzes — not static slides." },
          ].map((f) => (
            <div
              key={f.title}
              className="border border-border bg-surface rounded-xl p-5 text-left hover:border-border-strong transition-colors"
            >
              <f.icon size={18} className="text-accent mb-3" />
              <div className="text-sm font-medium mb-1">{f.title}</div>
              <div className="text-[13px] text-text-secondary leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <footer className="text-center text-xs text-text-tertiary pb-6">
        present@karm — built for KarmSolar
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
