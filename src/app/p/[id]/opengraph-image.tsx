import { ImageResponse } from "next/og";
import { getPublished } from "@/lib/store";

export const runtime = "nodejs";
export const alt = "Injaz Studio project";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Generated social preview card for each published presentation, themed with
 * the presentation's own colors. Used by WhatsApp, X, Facebook, LinkedIn, etc.
 */
export default async function OpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const published = /^[\w-]+$/.test(id) ? await getPublished(id).catch(() => null) : null;

  const theme = published?.presentation.theme;
  const bg = theme?.colors.background ?? "#0c0d10";
  const surface = theme?.colors.surface ?? "#16181d";
  const text = theme?.colors.text ?? "#f4f5f7";
  const muted = theme?.colors.muted ?? "#9ba1ab";
  const accent = theme?.colors.accent ?? "#f5a623";
  const title =
    published && published.visibility !== "private"
      ? published.presentation.title
      : "Interactive presentation";
  const slideCount = published?.presentation.slides.length ?? 0;
  const objectCount = published?.presentation.scene?.objects.length ?? 0;
  const kind = published?.presentation.kind ?? "presentation";
  const footer =
    kind === "model"
      ? `${objectCount} object${objectCount === 1 ? "" : "s"} · 3D model`
      : slideCount > 0
        ? `${slideCount} interactive slides`
        : kind === "website" || kind === "game" || kind === "app"
          ? `Interactive ${kind}`
          : "Interactive presentation";
  const cta = kind === "model" ? "View model →" : kind === "website" || kind === "game" || kind === "app" ? `Open ${kind} →` : "View presentation →";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(135deg, ${bg} 0%, ${surface} 100%)`,
          padding: 72,
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Accent glow */}
        <div
          style={{
            position: "absolute",
            top: -180,
            right: -120,
            width: 520,
            height: 520,
            borderRadius: 9999,
            background: accent,
            opacity: 0.14,
            filter: "blur(20px)",
            display: "flex",
          }}
        />

        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="52" height="52" viewBox="0 0 32 32" fill="none">
            <path
              d="M16 4.2 27.2 10.4v11.2L16 27.8 4.8 21.6V10.4L16 4.2Z"
              stroke="#C4A265"
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
            <path d="M16 4.2v12.3" stroke="#C4A265" strokeWidth="1.7" />
            <path d="M16 16.5 27.2 10.4" stroke="#C4A265" strokeWidth="1.7" />
            <path d="M16 16.5 4.8 10.4" stroke="#C4A265" strokeWidth="1.7" />
            <path d="M16 16.5 16 27.8" stroke="#C4A265" strokeWidth="1.7" opacity="0.55" />
          </svg>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: text }}>Injaz Studio</div>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            gap: 26,
          }}
        >
          <div style={{ display: "flex", width: 76, height: 7, background: accent, borderRadius: 4 }} />
          <div
            style={{
              display: "flex",
              fontSize: title.length > 46 ? 54 : 68,
              fontWeight: 700,
              color: text,
              lineHeight: 1.12,
              letterSpacing: -1.5,
              maxWidth: 980,
            }}
          >
            {title.slice(0, 90)}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 26, color: muted }}>
            {footer}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: bg,
              background: accent,
              padding: "12px 28px",
              borderRadius: 12,
              fontWeight: 600,
            }}
          >
            {cta}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
