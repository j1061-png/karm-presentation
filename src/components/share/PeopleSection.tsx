"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { Loader2, UserPlus, X } from "lucide-react";

export function PeopleSection({
  presentationId,
  isOwner,
}: {
  presentationId: string;
  isOwner: boolean;
}) {
  const [data, setData] = useState<api.CollaboratorsPayload | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.getCollaborators(presentationId).then(setData).catch(() => setData(null));
  }, [presentationId]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      setData(await api.inviteCollaborator(presentationId, email.trim()));
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invite");
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string) {
    try {
      await api.removeCollaborator(presentationId, userId);
      setData((prev) =>
        prev ? { ...prev, collaborators: prev.collaborators.filter((c) => c.userId !== userId) } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove collaborator");
    }
  }

  return (
    <div className="border border-border rounded-xl p-3.5">
      <div className="text-[12px] font-medium mb-2.5">People</div>
      {isOwner && (
        <form onSubmit={(e) => void invite(e)} className="flex gap-2 mb-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Add by email"
            className="flex-1 min-w-0 bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:border-border-strong placeholder:text-text-tertiary"
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="flex items-center gap-1.5 text-[12.5px] font-medium bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface-3 cursor-pointer disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
            Invite
          </button>
        </form>
      )}
      {error && <div className="text-[12px] text-danger mb-2">{error}</div>}
      <div className="flex flex-col gap-1.5">
        {data && (
          <div className="flex items-center justify-between text-[12.5px] py-1">
            <div className="min-w-0">
              <div className="font-medium truncate">{data.owner.name}</div>
              <div className="text-[11.5px] text-text-tertiary truncate">{data.owner.email}</div>
            </div>
            <span className="text-[11px] text-text-tertiary flex-shrink-0">Owner</span>
          </div>
        )}
        {data?.collaborators.map((c) => (
          <div key={c.userId} className="flex items-center justify-between text-[12.5px] py-1 gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{c.name}</div>
              <div className="text-[11.5px] text-text-tertiary truncate">{c.email}</div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[11px] text-text-tertiary capitalize">{c.status}</span>
              {isOwner && (
                <button
                  onClick={() => void remove(c.userId)}
                  className="p-1 rounded-md text-text-tertiary hover:text-danger hover:bg-danger/10 cursor-pointer"
                  aria-label={`Remove ${c.name}`}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
        {data && data.collaborators.length === 0 && (
          <div className="text-[12px] text-text-tertiary">
            {isOwner ? "Invite a teammate who already has an account." : "Only you and the owner so far."}
          </div>
        )}
      </div>
    </div>
  );
}
