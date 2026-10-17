import { useEffect } from "react";
import { SPACE_ACCENT_CLASS, useSpaceAccent } from "./space-accent";

/**
 * Puts the current space's colour on <html> (class + `--space-accent`), so
 * the brand tokens follow the space everywhere, portals and modals included
 * (see space-accent.scss). Nothing in a workspace without an accent: Folio's
 * purple stays. Renders nothing.
 */
export function SpaceAccentRoot() {
  const accent = useSpaceAccent();
  const color = accent?.color ?? null;

  useEffect(() => {
    if (!color) return;
    const root = document.documentElement;
    root.classList.add(SPACE_ACCENT_CLASS);
    root.style.setProperty("--space-accent", color);
    return () => {
      root.classList.remove(SPACE_ACCENT_CLASS);
      root.style.removeProperty("--space-accent");
    };
  }, [color]);

  return null;
}
