"use client";

import { useEffect, useState } from "react";

/** SSR-safe media query hook. Returns false on the server and first paint. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True for phone-width viewports (iPhone and similar). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 720px)");
}
