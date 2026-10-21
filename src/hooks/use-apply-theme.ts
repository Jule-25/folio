import { useEffect } from "react";
import type { Theme } from "src/types";
import {
  APPEARANCE_BASE,
  useAppearance,
} from "src/features/shell/appearance/appearance";

// Kept for any lingering importers, but theme is no longer stored per-person
// in localStorage — it's per-workspace (workspace.settings.defaultTheme).
export const THEME_KEY = "folio-theme";

/** Resolve a Theme to a concrete dark boolean, honoring "system". */
function resolveDark(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Applies the look to the document: the workspace's light/dark (the caller
 * passes workspace.settings.defaultTheme) and the person's own appearance
 * theme (data-theme on <html>, see appearance/themes.scss). A theme is built
 * on light or dark, so it decides the mode; "default" follows the workspace.
 */
export function useApplyTheme(theme: Theme) {
  const [appearance] = useAppearance();

  useEffect(() => {
    const root = document.documentElement;
    const base = APPEARANCE_BASE[appearance];

    const apply = () =>
      root.classList.toggle(
        "dark",
        base ? base === "dark" : resolveDark(theme),
      );
    apply();

    if (appearance === "default") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", appearance);

    // index.html reads this before the app loads, so the first paint (and
    // the loading spinner) already match the workspace theme.
    try {
      localStorage.setItem(THEME_KEY, theme === "system" ? "" : theme);
    } catch {
      /* storage blocked */
    }

    if (!base && theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => {
        mq.removeEventListener("change", apply);
        root.removeAttribute("data-theme");
      };
    }
    // Leaving the app (landing, published pages) drops the theme.
    return () => root.removeAttribute("data-theme");
  }, [theme, appearance]);
}
