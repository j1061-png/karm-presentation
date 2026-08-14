"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { Bell, Check, Loader2, UserPlus, X } from "lucide-react";

function timeAgo(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function NotificationsBell({ onChanged }: { onChanged?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<api.AppNotification[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await api.listNotifications());
    } catch {
      setItems((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 20000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const unread = items?.filter((n) => !n.read).length ?? 0;

  async function respond(id: string, action: "accept" | "decline") {
    setBusy(id);
    const note = items?.find((n) => n.id === id);
    try {
      setItems(await api.respondToInvite(id, action));
      onChanged?.();
      if (action === "accept" && note) {
        router.push(`/editor/${note.presentationId}`);
      }
    } catch {
      /* keep panel open */
    } finally {
      setBusy(null);
    }
  }

  async function markAllRead() {
    try {
      setItems(await api.markNotificationsRead());
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-accent text-accent-text text-[9px] font-semibold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-50 w-[340px] bg-surface border border-border rounded-xl overflow-hidden animate-rise"
          style={{ boxShadow: "0 12px 32px var(--shadow-color)" }}
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
            <div className="text-[13px] font-semibold">Notifications</div>
            {unread > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="text-[11.5px] text-text-tertiary hover:text-text cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {items === null ? (
              <div className="flex items-center justify-center py-10 text-text-tertiary">
                <Loader2 size={16} className="animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center text-[13px] text-text-tertiary">
                No notifications yet.
                <div className="mt-1 text-[12px]">
                  Invites to collaborate will show up here.
                </div>
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`px-3.5 py-3 border-b border-border last:border-0 ${
                    n.read ? "" : "bg-accent/[0.04]"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-surface-2 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <UserPlus size={13} className="text-text-secondary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] leading-snug">
                        {n.type === "invite" && (
                          <>
                            <span className="font-medium">{n.from.name}</span> invited you to{" "}
                            <span className="font-medium">{n.presentationTitle}</span>
                          </>
                        )}
                        {n.type === "invite-accepted" && (
                          <>
                            <span className="font-medium">{n.from.name}</span> accepted your invite
                            to {n.presentationTitle}
                          </>
                        )}
                        {n.type === "invite-declined" && (
                          <>
                            <span className="font-medium">{n.from.name}</span> declined your invite
                            to {n.presentationTitle}
                          </>
                        )}
                      </div>
                      <div className="text-[11px] text-text-tertiary mt-0.5">{timeAgo(n.createdAt)}</div>

                      {n.type === "invite" && (n.inviteStatus ?? "pending") === "pending" && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <button
                            disabled={busy === n.id}
                            onClick={() => void respond(n.id, "accept")}
                            className="flex items-center gap-1 text-[12px] font-medium bg-accent text-accent-text rounded-md px-2.5 py-1 hover:bg-accent-hover cursor-pointer disabled:opacity-60"
                          >
                            {busy === n.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                            Accept
                          </button>
                          <button
                            disabled={busy === n.id}
                            onClick={() => void respond(n.id, "decline")}
                            className="flex items-center gap-1 text-[12px] font-medium border border-border rounded-md px-2.5 py-1 hover:bg-surface-2 cursor-pointer disabled:opacity-60"
                          >
                            <X size={11} />
                            Decline
                          </button>
                        </div>
                      )}
                      {n.type === "invite" && n.inviteStatus === "accepted" && (
                        <div className="text-[11.5px] text-success mt-1.5">Accepted</div>
                      )}
                      {n.type === "invite" && n.inviteStatus === "declined" && (
                        <div className="text-[11.5px] text-text-tertiary mt-1.5">Declined</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
