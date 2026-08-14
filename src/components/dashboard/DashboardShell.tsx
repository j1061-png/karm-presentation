"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import * as api from "@/lib/api";
import type { PresentationMeta } from "@/lib/schema";
import { ThemeSchema } from "@/lib/schema";
import { TEMPLATES } from "@/lib/templates";
import { Sidebar, type DashboardView } from "./Sidebar";
import { Composer } from "./Composer";
import { PresentationCard } from "./PresentationCard";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import {
  Search, ArrowDownUp, Plus, Layers, LogOut, Loader2, LayoutTemplate, Presentation,
} from "lucide-react";

type SortKey = "updated" | "created" | "title";

export function DashboardShell({
  user,
}: {
  user: { name: string; email: string; avatarUrl: string | null };
}) {
  const router = useRouter();
  const [view, setView] = useState<DashboardView>("create");
  const [metas, setMetas] = useState<PresentationMeta[] | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setMetas(await api.listPresentations());
    } catch {
      setMetas([]);
      setToast("Could not load presentations.");
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

  async function handleTemplate(key: string) {
    const template = TEMPLATES.find((t) => t.key === key);
    if (!template) return;
    setBusy(key);
    try {
      const p = await api.createPresentation({ presentation: template.doc as never });
      router.push(`/editor/${p.id}`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to create from template");
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

  async function handleDelete(id: string) {
    const meta = metas?.find((m) => m.id === id);
    if (!confirm(`Delete “${meta?.title ?? "this presentation"}”? This cannot be undone.`)) return;
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

  const recent = metas?.slice(0, 6) ?? null;

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar view={view} onNavigate={setView} user={user} />

      <main className="flex-1 min-w-0">
        {/* ------------------------------------------------ create view */}
        {view === "create" && (
          <div className="flex flex-col items-center px-8 pt-[13vh] pb-16">
            <h1 className="text-[32px] font-semibold tracking-tight mb-2 text-center">
              What do you want to present?
            </h1>
            <p className="text-text-secondary text-[15px] mb-9 text-center">
              Describe it, drop in your files, and present@karm will build it.
            </p>
            <Composer />

            {/* Recent strip */}
            {recent && recent.length > 0 && (
              <div className="w-full max-w-4xl mt-16">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[13px] font-medium text-text-secondary uppercase tracking-wider">
                    Recent
                  </h2>
                  <button
                    onClick={() => setView("my")}
                    className="text-[13px] text-text-secondary hover:text-text transition-colors cursor-pointer"
                  >
                    View all →
                  </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {recent.map((m) => (
                    <PresentationCard
                      key={m.id}
                      meta={m}
                      onRename={handleRename}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------- my / recent view */}
        {(view === "my" || view === "recent") && (
          <div className="px-8 py-8 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight">
                {view === "my" ? "My Presentations" : "Recent"}
              </h1>
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search presentations..."
                    className="bg-surface border border-border rounded-lg pl-9 pr-3.5 py-2 text-[13px] w-60 outline-none focus:border-border-strong transition-colors placeholder:text-text-tertiary"
                  />
                </div>
                <button
                  onClick={() =>
                    setSort((s) => (s === "updated" ? "created" : s === "created" ? "title" : "updated"))
                  }
                  className="flex items-center gap-2 text-[13px] text-text-secondary border border-border rounded-lg px-3.5 py-2 hover:border-border-strong transition-colors cursor-pointer bg-surface"
                >
                  <ArrowDownUp size={13} />
                  {sort === "updated" ? "Last edited" : sort === "created" ? "Newest" : "A–Z"}
                </button>
                <button
                  onClick={handleNewBlank}
                  disabled={busy === "new"}
                  className="flex items-center gap-2 text-[13px] font-medium bg-accent text-accent-text rounded-lg px-3.5 py-2 hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-60"
                >
                  {busy === "new" ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
                  New
                </button>
              </div>
            </div>

            {filtered === null ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border overflow-hidden">
                    <div
                      className="aspect-video bg-surface"
                      style={{
                        backgroundImage: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
                        backgroundSize: "400px 100%",
                        animation: "shimmer 1.4s infinite linear",
                      }}
                    />
                    <div className="p-3.5">
                      <div className="h-3.5 w-2/3 rounded bg-surface-3 mb-2" />
                      <div className="h-2.5 w-1/3 rounded bg-surface-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 text-center">
                <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center mb-4">
                  <Presentation size={22} className="text-text-tertiary" />
                </div>
                <div className="font-medium text-[15px] mb-1">
                  {query ? "No presentations match your search" : "No presentations yet"}
                </div>
                <div className="text-[13.5px] text-text-secondary mb-6 max-w-xs">
                  {query
                    ? "Try a different search term."
                    : "Create your first presentation with AI, from a template, or from scratch."}
                </div>
                {!query && (
                  <button
                    onClick={() => setView("create")}
                    className="flex items-center gap-2 text-[13px] font-medium bg-accent text-accent-text rounded-lg px-4 py-2.5 hover:bg-accent-hover transition-colors cursor-pointer"
                  >
                    <Plus size={14} /> Create with AI
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {(view === "recent" ? filtered.slice(0, 9) : filtered).map((m) => (
                  <PresentationCard
                    key={m.id}
                    meta={m}
                    onRename={handleRename}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------- templates view */}
        {view === "templates" && (
          <div className="px-8 py-8 max-w-6xl mx-auto">
            <h1 className="text-xl font-semibold tracking-tight mb-1">Templates</h1>
            <p className="text-[13.5px] text-text-secondary mb-6">
              Start from a structure, then let AI fill it with your content.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {TEMPLATES.map((t) => {
                const theme = ThemeSchema.parse(t.doc.theme);
                return (
                  <button
                    key={t.key}
                    onClick={() => void handleTemplate(t.key)}
                    disabled={busy !== null}
                    className="group text-left bg-surface border border-border rounded-xl overflow-hidden hover:border-border-strong transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 cursor-pointer disabled:opacity-60"
                  >
                    <div className="relative pointer-events-none">
                      <SlideRenderer slide={t.doc.slides[0]} theme={theme} mode="thumb" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="text-[12.5px] font-medium bg-white text-black rounded-lg px-3.5 py-2 shadow-lg flex items-center gap-1.5">
                          {busy === t.key ? <Loader2 size={12} className="animate-spin" /> : <LayoutTemplate size={12} />}
                          Use template
                        </span>
                      </div>
                    </div>
                    <div className="px-3.5 py-3">
                      <div className="text-[13.5px] font-medium">{t.name}</div>
                      <div className="text-[12px] text-text-secondary mt-0.5 leading-relaxed">
                        {t.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* --------------------------------------------- settings view */}
        {view === "settings" && (
          <div className="px-8 py-8 max-w-2xl mx-auto">
            <h1 className="text-xl font-semibold tracking-tight mb-6">Settings</h1>

            <section className="bg-surface border border-border rounded-xl p-5 mb-4">
              <h2 className="text-[13px] font-medium text-text-secondary uppercase tracking-wider mb-4">
                Account
              </h2>
              <div className="flex items-center gap-3.5">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" className="w-11 h-11 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-surface-3 flex items-center justify-center text-[15px] font-semibold text-text-secondary">
                    {user.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-[14.5px] font-medium">{user.name}</div>
                  <div className="text-[13px] text-text-secondary">{user.email}</div>
                  <div className="text-[11.5px] text-text-tertiary mt-0.5">Signed in with Google</div>
                </div>
              </div>
            </section>

            <section className="bg-surface border border-border rounded-xl p-5 mb-4">
              <h2 className="text-[13px] font-medium text-text-secondary uppercase tracking-wider mb-3">
                Workspace
              </h2>
              <div className="flex items-center justify-between py-1.5">
                <div>
                  <div className="text-[13.5px] font-medium">Presentations</div>
                  <div className="text-[12.5px] text-text-secondary">Stored privately in your Supabase workspace</div>
                </div>
                <div className="flex items-center gap-1.5 text-[13px] text-text-secondary">
                  <Layers size={14} />
                  {metas?.length ?? "—"}
                </div>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <div>
                  <div className="text-[13.5px] font-medium">AI model</div>
                  <div className="text-[12.5px] text-text-secondary">DeepSeek — used for generation and editing</div>
                </div>
                <span className="text-[11.5px] font-medium bg-success/15 text-success rounded-full px-2.5 py-1">
                  Connected
                </span>
              </div>
            </section>

            <button
              onClick={() => void signOut()}
              className="flex items-center gap-2 text-[13px] text-danger border border-danger/30 rounded-lg px-4 py-2.5 hover:bg-danger/10 transition-colors cursor-pointer"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-2 border border-border-strong rounded-xl px-4.5 py-3 text-[13px] shadow-xl shadow-black/40 animate-in-fade px-5">
          {toast}
        </div>
      )}
    </div>
  );
}
