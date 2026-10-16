import { useCallback } from "react";
import { useLocation } from "@tanstack/react-location";
import type { ID, Page } from "src/types";
import { usePagesBase } from "src/hooks/use-pages";
import { teamspaceIdFromPath } from "src/hooks/use-current-space";
import { DynamicIcon } from "src/features/pages/cover/dynamic-icon";

// A small tile on the corner of a page row's icon showing which teamspace
// the page belongs to: the teamspace's emoji or icon, else its initial.
// Shown outside that teamspace only; inside it the badge says nothing new.
export function TeamspaceBadge({ teamspaceId }: { teamspaceId: ID }) {
  const location = useLocation();
  const currentTeamspaceId = teamspaceIdFromPath(location.current.pathname);

  // The teamspace's root page carries its name and icon.
  const selectRoot = useCallback(
    (pages: Page[]) => pages.find((p) => p.id === teamspaceId) ?? null,
    [teamspaceId],
  );
  const { data: root } = usePagesBase(selectRoot);

  if (currentTeamspaceId === teamspaceId || !root) return null;

  const name = root.title || "";
  const { cover } = root;
  const hasGlyph = Boolean(cover.iconName);

  let content: React.ReactNode;
  if (hasGlyph && cover.target === "Emoji") {
    content = <span className="teamspace-badge__emoji">{cover.iconName}</span>;
  } else if (hasGlyph && cover.target === "Icons") {
    content = (
      <DynamicIcon
        name={cover.iconName!}
        size={9}
        style={{
          width: 16,
          height: 16,
          color:
            !cover.color || cover.color === "var(--tt-text-color)"
              ? "currentColor"
              : cover.color,
        }}
      />
    );
  } else {
    content = name.charAt(0).toUpperCase() || "T";
  }

  return (
    <span
      className={`teamspace-badge teamspace-badge--${hasGlyph ? "glyph" : "initial"}`}
      title={name}
      aria-label={name}
      role="img"
    >
      {content}
    </span>
  );
}
