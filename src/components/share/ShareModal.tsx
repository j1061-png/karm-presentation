"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import * as api from "@/lib/api";
import { PeopleSection } from "./PeopleSection";
import {
  X, Copy, Check, Globe, Link2, Lock, Loader2, Rocket, AlertCircle,
  Mail, Share2, Download, ExternalLink, RefreshCw, CloudOff, Search,
  ShoppingCart, Trash2,
} from "lucide-react";

/* Brand icons (lucide has no social logos) */
function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

type PublishStage = "idle" | "preparing" | "validating" | "building" | "deploying" | "done" | "error";

const STAGE_LABELS: Record<Exclude<PublishStage, "idle" | "done" | "error">, string> = {
  preparing: "Preparing project",
  validating: "Validating content",
  building: "Building interactive experience",
  deploying: "Deploying",
};

export function ShareModal({
  presentationId,
  title,
  onClose,
  isOwner = true,
}: {
  presentationId: string;
  title: string;
  onClose: () => void;
  isOwner?: boolean;
}) {
  const [status, setStatus] = useState<api.PublishStatus | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [stage, setStage] = useState<PublishStage>("idle");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [visBusy, setVisBusy] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/p/${presentationId}` : "";

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.getPublishStatus(presentationId));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [presentationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // QR code for the live URL
  useEffect(() => {
    if (!status?.published || !publicUrl) return;
    QRCode.toDataURL(publicUrl, {
      width: 480,
      margin: 1,
      color: { dark: "#0b0c0e", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [status?.published, publicUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function publish(visibility: api.Visibility = status?.visibility ?? "link") {
    setPublishError(null);
    setStage("preparing");
    await wait(450);
    setStage("validating");
    await wait(450);
    setStage("building");
    try {
      const result = await api.publishPresentation(presentationId, visibility);
      setStage("deploying");
      await wait(600);
      setStatus(result);
      setStage("done");
      await wait(900);
      setStage("idle");
    } catch (e) {
      setStage("error");
      setPublishError(e instanceof Error ? e.message : "Deployment failed.");
    }
  }

  async function changeVisibility(visibility: api.Visibility) {
    if (!status?.published) return;
    setVisBusy(true);
    try {
      setStatus(await api.setPublishVisibility(presentationId, visibility));
    } finally {
      setVisBusy(false);
    }
  }

  async function unpublish() {
    setVisBusy(true);
    try {
      setStatus(await api.unpublishPresentation(presentationId));
      setQrDataUrl(null);
    } finally {
      setVisBusy(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const shareText = `${title} — made with Studio`;
  const enc = encodeURIComponent;
  const shareTargets = [
    {
      label: "WhatsApp",
      icon: <WhatsAppIcon />,
      color: "#25D366",
      href: `https://wa.me/?text=${enc(`${shareText}\n${publicUrl}`)}`,
    },
    {
      label: "Facebook",
      icon: <FacebookIcon />,
      color: "#1877F2",
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(publicUrl)}`,
    },
    {
      label: "X",
      icon: <XIcon />,
      color: "#e7e9ea",
      href: `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(publicUrl)}`,
    },
    {
      label: "Email",
      icon: <Mail size={15} />,
      color: "#f5a623",
      href: `mailto:?subject=${enc(shareText)}&body=${enc(`Have a look at this:\n\n${publicUrl}`)}`,
    },
  ];

  const publishing = stage !== "idle" && stage !== "error" && stage !== "done";
  const isLive = !!status?.published;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in-fade"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] bg-surface border border-border-strong rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Share project"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <Share2 size={15} className="text-accent" />
            </div>
            <div>
              <div className="text-[14px] font-semibold">Publish &amp; share</div>
              <div className="text-[11.5px] text-text-tertiary truncate max-w-[260px]">{title}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <PeopleSection presentationId={presentationId} isOwner={isOwner} />

          {/* ----------------------------------------- deployment status */}
          {loadError ? (
            <div className="flex items-center justify-between bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">
              <span className="text-[13px] text-danger flex items-center gap-2">
                <AlertCircle size={14} /> Couldn&apos;t load status
              </span>
              <button onClick={() => void refresh()} className="text-[12px] text-danger underline cursor-pointer">
                Retry
              </button>
            </div>
          ) : !status ? (
            <div className="flex items-center gap-2.5 text-[13px] text-text-secondary py-2">
              <Loader2 size={14} className="animate-spin" /> Checking deployment status...
            </div>
          ) : publishing ? (
            <div className="bg-surface-2 border border-border rounded-xl px-4 py-3.5 flex flex-col gap-2.5">
              {(Object.keys(STAGE_LABELS) as (keyof typeof STAGE_LABELS)[]).map((key) => {
                const order = ["preparing", "validating", "building", "deploying"];
                const activeIdx = order.indexOf(stage);
                const idx = order.indexOf(key);
                const isDone = idx < activeIdx;
                const isActive = idx === activeIdx;
                return (
                  <div key={key} className="flex items-center gap-2.5" style={{ opacity: isDone || isActive ? 1 : 0.4 }}>
                    {isDone ? (
                      <Check size={13} className="text-success" />
                    ) : isActive ? (
                      <Loader2 size={13} className="animate-spin text-accent" />
                    ) : (
                      <span className="w-[13px] h-[13px] rounded-full border border-border-strong" />
                    )}
                    <span className={`text-[12.5px] ${isActive ? "font-medium" : "text-text-secondary"}`}>
                      {STAGE_LABELS[key]}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : stage === "done" ? (
            <div className="flex items-center gap-2.5 bg-success/10 border border-success/30 rounded-xl px-4 py-3 text-[13px] text-success">
              <Check size={15} /> Your project is live
            </div>
          ) : stage === "error" ? (
            <div className="flex items-center justify-between bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">
              <span className="text-[12.5px] text-danger flex items-center gap-2">
                <AlertCircle size={14} /> {publishError ?? "Deployment failed"}
              </span>
              <button
                onClick={() => void publish()}
                className="flex items-center gap-1.5 text-[12px] font-medium text-danger cursor-pointer hover:underline flex-shrink-0"
              >
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          ) : isLive ? (
            <>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-success">
                  <span className="relative flex w-2 h-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60" style={{ animation: "pulse-soft 1.6s ease-in-out infinite" }} />
                    <span className="relative inline-flex rounded-full w-2 h-2 bg-success" />
                  </span>
                  Live
                </span>
                {isOwner && status.hasUnpublishedChanges && (
                  <button
                    onClick={() => void publish()}
                    className="flex items-center gap-1.5 text-[12px] font-medium bg-accent text-accent-text rounded-lg px-3 py-1.5 hover:bg-accent-hover transition-colors cursor-pointer"
                  >
                    <Rocket size={12} /> Publish latest changes
                  </button>
                )}
              </div>

              {/* URL + copy */}
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-[13px] font-mono truncate text-text-secondary">
                  {publicUrl}
                </div>
                <button
                  onClick={() => void copyLink()}
                  className={`flex items-center gap-1.5 text-[12.5px] font-medium rounded-xl px-3.5 py-2.5 transition-all cursor-pointer flex-shrink-0 ${
                    copied ? "bg-success/15 text-success" : "bg-accent text-accent-text hover:bg-accent-hover"
                  }`}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              {/* Social buttons */}
              <div className="grid grid-cols-4 gap-2">
                {shareTargets.map((t) => (
                  <a
                    key={t.label}
                    href={t.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1.5 border border-border rounded-xl py-3 hover:border-border-strong hover:bg-surface-2 transition-all cursor-pointer group"
                  >
                    <span className="transition-transform group-hover:scale-110" style={{ color: t.color }}>
                      {t.icon}
                    </span>
                    <span className="text-[11px] text-text-secondary">{t.label}</span>
                  </a>
                ))}
              </div>

              <div className="flex gap-2">
                {canNativeShare && (
                  <button
                    onClick={() => void navigator.share({ title: shareText, url: publicUrl }).catch(() => {})}
                    className="flex-1 flex items-center justify-center gap-2 text-[12.5px] border border-border rounded-xl py-2.5 hover:border-border-strong hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    <Share2 size={13} /> Share via device
                  </button>
                )}
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 text-[12.5px] border border-border rounded-xl py-2.5 hover:border-border-strong hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <ExternalLink size={13} /> Open live
                </a>
              </div>

              {/* QR code */}
              {qrDataUrl && (
                <div className="flex items-center gap-4 bg-surface-2 border border-border rounded-xl p-3.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="QR code for presentation" className="w-[88px] h-[88px] rounded-lg bg-white p-1" />
                  <div className="flex-1">
                    <div className="text-[12.5px] font-medium mb-0.5">QR code</div>
                    <div className="text-[11.5px] text-text-secondary mb-2">
                      Scan to open it on any device.
                    </div>
                    <a
                      href={qrDataUrl}
                      download={`studio-${presentationId}.png`}
                      className="inline-flex items-center gap-1.5 text-[11.5px] text-accent hover:underline cursor-pointer"
                    >
                      <Download size={11} /> Download PNG
                    </a>
                  </div>
                </div>
              )}

              {/* Visibility */}
              {isOwner && <div className="flex flex-col gap-1.5">
                <div className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                  Who can view
                </div>
                {(
                  [
                    { v: "private", icon: Lock, label: "Private", desc: "Only you can open it" },
                    { v: "link", icon: Link2, label: "Anyone with the link", desc: "Not indexed, viewable via URL" },
                    { v: "public", icon: Globe, label: "Public", desc: "Anyone can view and search engines may index" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    disabled={visBusy}
                    onClick={() => void changeVisibility(o.v)}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors cursor-pointer disabled:opacity-60 ${
                      status.visibility === o.v
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    <o.icon size={14} className={status.visibility === o.v ? "text-accent" : "text-text-tertiary"} />
                    <span className="flex-1">
                      <span className="block text-[12.5px] font-medium">{o.label}</span>
                      <span className="block text-[11px] text-text-tertiary">{o.desc}</span>
                    </span>
                    {status.visibility === o.v && <Check size={14} className="text-accent" />}
                  </button>
                ))}
              </div>}

              {isOwner && <DomainSection presentationId={presentationId} />}

              {isOwner && (
                <button
                  onClick={() => void unpublish()}
                  disabled={visBusy}
                  className="flex items-center justify-center gap-2 text-[12px] text-text-tertiary hover:text-danger transition-colors cursor-pointer py-1 disabled:opacity-60"
                >
                  <CloudOff size={12} /> Take offline
                </button>
              )}
            </>
          ) : (
            /* ------------------------------------------- not yet published */
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-accent/12 flex items-center justify-center mb-3">
                <Rocket size={20} className="text-accent" />
              </div>
              <div className="text-[14px] font-semibold mb-1">
                {isOwner ? "Publish to share" : "Not published yet"}
              </div>
              <p className="text-[12.5px] text-text-secondary leading-relaxed mb-5 max-w-[300px]">
                {isOwner
                  ? "Publishing deploys a live version of this project as a real website at a public URL. Your draft stays separate — edits only go live when you republish."
                  : "The owner has not published a live link yet. You can still edit this project."}
              </p>
              {isOwner && (
                <>
                  <div className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-[12.5px] font-mono text-text-tertiary truncate mb-4">
                    {publicUrl}
                  </div>
                  <button
                    onClick={() => void publish("link")}
                    className="w-full flex items-center justify-center gap-2 text-[13.5px] font-medium bg-accent text-accent-text rounded-xl py-3 hover:bg-accent-hover transition-colors cursor-pointer"
                  >
                    <Rocket size={15} /> Publish
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ------------------------------------------------------------------ */
/* Custom domains: buy a new domain or connect one you already own     */
/* ------------------------------------------------------------------ */

function formatPrice(cents: number | null): string {
  if (cents === null) return "";
  return `$${(cents / 100).toFixed(2)}`;
}

function DomainSection({ presentationId }: { presentationId: string }) {
  const [list, setList] = useState<api.DomainList | null>(null);
  const [mode, setMode] = useState<"buy" | "connect">("buy");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<api.DomainSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dnsInfo, setDnsInfo] = useState<api.ConnectDomainResult["dns"] | null>(null);

  const refresh = useCallback(async () => {
    try {
      setList(await api.listDomains(presentationId));
    } catch {
      /* section stays collapsed on failure */
    }
  }, [presentationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function search() {
    const q = query.trim();
    if (!q || searching) return;
    setError(null);
    setResult(null);
    setSearching(true);
    try {
      setResult(await api.searchDomain(q));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function buy() {
    if (!result?.available || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.checkoutDomain(result.domain, presentationId);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
      setBusy(false);
    }
  }

  async function connect() {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setDnsInfo(null);
    try {
      const res = await api.connectDomain(q, presentationId);
      setDnsInfo(res.dns);
      setQuery("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect the domain.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(hostname: string) {
    setBusy(true);
    try {
      await api.removeDomain(hostname);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const statusLabel: Record<api.DomainInfo["status"], { text: string; cls: string }> = {
    active: { text: "Active", cls: "text-success" },
    pending_dns: { text: "Waiting for DNS", cls: "text-accent" },
    error: { text: "Error", cls: "text-danger" },
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <div className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
        Custom domain
      </div>

      {/* Connected domains for this project */}
      {list && list.domains.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {list.domains.map((d) => (
            <div
              key={d.hostname}
              className="flex items-center gap-2.5 border border-border rounded-xl px-3.5 py-2.5"
            >
              <Globe size={13} className="text-text-tertiary flex-shrink-0" />
              <a
                href={`https://${d.hostname}`}
                target="_blank"
                rel="noreferrer"
                className="text-[12.5px] font-mono truncate hover:underline"
              >
                {d.hostname}
              </a>
              <span className={`text-[11px] font-medium ml-auto flex-shrink-0 ${statusLabel[d.status].cls}`}>
                {statusLabel[d.status].text}
              </span>
              <button
                onClick={() => void remove(d.hostname)}
                disabled={busy}
                className="p-1 rounded-md text-text-tertiary hover:text-danger transition-colors cursor-pointer flex-shrink-0 disabled:opacity-50"
                aria-label={`Remove ${d.hostname}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Mode switch */}
      <div className="flex items-center bg-surface-2 border border-border rounded-lg p-0.5 self-start">
        {(
          [
            { key: "buy", label: "Buy a domain" },
            { key: "connect", label: "I already own one" },
          ] as const
        ).map((m) => (
          <button
            key={m.key}
            onClick={() => {
              setMode(m.key);
              setError(null);
              setResult(null);
              setDnsInfo(null);
            }}
            className={`text-[11.5px] px-2.5 py-1.5 rounded-[6px] transition-colors cursor-pointer ${
              mode === m.key ? "bg-surface-3 text-text font-medium" : "text-text-secondary hover:text-text"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "buy" && list && !list.purchaseConfigured ? (
        <div className="text-[12px] text-text-secondary bg-surface-2 border border-border rounded-xl px-3.5 py-2.5">
          Domain billing is not configured on this deployment yet. You can still connect a domain
          you already own.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setResult(null);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (mode === "buy") void search();
                  else void connect();
                }
              }}
              placeholder={mode === "buy" ? "mysite.com" : "domain-you-own.com"}
              className="flex-1 min-w-0 bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-[13px] font-mono outline-none focus:border-border-strong transition-colors placeholder:text-text-tertiary"
              aria-label={mode === "buy" ? "Domain to buy" : "Domain to connect"}
            />
            <button
              onClick={() => (mode === "buy" ? void search() : void connect())}
              disabled={!query.trim() || searching || busy}
              className="flex items-center gap-1.5 text-[12.5px] font-medium bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 hover:border-border-strong transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
            >
              {searching || busy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : mode === "buy" ? (
                <Search size={13} />
              ) : (
                <Link2 size={13} />
              )}
              {mode === "buy" ? "Search" : "Connect"}
            </button>
          </div>

          {error && (
            <div className="text-[12px] text-danger flex items-center gap-1.5">
              <AlertCircle size={12} className="flex-shrink-0" /> {error}
            </div>
          )}

          {/* Buy result */}
          {mode === "buy" && result && (
            <div className="flex items-center gap-2.5 border border-border rounded-xl px-3.5 py-2.5">
              <span className="text-[13px] font-mono truncate">{result.domain}</span>
              {result.available ? (
                <>
                  <span className="text-[11.5px] font-medium text-success flex-shrink-0">Available</span>
                  <button
                    onClick={() => void buy()}
                    disabled={busy}
                    className="ml-auto flex items-center gap-1.5 text-[12px] font-medium bg-accent text-accent-text rounded-lg px-3 py-1.5 hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-60 flex-shrink-0"
                  >
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <ShoppingCart size={12} />}
                    Buy {formatPrice(result.priceCents)}/yr
                  </button>
                </>
              ) : (
                <span className="text-[11.5px] font-medium text-danger ml-auto flex-shrink-0">Taken</span>
              )}
            </div>
          )}

          {/* Connect DNS instructions */}
          {mode === "connect" && dnsInfo && (
            <div className="bg-surface-2 border border-border rounded-xl px-3.5 py-3 flex flex-col gap-1.5">
              <div className="text-[12px] font-medium flex items-center gap-1.5">
                <Check size={12} className="text-success" /> Domain connected — one DNS step left
              </div>
              <div className="text-[11.5px] text-text-secondary leading-relaxed">{dnsInfo.note}</div>
              <div className="text-[12px] font-mono bg-bg border border-border rounded-lg px-3 py-2 mt-1">
                {dnsInfo.type} → {dnsInfo.value}
              </div>
            </div>
          )}

          {mode === "buy" && (
            <div className="text-[11px] text-text-tertiary leading-relaxed">
              Price includes registration for one year, DNS setup, and connecting the domain to
              this project. Payment is handled securely by Stripe.
            </div>
          )}
        </>
      )}
    </div>
  );
}
