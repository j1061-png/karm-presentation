"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, AlertCircle, Check, Eye, EyeOff } from "lucide-react";
import { BrandWordmark } from "@/components/brand/BrandLogo";

function ResetContent() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setHasSession(!!data.user));
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  const inputCls =
    "w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-[14px] outline-none focus:border-accent/60 transition-colors placeholder:text-text-tertiary";

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center justify-center mb-8">
          <BrandWordmark height={32} />
        </div>

        <div className="bg-surface border border-border rounded-2xl p-7 shadow-2xl shadow-black/40">
          {hasSession === null ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-text-tertiary" />
            </div>
          ) : !hasSession ? (
            <div className="text-center py-4">
              <AlertCircle size={22} className="text-danger mx-auto mb-3" />
              <div className="text-[14px] font-medium mb-1">Reset link invalid or expired</div>
              <p className="text-[12.5px] text-text-secondary mb-5">
                Request a new password reset email from the sign-in page.
              </p>
              <button
                onClick={() => router.push("/")}
                className="text-[13px] font-medium bg-accent text-accent-text rounded-xl px-5 py-2.5 hover:bg-accent-hover transition-colors cursor-pointer"
              >
                Back to sign in
              </button>
            </div>
          ) : done ? (
            <div className="text-center py-4">
              <div className="w-11 h-11 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-3">
                <Check size={20} className="text-success" />
              </div>
              <div className="text-[14px] font-medium mb-1">Password updated</div>
              <p className="text-[12.5px] text-text-secondary">Taking you to your dashboard...</p>
            </div>
          ) : (
            <>
              <h1 className="text-[18px] font-semibold tracking-tight mb-1">Set a new password</h1>
              <p className="text-[13px] text-text-secondary mb-6">
                Choose a strong password for your account.
              </p>
              <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password (min. 8 characters)"
                    autoComplete="new-password"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text cursor-pointer"
                    aria-label={show ? "Hide password" : "Show password"}
                  >
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <input
                  type={show ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className={inputCls}
                />
                {error && (
                  <div className="flex items-start gap-2 text-[12.5px] text-danger bg-danger/8 border border-danger/25 rounded-xl px-3.5 py-2.5">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 bg-accent text-accent-text font-medium text-[14px] px-4 py-3 rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-60 cursor-pointer mt-1"
                >
                  {busy && <Loader2 size={15} className="animate-spin" />}
                  Update password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ResetForm() {
  return (
    <Suspense>
      <ResetContent />
    </Suspense>
  );
}
