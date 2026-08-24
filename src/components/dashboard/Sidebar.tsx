"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PresentationMeta, ProjectKind } from "@/lib/schema";
import { useTheme } from "@/components/theme/useTheme";
import {
  Plus, House, Layers, Settings, PanelLeft,
  LogOut, Moon, SunMedium, FileText, Download,
  Globe, Gamepad2, AppWindow,
} from "lucide-react";
import { BrandLockup, BrandMark } from "@/components/brand/BrandLogo";
import { usePwa } from "@/components/pwa/PwaProvider";
import { ResizeHandle, beginPanelResize } from "@/components/ui/ResizeHandle";

export type DashboardView = "home" | "presentations" | "settings";

const NAV: { key: DashboardView; label: string; icon: typeof Plus }[] = [
  { key: "home", label: "Home", icon: House },
  { key: "presentations", label: "Projects", icon: Layers },
];

const COLLAPSED_W = 56;
const MIN_W = 188;
const MAX_W = 360;
const DEFAULT_W = 244;
const SNAP_COLLAPSE = 148;

function kindIcon(kind?: ProjectKind) {
  if (kind === "website") return Globe;
  if (kind === "game") return Gamepad2;
  if (kind === "app") return AppWindow;
  return FileText;
}

export function Sidebar({
  view,
  onNavigate,
  onNew,
  recents,
  user,
  onSignOut,
  onOpenRecent,
}: {
  view: DashboardView;
  onNavigate: (v: DashboardView) => void;
  onNew: () => void;
  recents: PresentationMeta[] | null;
  user: { name: string; email: string; avatarUrl: string | null };
  onSignOut: () => void;
  onOpenRecent?: (id: string) => void;
}) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const { canInstall, install } = usePwa();
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_W);
  const [dragging, setDragging] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(width);
  const collapsedRef = useRef(collapsed);
  widthRef.current = width;
  collapsedRef.current = collapsed;

  useEffect(() => {
    try {
      const savedW = Number(localStorage.getItem("pk-sidebar-width"));
      if (savedW >= MIN_W && savedW <= MAX_W) setWidth(savedW);
      const saved = localStorage.getItem("pk-sidebar");
      if (saved === "collapsed") setCollapsed(true);
      else if (saved === "expanded") setCollapsed(false);
      else if (window.innerWidth < 900) setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("pk-sidebar-width", String(width));
      localStorage.setItem("pk-sidebar", collapsed ? "collapsed" : "expanded");
    } catch {
      /* ignore */
    }
  }, [width, collapsed]);

  function toggleCollapsed() {
    setCollapsed((c) => !c);
  }

  function startResize(clientX: number) {
    setDragging(true);
    const start = collapsedRef.current ? COLLAPSED_W : widthRef.current;
    beginPanelResize(clientX, start, 1, COLLAPSED_W, MAX_W, (next) => {
      if (next < SNAP_COLLAPSE) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
        setWidth(Math.min(MAX_W, Math.max(MIN_W, next)));
      }
    });
    const up = () => {
      setDragging(false);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointerup", up);
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
    "flex items-center rounded-lg text-[13px] transition-colors cursor-pointer select-none";
  const itemPad = collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-2.5 px-2.5 py-[7px] w-full";

  return (
    <aside
      className={`relative flex-shrink-0 bg-sidebar flex flex-col h-screen sticky top-0 ${
        dragging ? "" : "transition-[width] duration-200 ease-out"
      }`}
      style={{ width: collapsed ? COLLAPSED_W : width }}
    >
      {/* Header: brand + collapse */}
      <div
        className={`flex items-center flex-shrink-0 ${
          collapsed ? "flex-col justify-center gap-0.5 py-2" : "h-[52px] justify-between pl-3 pr-1.5"
        }`}
      >
        <button
          className={`flex items-center cursor-pointer ${collapsed ? "justify-center" : "gap-2 min-w-0"}`}
          onClick={() => onNavigate("home")}
          aria-label="Home"
        >
          {collapsed ? <BrandMark size={22} /> : <BrandLockup markSize={22} />}
        </button>
        <button
          onClick={toggleCollapsed}
          className="p-2 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-2/80 transition-colors cursor-pointer"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeft size={16} />
        </button>
      </div>

      {/* New chat */}
      <div className={collapsed ? "px-0 mb-1" : "px-2 mb-1"}>
        <button
          onClick={onNew}
          title="New chat"
          className={`${itemBase} ${itemPad} font-medium text-text hover:bg-surface-2/80`}
        >
          <Plus size={16} className="flex-shrink-0" />
          {!collapsed && "New chat"}
        </button>
      </div>

      {/* Nav */}
      <nav className={`flex flex-col gap-0.5 ${collapsed ? "px-0" : "px-2"} mt-1`}>
        {NAV.map((item) => {
          const active = view === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              title={item.label}
              className={`${itemBase} ${itemPad} ${
                active
                  ? "bg-surface-2 text-text font-medium"
                  : "text-text-secondary hover:text-text hover:bg-surface-2/80"
              }`}
            >
              <item.icon size={16} className="flex-shrink-0" />
              {!collapsed && item.label}
            </button>
          );
        })}
      </nav>

      {/* Recents */}
      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-y-auto px-2 mt-5">
          {recents && recents.length > 0 && (
            <>
              <div className="text-[11px] font-medium text-text-tertiary px-2.5 mb-1 tracking-wide">
                Recent
              </div>
              <div className="flex flex-col">
                {recents.slice(0, 12).map((m) => {
                  const Icon = kindIcon(m.kind);
                  return (
                    <button
                      key={m.id}
                      onClick={() => (onOpenRecent ? onOpenRecent(m.id) : router.push(`/editor/${m.id}`))}
                      className="group flex items-center gap-2 px-2.5 py-[7px] rounded-lg text-[13px] text-text-secondary hover:text-text hover:bg-surface-2/80 transition-colors cursor-pointer text-left"
                      title={m.title}
                    >
                      <Icon size={13} className="flex-shrink-0 text-text-tertiary" />
                      <span className="truncate flex-1">{m.title}</span>
                      {m.publishedAt && (
                        <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" title="Live" />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
      {collapsed && <div className="flex-1" />}

      {/* Bottom: settings, theme, profile */}
      <div className={`flex flex-col gap-0.5 py-2 ${collapsed ? "px-0" : "px-2"}`}>
        {canInstall && (
          <button
            onClick={() => void install()}
            title="Install app"
            className={`${itemBase} ${itemPad} text-text-secondary hover:text-text hover:bg-surface-2/80`}
          >
            <Download size={16} className="flex-shrink-0" />
            {!collapsed && "Install app"}
          </button>
        )}
        <button
          onClick={() => onNavigate("settings")}
          title="Settings"
          className={`${itemBase} ${itemPad} ${
            view === "settings"
              ? "bg-surface-2 text-text font-medium"
              : "text-text-secondary hover:text-text hover:bg-surface-2/80"
          }`}
        >
          <Settings size={16} className="flex-shrink-0" />
          {!collapsed && "Settings"}
        </button>

        <button
          onClick={toggle}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className={`${itemBase} ${itemPad} text-text-secondary hover:text-text hover:bg-surface-2/80`}
        >
          {theme === "dark" ? (
            <SunMedium size={16} className="flex-shrink-0" />
          ) : (
            <Moon size={16} className="flex-shrink-0" />
          )}
          {!collapsed && (theme === "dark" ? "Light mode" : "Dark mode")}
        </button>

        <div className="relative mt-1" ref={menuRef}>
          <button
            onClick={() => setUserMenu((o) => !o)}
            title={user.email}
            className={`${itemBase} ${
              collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-2.5 px-2 py-1.5 w-full"
            } hover:bg-surface-2/80`}
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
              <div className="w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center text-[10.5px] font-semibold text-text-secondary flex-shrink-0">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            {!collapsed && (
              <span className="min-w-0 text-left">
                <span className="block text-[13px] font-medium truncate">{user.name}</span>
              </span>
            )}
          </button>

          {userMenu && (
            <div
              className={`absolute bottom-full mb-1.5 z-40 w-52 bg-surface border border-border rounded-xl py-1.5 animate-rise ${
                collapsed ? "left-full ml-2 bottom-0" : "left-2"
              }`}
              style={{ boxShadow: "0 8px 28px var(--shadow-color)" }}
            >
              <div className="px-3.5 py-2 border-b border-border mb-1">
                <div className="text-[13px] font-medium truncate">{user.name}</div>
                <div className="text-[11.5px] text-text-tertiary truncate">{user.email}</div>
              </div>
              <button
                onClick={() => {
                  setUserMenu(false);
                  onNavigate("settings");
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

      <div className="absolute top-0 right-0 bottom-0 translate-x-1/2 z-30">
        <ResizeHandle label="Resize sidebar" onBegin={startResize} />
      </div>
    </aside>
  );
}
