"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import * as api from "@/lib/api";
import { useTheme } from "@/components/theme/useTheme";
import { Eye, EyeOff, Layers, Loader2, LogOut, Moon, SunMedium, Trash2 } from "lucide-react";

export function SettingsPanel({
  user,
  presentationCount,
  onSignOut,
}: {
  user: { name: string; email: string; avatarUrl: string | null };
  presentationCount: number | string;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [canChangePassword, setCanChangePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        const providers = data.user?.identities?.map((i) => i.provider) ?? [];
        setCanChangePassword(providers.includes("email"));
      });
  }, []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    setPwError(null);
    if (password.length < 8) return setPwError("Password must be at least 8 characters.");
    if (password !== confirm) return setPwError("Passwords do not match.");
    setPwBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setPwBusy(false);
    if (error) return setPwError(error.message);
    setPassword("");
    setConfirm("");
    setPwMsg("Password updated.");
  }

  async function deleteAccount() {
    if (deleteConfirm !== user.email) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await api.deleteAccount();
      await createClient().auth.signOut();
      router.push("/");
      router.refresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete account");
      setDeleteBusy(false);
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto px-6 py-10">
      <h1 className="text-[17px] font-semibold tracking-tight mb-6">Settings</h1>

      <section className="border border-border rounded-xl divide-y divide-border bg-surface mb-4">
        <div className="flex items-center gap-3.5 px-4 py-3.5">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="w-9 h-9 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-surface-3 flex items-center justify-center text-[13px] font-semibold text-text-secondary">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium truncate">{user.name}</div>
            <div className="text-[12.5px] text-text-secondary truncate">{user.email}</div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3.5">
          <div>
            <div className="text-[13px] font-medium">Appearance</div>
            <div className="text-[12px] text-text-tertiary">Theme for the app interface</div>
          </div>
          <div className="flex items-center bg-surface-2 border border-border rounded-lg p-0.5">
            {(
              [
                { key: "light", icon: SunMedium, label: "Light" },
                { key: "dark", icon: Moon, label: "Dark" },
              ] as const
            ).map((o) => (
              <button
                key={o.key}
                onClick={() => setTheme(o.key)}
                className={`flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer ${
                  theme === o.key ? "bg-surface text-text font-medium shadow-sm" : "text-text-secondary"
                }`}
              >
                <o.icon size={12} />
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3.5">
          <div>
            <div className="text-[13px] font-medium">Presentations</div>
            <div className="text-[12px] text-text-tertiary">Stored privately in your workspace</div>
          </div>
          <div className="flex items-center gap-1.5 text-[13px] text-text-secondary">
            <Layers size={13} />
            {presentationCount}
          </div>
        </div>
      </section>

      {canChangePassword && (
        <section className="border border-border rounded-xl bg-surface mb-4 px-4 py-3.5">
          <div className="text-[13px] font-medium mb-0.5">Password</div>
          <div className="text-[12px] text-text-tertiary mb-3">Choose a new password for this account.</div>
          <form onSubmit={(e) => void changePassword(e)} className="flex flex-col gap-2">
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-border-strong pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary cursor-pointer"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <input
              type={showPw ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-border-strong"
            />
            {pwError && <div className="text-[12px] text-danger">{pwError}</div>}
            {pwMsg && <div className="text-[12px] text-success">{pwMsg}</div>}
            <button
              type="submit"
              disabled={pwBusy}
              className="self-start text-[13px] font-medium bg-surface-2 border border-border rounded-lg px-3 py-1.5 hover:bg-surface-3 cursor-pointer disabled:opacity-60"
            >
              {pwBusy ? <Loader2 size={13} className="animate-spin" /> : "Update password"}
            </button>
          </form>
        </section>
      )}

      <button
        onClick={onSignOut}
        className="flex items-center gap-2 text-[13px] text-text-secondary border border-border rounded-lg px-3.5 py-2 hover:bg-surface-2 transition-colors cursor-pointer mb-6"
      >
        <LogOut size={13} />
        Sign out
      </button>

      <section className="border border-danger/25 rounded-xl bg-surface px-4 py-3.5">
        <div className="text-[13px] font-medium text-danger mb-0.5">Delete account</div>
        <div className="text-[12px] text-text-tertiary mb-3">
          Permanently delete your account, presentations, and collaborator access. This cannot be undone.
        </div>
        {!deleteOpen ? (
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-1.5 text-[13px] text-danger border border-danger/30 rounded-lg px-3 py-1.5 hover:bg-danger/10 cursor-pointer"
          >
            <Trash2 size={13} />
            Delete account
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-[12px] text-text-secondary">
              Type <span className="font-medium text-text">{user.email}</span> to confirm.
            </div>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={user.email}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:border-danger"
            />
            {deleteError && <div className="text-[12px] text-danger">{deleteError}</div>}
            <div className="flex items-center gap-2">
              <button
                disabled={deleteBusy || deleteConfirm !== user.email}
                onClick={() => void deleteAccount()}
                className="flex items-center gap-1.5 text-[13px] font-medium bg-danger text-white rounded-lg px-3 py-1.5 hover:opacity-90 cursor-pointer disabled:opacity-40"
              >
                {deleteBusy && <Loader2 size={13} className="animate-spin" />}
                Delete forever
              </button>
              <button
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirm("");
                }}
                className="text-[13px] text-text-secondary hover:text-text cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
