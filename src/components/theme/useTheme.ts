"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemeName = "light" | "dark";

function currentTheme(): ThemeName {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Reads/writes the data-theme attribute + localStorage. */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeName>("dark");

  useEffect(() => {
    setThemeState(currentTheme());
  }, []);

  const setTheme = useCallback((next: ThemeName) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("pk-theme", next);
    } catch {
      /* private mode */
    }
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  }, [setTheme]);

  return { theme, setTheme, toggle };
}
