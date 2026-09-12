"use client";

/**
 * Product brand: Injaz Studio — an isometric cube mark plus the wordmark.
 */

export const PRODUCT_NAME = "Injaz Studio";
export const PRODUCT_SHORT = "Injaz";
export const BRAND_GOLD = "#C4A265";
export const BRAND_INK = "#1C1915";

/** Isometric studio cube — 3D, not the old browser/code mark. */
export function BrandMark({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-label={PRODUCT_NAME}
      className={`flex-shrink-0 select-none ${className}`}
    >
      <path
        d="M16 4.2 27.2 10.4v11.2L16 27.8 4.8 21.6V10.4L16 4.2Z"
        stroke={BRAND_GOLD}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M16 4.2v12.3" stroke={BRAND_GOLD} strokeWidth="1.7" />
      <path d="M16 16.5 27.2 10.4" stroke={BRAND_GOLD} strokeWidth="1.7" />
      <path d="M16 16.5 4.8 10.4" stroke={BRAND_GOLD} strokeWidth="1.7" />
      <path d="M16 16.5 16 27.8" stroke={BRAND_GOLD} strokeWidth="1.7" opacity="0.55" />
    </svg>
  );
}

/** Wordmark: cube + Injaz Studio. */
export function BrandWordmark({
  height = 28,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  const mark = Math.round(height * 1.05);
  return (
    <span
      aria-label={PRODUCT_NAME}
      className={`inline-flex items-center gap-2 select-none ${className}`}
      style={{ height: Math.max(height, mark) }}
    >
      <BrandMark size={mark} />
      <span className="leading-none tracking-tight">
        <span
          className="font-semibold"
          style={{ fontSize: Math.round(height * 0.62) }}
        >
          Injaz
        </span>
        <span
          className="font-medium text-text-secondary"
          style={{ fontSize: Math.round(height * 0.62), marginLeft: 5 }}
        >
          Studio
        </span>
      </span>
    </span>
  );
}

/** Product lockup: wordmark expanded, mark when collapsed. */
export function BrandLockup({
  markSize = 24,
  collapsed = false,
}: {
  markSize?: number;
  collapsed?: boolean;
}) {
  if (collapsed) return <BrandMark size={markSize} />;
  return <BrandWordmark height={Math.max(20, Math.round(markSize * 0.95))} />;
}
