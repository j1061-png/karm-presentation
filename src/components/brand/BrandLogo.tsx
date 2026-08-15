"use client";

import { useTheme } from "@/components/theme/useTheme";

/** Official KarmSolar painted mark — use for small logo slots. */
export function BrandMark({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/karm-mark.png"
      alt="KarmSolar"
      width={size}
      height={size}
      className={`object-contain flex-shrink-0 ${className}`}
      draggable={false}
    />
  );
}

/** Official Karm. wordmark from karmholding.com (theme-aware). */
export function BrandWordmark({
  height = 28,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  const { theme } = useTheme();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={theme === "dark" ? "/karm-logo-light.png" : "/karm-logo.png"}
      alt="KarmSolar"
      className={`object-contain object-left ${className}`}
      style={{ height, width: "auto" }}
      draggable={false}
    />
  );
}

/** Product lockup: official Karm wordmark only. */
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
