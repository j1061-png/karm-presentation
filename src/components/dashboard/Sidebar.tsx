"use client";

import { Sun, Plus, Layers, Clock, LayoutTemplate, Settings } from "lucide-react";

export type DashboardView = "create" | "my" | "recent" | "templates" | "settings";

const NAV: { key: DashboardView; label: string; icon: typeof Plus }[] = [
  { key: "create", label: "New Presentation", icon: Plus },
  { key: "my", label: "My Presentations", icon: Layers },
  { key: "recent", label: "Recent", icon: Clock },
  { key: "templates", label: "Templates", icon: LayoutTemplate },
  { key: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  view,
  onNavigate,
  user,
}: {
  view: DashboardView;
  onNavigate: (v: DashboardView) => void;
  user: { name: string; email: string; avatarUrl: string | null };
}) {
  return (
    <aside className="w-[232px] flex-shrink-0 border-r border-border bg-surface/50 flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <button
        className="flex items-center gap-2.5 px-4 h-[57px] border-b border-border cursor-pointer"
        onClick={() => onNavigate("create")}
      >
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <Sun size={15} className="text-accent-text" strokeWidth={2.5} />
        </div>
        <span className="font-semibold text-[14px] tracking-tight">
          present<span className="text-accent">@</span>karm
        </span>
      </button>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-2.5 mt-1">
        {NAV.map((item) => {
          const active = view === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] transition-colors cursor-pointer ${
                active
                  ? "bg-surface-3 text-text font-medium"
                  : "text-text-secondary hover:text-text hover:bg-surface-2"
              }`}
            >
              <item.icon size={15} className={active ? "text-accent" : ""} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* User */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="w-7 h-7 rounded-full flex-shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-surface-3 flex items-center justify-center text-[11px] font-semibold text-text-secondary flex-shrink-0">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate">{user.name}</div>
            <div className="text-[11px] text-text-tertiary truncate">{user.email}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
