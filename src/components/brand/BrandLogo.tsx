"use client";

/**
 * Product brand: the browser / code mark plus the word "webo".
 */

export const PRODUCT_NAME = "webo";
export const BRAND_BLUE = "#2B7FFF";

/** The user-provided mark: a rounded browser window with a </> glyph. */
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
      <rect
        x="3.2"
        y="3.2"
        width="25.6"
        height="25.6"
        rx="6.4"
        stroke={BRAND_BLUE}
        strokeWidth="2.25"
      />
      <path d="M3.2 11.15h25.6" stroke={BRAND_BLUE} strokeWidth="2.25" />
      <circle cx="8.35" cy="7.2" r="1.12" fill={BRAND_BLUE} />
      <circle cx="12.15" cy="7.2" r="1.12" fill={BRAND_BLUE} />
      <circle cx="15.95" cy="7.2" r="1.12" fill={BRAND_BLUE} />
      <path
        d="M10.1 16.15 7.35 20.05l2.75 3.9"
        stroke={BRAND_BLUE}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.35 24.2 17.85 15.85"
        stroke={BRAND_BLUE}
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <path
        d="M21.9 16.15 24.65 20.05l-2.75 3.9"
        stroke={BRAND_BLUE}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Wordmark: mark + webo. */
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
      <span
        className="font-semibold tracking-tight"
        style={{ fontSize: Math.round(height * 0.68), lineHeight: 1 }}
      >
        {PRODUCT_NAME}
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
