"use client";

/**
 * Text-only product brand. No image marks anywhere — the product name is
 * simply "Studio".
 */

export const PRODUCT_NAME = "Studio";

/** Small square monogram for tight slots (sidebar collapsed, editor chrome). */
export function BrandMark({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-label={PRODUCT_NAME}
      className={`inline-flex items-center justify-center rounded-lg font-bold select-none flex-shrink-0 bg-accent text-accent-text ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.55), lineHeight: 1 }}
      draggable={false}
    >
      S
    </span>
  );
}

/** The product wordmark: just the word, set in the UI font. */
export function BrandWordmark({
  height = 28,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  return (
    <span
      aria-label={PRODUCT_NAME}
      className={`inline-flex items-center font-semibold tracking-tight select-none ${className}`}
      style={{ height, fontSize: Math.round(height * 0.68), lineHeight: 1 }}
      draggable={false}
    >
      {PRODUCT_NAME}
    </span>
  );
}

/** Product lockup: wordmark expanded, monogram when collapsed. */
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
