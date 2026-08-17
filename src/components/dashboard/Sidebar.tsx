"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PresentationMeta } from "@/lib/schema";
import { useTheme } from "@/components/theme/useTheme";
import {
  Plus, House, Layers, LayoutTemplate, Settings, PanelLeft,
  LogOut, Moon, SunMedium, FileText, Download, X,
} from "lucide-react";
import { BrandLockup, BrandMark } from "@/components/brand/BrandLogo";
import { usePwa } from "@/components/pwa/PwaProvider";

export type DashboardView = "home" | "presentations" | "templates" | "settings";

const NAV: { key: DashboardView; label: string; icon: typeof Plus }[] = [
  { key: "home", label: "Home", icon: House },
  { key: "presentations", label: "Presentations", icon: Layers },
  { key: "templates", label: "Templates", icon: LayoutTemplate },
];

export function Sidebar({
  view,
  onNavigate,
  onNew,
  recents,
  user,
  onSignOut,
  mobileOpen = false,
  onMobileClose,
}: {
  view: DashboardView;
  onNavigate: (v: DashboardView) => void;
  onNew: () => void;
  recents: PresentationMeta[] | null;
  user: { name: string; email: string; avatarUrl: string | null };
  onSignOut: () => void;
  /** Controls visibility as an off-canvas drawer below the md breakpoint. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const { canInstall, install } = usePwa();
  const [collapsed, setCollapsed] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Restore collapse preference; auto-collapse on narrow (but not phone-width) screens.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pk-sidebar");
      if (saved === "collapsed") setCollapsed(true);
    } catch {}
    const onResize = () => {
      if (window.innerWidth < 900 && window.innerWidth >= 640) setCollapsed(true);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function navigate(v: DashboardView) {
    onNavigate(v);
    onMobileClose?.();
  }

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem("pk-sidebar", c ? "expanded" : "collapsed");
      } catch {}
      return !c;
    });
  }

  useEffect(() => {
    if (!userMenu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setUserMenu(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [userMenu]);

  const itemBase =
    "flex items-center rounded-lg text-[13.5px] transition-colors cursor-pointer select-none";
  const itemPad = collapsed ? "md:justify-center md:w-9 md:h-9 md:mx-auto gap-2.5 px-2.5 py-[7px] w-full" : "gap-2.5 px-2.5 py-[7px] w-full";
  // The drawer is always shown expanded on phones, regardless of the desktop collapse preference.
  const showCollapsed = collapsed && !mobileOpen;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/45 md:hidden pk-backdrop"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`fixed md:sticky inset-y-0 left-0 z-50 md:z-auto flex-shrink-0 bg-sidebar border-r border-border flex flex-col h-screen md:top-0 transition-transform md:transition-[width] duration-200 ease-out w-[82vw] max-w-[280px] md:max-w-none safe-top safe-bottom ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 ${collapsed ? "md:w-[56px]" : "md:w-[248px]"}`}
      >
        {/* Header: brand + collapse */}
        <div className={`flex items-center flex-shrink-0 ${collapsed ? "md:flex-col md:justify-center md:gap-0.5 md:py-2 h-[54px] justify-between pl-3.5 pr-2" : "h-[54px] justify-between pl-3.5 pr-2"}`}>
          <button
            className={`flex items-center cursor-pointer ${collapsed ? "md:justify-center gap-2 min-w-0" : "gap-2 min-w-0"}`}
            onClick={() => navigate("home")}
            aria-label="Home"
          >
            <span className={collapsed ? "hidden md:block" : ""}>
              <BrandMark size={22} />
            </span>
            <span className={collapsed ? "md:hidden" : ""}>
              <BrandLockup markSize={22} />
            </span>
          </button>
          <button
            onClick={toggleCollapsed}
            className="hidden md:block p-2 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft size={16} />
          </button>
          <button
            onClick={onMobileClose}
            className="md:hidden p-2 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* New presentation */}
        <div className={collapsed ? "md:px-0 px-2.5 mb-1" : "px-2.5 mb-1"}>
          <button
            onClick={() => { onNew(); onMobileClose?.(); }}
            title="New presentation"
            className={`${itemBase} ${itemPad} font-medium text-text hover:bg-surface-2 border border-border bg-surface`}
          >
            <Plus size={16} className="flex-shrink-0" />
            <span className={collapsed ? "md:hidden" : ""}>New presentation</span>
          </button>
        </div>

        {/* Nav */}
        <nav className={`flex flex-col gap-0.5 ${collapsed ? "md:px-0 px-2.5" : "px-2.5"} mt-1`}>
          {NAV.map((item) => {
            const active = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                title={item.label}
                className={`${itemBase} ${itemPad} ${
                  active
                    ? "bg-surface-2 text-text font-medium"
                    : "text-text-secondary hover:text-text hover:bg-surface-2"
                }`}
              >
                <item.icon size={16} className="flex-shrink-0" />
                <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
              </button>
            );
          })}
        </nav>

      {/* Recents */}
      {!showCollapsed && (
        <div className="flex-1 min-h-0 overflow-y-auto px-2.5 mt-5">
          {recents && recents.length > 0 && (
            <>
              <div className="text-[11px] font-medium text-text-tertiary px-2.5 mb-1.5">Recent</div>
              <div className="flex flex-col gap-px">
                {recents.slice(0, 12).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { router.push(`/editor/${m.id}`); onMobileClose?.(); }}
                    className="group flex items-center gap-2 px-2.5 py-[6px] rounded-lg text-[13px] text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer text-left"
                    title={m.title}
                  >
                    <FileText size={13} className="flex-shrink-0 text-text-tertiary" />
                    <span className="truncate flex-1">{m.title}</span>
                    {m.publishedAt && (
                      <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" title="Live" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {showCollapsed && <div className="flex-1" />}

      {/* Bottom: settings, theme, profile */}
      <div className={`flex flex-col gap-0.5 py-2 border-t border-border ${showCollapsed ? "px-0" : "px-2.5"}`}>
        {canInstall && (
          <button
            onClick={() => void install()}
            title="Install app"
            className={`${itemBase} ${itemPad} text-text-secondary hover:text-text hover:bg-surface-2`}
          >
            <Download size={16} className="flex-shrink-0" />
            {!showCollapsed && "Install app"}
          </button>
        )}
        <button
          onClick={() => navigate("settings")}
          title="Settings"
          className={`${itemBase} ${itemPad} ${
            view === "settings"
              ? "bg-surface-2 text-text font-medium"
              : "text-text-secondary hover:text-text hover:bg-surface-2"
          }`}
        >
          <Settings size={16} className="flex-shrink-0" />
          {!showCollapsed && "Settings"}
        </button>

        <button
          onClick={toggle}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className={`${itemBase} ${itemPad} text-text-secondary hover:text-text hover:bg-surface-2`}
        >
          {theme === "dark" ? (
            <SunMedium size={16} className="flex-shrink-0" />
          ) : (
            <Moon size={16} className="flex-shrink-0" />
          )}
          {!showCollapsed && (theme === "dark" ? "Light mode" : "Dark mode")}
        </button>

        {/* Profile */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenu((o) => !o)}
            title={user.email}
            className={`${itemBase} ${showCollapsed ? "justify-center w-9 h-9 mx-auto" : "gap-2.5 px-2 py-1.5 w-full"} hover:bg-surface-2 mt-0.5`}
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="w-6 h-6 rounded-full flex-shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-surface-3 flex items-center justify-center text-[10.5px] font-semibold text-text-secondary flex-shrink-0">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            {!showCollapsed && (
              <span className="min-w-0 text-left">
                <span className="block text-[13px] font-medium truncate">{user.name}</span>
              </span>
            )}
          </button>

          {userMenu && (
            <div
              className={`absolute bottom-full mb-1.5 z-40 w-52 bg-surface border border-border rounded-xl shadow-lg py-1.5 animate-rise ${
                showCollapsed ? "left-full ml-2 bottom-0" : "left-2"
              }`}
              style={{ boxShadow: "0 8px 24px var(--shadow-color)" }}
            >
              <div className="px-3.5 py-2 border-b border-border mb-1">
                <div className="text-[13px] font-medium truncate">{user.name}</div>
                <div className="text-[11.5px] text-text-tertiary truncate">{user.email}</div>
              </div>
              <button
                onClick={() => {
                  setUserMenu(false);
                  navigate("settings");
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-text-secondary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <Settings size={14} /> Settings
              </button>
              <button
                onClick={onSignOut}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-text-secondary hover:text-danger hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      </aside>
    </>
  );
}
