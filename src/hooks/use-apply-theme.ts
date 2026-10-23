import { useEffect } from "react";
import type { Theme } from "src/types";
import {
  APPEARANCE_BASE,
  useAppearance,
} from "src/features/shell/appearance/appearance";
import { useWallpaper } from "src/features/shell/appearance/wallpaper";

// Kept for any lingering importers, but theme is no longer stored per-person
// in localStorage — it's per-workspace (workspace.settings.defaultTheme).
export const THEME_KEY = "folio-theme";

// The Wallpaper theme's values, as CSS variables on <html> (themes.scss).
const WALLPAPER_VARS = [
  "--wp-image",
  "--wp-blur",
  "--wp-dim",
  "--wp-glass",
  "--wp-tint",
  "--wp-accent",
  "--wp-accent-ink",
];

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
 * on light or dark, so it decides the mode; "default" follows the workspace,
 * and "wallpaper" follows its picture (a dark picture → dark mode).
 */
export function useApplyTheme(theme: Theme) {
  const [appearance] = useAppearance();
  const [wallpaper] = useWallpaper();

  useEffect(() => {
    const root = document.documentElement;
    const isWallpaper = appearance === "wallpaper";
    const base = isWallpaper
      ? wallpaper.dark
        ? "dark"
        : "light"
      : APPEARANCE_BASE[appearance];

    const apply = () =>
      root.classList.toggle(
        "dark",
        base ? base === "dark" : resolveDark(theme),
      );
    apply();

    if (appearance === "default") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", appearance);

    if (isWallpaper) {
      root.style.setProperty("--wp-image", wallpaper.image);
      root.style.setProperty("--wp-blur", `${wallpaper.blur}px`);
      root.style.setProperty("--wp-dim", String(wallpaper.dim / 100));
      root.style.setProperty(
        "--wp-glass",
        `rgba(${wallpaper.tint}, ${wallpaper.glass / 100})`,
      );
      root.style.setProperty("--wp-tint", wallpaper.tint);
      root.style.setProperty("--wp-accent", wallpaper.accent);
      root.style.setProperty("--wp-accent-ink", wallpaper.accentInk);
    }

    // index.html reads this before the app loads, so the first paint (and
    // the loading spinner) already match the workspace theme.
    try {
      localStorage.setItem(THEME_KEY, theme === "system" ? "" : theme);
    } catch {
      /* storage blocked */
    }

    // Leaving the app (landing, published pages) drops the theme.
    const clear = () => {
      root.removeAttribute("data-theme");
      for (const name of WALLPAPER_VARS) root.style.removeProperty(name);
    };

    if (!base && theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => {
        mq.removeEventListener("change", apply);
        clear();
      };
    }
    return clear;
  }, [theme, appearance, wallpaper]);
}
