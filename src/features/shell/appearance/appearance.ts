import { useLocalStorage } from "src/hooks/use-local-storage";
import "./themes.scss";

// A personal look for the whole app, kept on this device: the theme name goes
// on <html data-theme="…"> (useApplyTheme) and themes.scss restyles the app
// from there. "default" = the normal light/dark app, nothing on <html>.
export const APPEARANCE_KEY = "folio-appearance";

export const APPEARANCES = [
  "default",
  "aurora",
  "midnight",
  "notebook",
  "retro",
  "wallpaper",
] as const;

export type Appearance = (typeof APPEARANCES)[number];

// The mode each theme is built on. null = follows the workspace light/dark,
// except "wallpaper", whose mode comes from the picture (wallpaper.ts →
// useApplyTheme). Keep in step with the no-flash script in index.html.
export const APPEARANCE_BASE: Record<Appearance, "light" | "dark" | null> = {
  default: null,
  aurora: "light",
  midnight: "dark",
  notebook: "light",
  retro: "light",
  wallpaper: null,
};

export function isAppearance(value: unknown): value is Appearance {
  return (
    typeof value === "string" &&
    (APPEARANCES as readonly string[]).includes(value)
  );
}

// Stored as the plain name (no JSON quotes) so index.html can read it.
const codec = {
  serialize: (value: Appearance) => value,
  deserialize: (raw: string): Appearance =>
    isAppearance(raw) ? raw : "default",
};

export function useAppearance() {
  return useLocalStorage<Appearance>(APPEARANCE_KEY, "default", codec);
}
