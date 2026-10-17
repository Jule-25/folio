import { useMemo, type CSSProperties } from "react";
import { useCurrentSpace } from "src/hooks/use-current-space";
import { teamspaceTint } from "src/lib/teamspace-color";
import "./space-accent.scss";
import { useCurrentWorkspace } from "src/hooks/use-workspaces";
import { useTeamspaceAccentColor } from "src/hooks/use-teamspaces";

/** Takes the brand colour over with the space's colour (see the SCSS). */
export const SPACE_ACCENT_CLASS = "space-accent";

/**
 * Inside a teamspace, the space wears the teamspace's colour: the dock at
 * the foot of the sidebar, and on Home its hero, New page, tabs and links.
 * Returns the class and the `--space-accent` variable to put on such an
 * element, or nothing in your own workspace (which keeps Folio's purple).
 */
export function useSpaceAccent(): {
  className: string;
  style: CSSProperties;
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
          }
        : null,
    [color],
  );
}
