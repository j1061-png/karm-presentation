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
import { PresentationItem } from "./PresentationItem";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { useTheme } from "@/components/theme/useTheme";
import {
  Search, Plus, Layers, LogOut, Loader2, LayoutTemplate, Presentation, Moon, SunMedium,
} from "lucide-react";

type SortKey = "updated" | "created" | "title";

export function DashboardShell({
  user,
}: {
  user: { name: string; email: string; avatarUrl: string | null };
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [view, setView] = useState<DashboardView>("home");
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

  const recent = metas?.slice(0, 5) ?? null;
  const firstName = user.name.split(" ")[0];

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar
        view={view}
        onNavigate={setView}
        onNew={handleNewBlank}
        recents={metas}
        user={user}
        onSignOut={() => void signOut()}
      />

      <main className="flex-1 min-w-0 flex flex-col">
        {/* -------------------------------------------------- home view */}
        {view === "home" && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
            <div className="w-full max-w-[680px]">
              <h1 className="text-[26px] font-semibold tracking-tight text-center mb-7 animate-rise">
                What do you want to create{firstName ? `, ${firstName}` : ""}?
              </h1>
              <Composer />

              {/* Compact recents */}
              {recent && recent.length > 0 && (
                <div className="mt-12 animate-rise">
                  <div className="flex items-center justify-between px-3 mb-1.5">
                    <h2 className="text-[12px] font-medium text-text-tertiary">Recent</h2>
                    <button
                      onClick={() => setView("presentations")}
                      className="text-[12px] text-text-tertiary hover:text-text transition-colors cursor-pointer"
                    >
                      View all
                    </button>
                  </div>
                  <div className="flex flex-col">
                    {recent.map((m) => (
                      <PresentationItem
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
          </div>
        )}

        {/* ----------------------------------------- presentations view */}
        {view === "presentations" && (
          <div className="w-full max-w-3xl mx-auto px-6 py-10">
            <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
              <h1 className="text-[17px] font-semibold tracking-tight">Presentations</h1>
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
                  {query ? "No presentations match your search" : "No presentations yet"}
                </div>
                <div className="text-[13px] text-text-secondary mb-5 max-w-xs">
                  {query
                    ? "Try a different search term."
                    : "Create your first interactive presentation."}
                </div>
                {!query && (
                  <button
                    onClick={() => setView("home")}
                    className="flex items-center gap-1.5 text-[13px] font-medium bg-accent text-accent-text rounded-lg px-3.5 py-2 hover:bg-accent-hover transition-colors cursor-pointer"
                  >
                    <Plus size={13} /> Create presentation
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col">
                {filtered.map((m) => (
                  <PresentationItem
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
          <div className="w-full max-w-3xl mx-auto px-6 py-10">
            <h1 className="text-[17px] font-semibold tracking-tight mb-1">Templates</h1>
            <p className="text-[13px] text-text-secondary mb-6">
              Start from a structure, then let AI fill it with your content.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TEMPLATES.map((t) => {
                const slideTheme = ThemeSchema.parse(t.doc.theme);
                return (
                  <div
                    key={t.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => busy === null && void handleTemplate(t.key)}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") && busy === null && void handleTemplate(t.key)
                    }
                    className={`group text-left border border-border rounded-xl overflow-hidden hover:border-border-strong transition-colors cursor-pointer bg-surface ${
                      busy !== null ? "opacity-60 pointer-events-none" : ""
                    }`}
                  >
                    <div className="relative pointer-events-none">
                      <SlideRenderer slide={t.doc.slides[0]} theme={slideTheme} mode="thumb" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="text-[12px] font-medium bg-white text-black rounded-lg px-3 py-1.5 shadow-md flex items-center gap-1.5">
                          {busy === t.key ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <LayoutTemplate size={11} />
                          )}
                          Use template
                        </span>
                      </div>
                    </div>
                    <div className="px-3 py-2.5">
                      <div className="text-[13px] font-medium">{t.name}</div>
                      <div className="text-[11.5px] text-text-tertiary mt-0.5 leading-relaxed">
                        {t.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --------------------------------------------- settings view */}
        {view === "settings" && (
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
                  {metas?.length ?? "—"}
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <div className="text-[13px] font-medium">AI model</div>
                  <div className="text-[12px] text-text-tertiary">DeepSeek — generation and editing</div>
                </div>
                <span className="text-[11px] font-medium bg-success/12 text-success rounded-full px-2.5 py-1">
                  Connected
                </span>
              </div>
            </section>

            <button
              onClick={() => void signOut()}
              className="flex items-center gap-2 text-[13px] text-danger border border-danger/30 rounded-lg px-3.5 py-2 hover:bg-danger/10 transition-colors cursor-pointer"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
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
