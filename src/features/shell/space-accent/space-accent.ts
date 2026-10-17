import { useMemo, type CSSProperties } from "react";
import { useCurrentSpace } from "src/hooks/use-current-space";
import { teamspaceTint } from "src/lib/teamspace-color";
import "./space-accent.scss";
import { useCurrentWorkspace } from "src/hooks/use-workspaces";
import { useTeamspaceAccentColor } from "src/hooks/use-teamspaces";

/** Takes the brand colour over with the space's colour (see the SCSS). */
export const SPACE_ACCENT_CLASS = "space-accent";

/**
 * The current space's colour: inside a teamspace, the teamspace's (chosen,
 * else its icon's, else one from its id); in your workspace, its chosen
 * accent, or nothing (Folio's purple). Returns the class and the
 * `--space-accent` variable to put on an element, and the colour.
 * SpaceAccentRoot puts them on <html> for the whole app.
 */
export function useSpaceAccent(): {
  className: string;
  style: CSSProperties;
  /** The space's colour itself. */
  color: string;
} | null {
  const space = useCurrentSpace();
  const page = space.kind === "teamspace" ? space.page : null;
  const { workspace } = useCurrentWorkspace();
  const chosen = useTeamspaceAccentColor(page?.id ?? null);
  const color = page
    ? teamspaceTint(page, chosen)
    : (workspace?.settings.accentColor ?? null);
  return useMemo(
    () =>
      color
        ? {
            className: SPACE_ACCENT_CLASS,
            style: { "--space-accent": color } as CSSProperties,
            color,
          }
        : null,
    [color],
  );
}
