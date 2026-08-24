"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import * as api from "@/lib/api";
import type { PresentationMeta } from "@/lib/schema";
import { Sidebar, type DashboardView } from "./Sidebar";
import { Composer } from "./Composer";
import { PresentationItem } from "./PresentationItem";
import { NotificationsBell } from "./NotificationsBell";
import { SettingsPanel } from "./SettingsPanel";
import {
  Search, Plus, Loader2, Presentation,
} from "lucide-react";

type SortKey = "updated" | "created" | "title";

export function DashboardShell({
  user,
}: {
  user: { name: string; email: string; avatarUrl: string | null };
}) {
  const router = useRouter();
  const [view, setView] = useState<DashboardView>("home");
  const [metas, setMetas] = useState<PresentationMeta[] | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [threadActive, setThreadActive] = useState(false);
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [chatEpoch, setChatEpoch] = useState(0);

  function openInChat(id: string) {
    setView("home");
    setOpenChatId(id);
    setChatEpoch((n) => n + 1);
  }

  const refresh = useCallback(async () => {
    try {
      setMetas(await api.listPresentations());
    } catch {
      setMetas([]);
      setToast("Could not load projects.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    if (!metas) return null;
    let list = metas;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (m) => m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "created") return +new Date(b.createdAt) - +new Date(a.createdAt);
      return +new Date(b.updatedAt) - +new Date(a.updatedAt);
    });
  }, [metas, query, sort]);

  async function handleNewBlank() {
    setBusy("new");
    try {
      const p = await api.createPresentation();
      router.push(`/editor/${p.id}`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to create presentation");
      setBusy(null);
    }
  }

  async function handleRename(id: string, title: string) {
    setMetas((prev) => prev?.map((m) => (m.id === id ? { ...m, title } : m)) ?? null);
    try {
      await api.renamePresentation(id, title);
    } catch {
      setToast("Rename failed");
      void refresh();
    }
  }

  async function handleDuplicate(id: string) {
    try {
      await api.duplicatePresentation(id);
      setToast("Presentation duplicated");
      void refresh();
    } catch {
      setToast("Duplicate failed");
    }
  }

  async function handleLeave(id: string) {
    const meta = metas?.find((m) => m.id === id);
    if (!confirm(`Leave “${meta?.title ?? "this project"}”? You will lose access until invited again.`)) return;
    setMetas((prev) => prev?.filter((m) => m.id !== id) ?? null);
    try {
      await api.leavePresentation(id);
      setToast("Left project");
    } catch {
      setToast("Could not leave project");
      void refresh();
    }
  }

  async function handleDelete(id: string) {
    const meta = metas?.find((m) => m.id === id);
    if (!confirm(`Delete “${meta?.title ?? "this project"}”? This cannot be undone.`)) return;
    setMetas((prev) => prev?.filter((m) => m.id !== id) ?? null);
    try {
      await api.deletePresentation(id);
    } catch {
      setToast("Delete failed");
      void refresh();
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const RECENT_LIMIT = 3;
  const recent =
    metas == null
      ? null
      : recentExpanded
        ? metas
        : metas.slice(0, RECENT_LIMIT);
  const canToggleRecent = (metas?.length ?? 0) > RECENT_LIMIT;
  const firstName = user.name.split(" ")[0];

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar
        view={view}
        onNavigate={setView}
        onNew={handleNewBlank}
        recents={metas}
        user={user}
        onSignOut={() => void signOut()}
        onOpenRecent={openInChat}
      />

      <main
        className={`flex-1 min-w-0 min-h-0 flex flex-col ${
          threadActive && view === "home" ? "overflow-hidden" : "overflow-y-auto"
        }`}
      >
        <div className="h-12 flex items-center justify-between px-5 flex-shrink-0 border-b border-border">
          <div className="text-[13px] font-medium text-text-secondary">
            {view === "home"
              ? threadActive
                ? ""
                : "Home"
              : view === "presentations"
                ? "Projects"
                : "Settings"}
          </div>
          <NotificationsBell onChanged={() => void refresh()} />
        </div>

        {/* -------------------------------------------------- home view */}
        {view === "home" && (
          <div
            className={`flex-1 flex flex-col ${
              threadActive ? "min-h-0" : "px-6 items-center justify-center py-12"
            }`}
          >
            <div className={`w-full ${threadActive ? "flex-1 min-h-0 flex flex-col" : "max-w-[680px]"}`}>
              {!threadActive && (
                <h1 className="font-serif text-[34px] tracking-tight text-center mb-7 animate-rise">
                  What can I do for you{firstName ? `, ${firstName}` : ""}?
                </h1>
              )}
              <Composer
                key={chatEpoch}
                continueId={openChatId}
                onThreadChange={setThreadActive}
                onCreated={() => void refresh()}
                onReset={() => setOpenChatId(null)}
              />

              {/* Compact recents */}
              {!threadActive && recent && recent.length > 0 && (
                <div className="mt-10 animate-rise">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <h2 className="text-[12px] font-medium text-text-tertiary uppercase tracking-wider">
                      Recent
                    </h2>
                    {canToggleRecent && (
                      <button
                        onClick={() => setRecentExpanded((v) => !v)}
                        className="text-[12px] text-text-tertiary hover:text-text transition-colors cursor-pointer"
                      >
                        {recentExpanded ? "Show less" : "View all"}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col bg-surface border border-border rounded-2xl p-1.5">
                    {recent.map((m) => (
                      <PresentationItem
                        key={m.id}
                        meta={m}
                        onOpen={openInChat}
                        onRename={handleRename}
                        onDuplicate={handleDuplicate}
                        onDelete={handleDelete}
                        onLeave={handleLeave}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------------------------------------- projects view */}
        {view === "presentations" && (
          <div className="w-full max-w-3xl mx-auto px-6 py-10">
            <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
              <h1 className="text-[17px] font-semibold tracking-tight">Projects</h1>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search"
                    className="bg-surface border border-border rounded-lg pl-9 pr-3 py-1.5 text-[13px] w-52 outline-none focus:border-border-strong transition-colors placeholder:text-text-tertiary"
                  />
                </div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-[13px] text-text-secondary outline-none cursor-pointer focus:border-border-strong"
                  aria-label="Sort"
                >
                  <option value="updated">Last edited</option>
                  <option value="created">Newest</option>
                  <option value="title">A–Z</option>
                </select>
                <button
                  onClick={handleNewBlank}
                  disabled={busy === "new"}
                  className="flex items-center gap-1.5 text-[13px] font-medium bg-accent text-accent-text rounded-lg px-3 py-1.5 hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-60"
                >
                  {busy === "new" ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  New
                </button>
              </div>
            </div>

            {filtered === null ? (
              <div className="flex flex-col gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3.5 px-3 py-2.5">
                    <div
                      className="w-[88px] aspect-video rounded-md bg-surface-2"
                      style={{
                        backgroundImage:
                          "linear-gradient(90deg, transparent, var(--surface-3), transparent)",
                        backgroundSize: "400px 100%",
                        animation: "shimmer 1.4s infinite linear",
                      }}
                    />
                    <div className="flex-1">
                      <div className="h-3.5 w-48 rounded bg-surface-2 mb-2" />
                      <div className="h-2.5 w-24 rounded bg-surface-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                  <Presentation size={20} className="text-text-tertiary" />
                </div>
                <div className="font-medium text-[14.5px] mb-1">
                  {query ? "No projects match your search" : "No projects yet"}
                </div>
                <div className="text-[13px] text-text-secondary mb-5 max-w-xs">
                  {query
                    ? "Try a different search term."
                    : "Create your first presentation, website, game, or app."}
                </div>
                {!query && (
                  <button
                    onClick={() => setView("home")}
                    className="flex items-center gap-1.5 text-[13px] font-medium bg-accent text-accent-text rounded-lg px-3.5 py-2 hover:bg-accent-hover transition-colors cursor-pointer"
                  >
                    <Plus size={13} /> Create project
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col bg-surface border border-border rounded-2xl p-1.5">
                {filtered.map((m) => (
                  <PresentationItem
                    key={m.id}
                    meta={m}
                    onOpen={openInChat}
                    onRename={handleRename}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                    onLeave={handleLeave}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* --------------------------------------------- settings view */}
        {view === "settings" && (
          <SettingsPanel
            user={user}
            presentationCount={metas?.length ?? "—"}
            onSignOut={() => void signOut()}
          />
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface border border-border rounded-xl px-4 py-2.5 text-[13px] animate-rise"
          style={{ boxShadow: "0 8px 24px var(--shadow-color)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
