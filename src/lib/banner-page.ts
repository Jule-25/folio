import type { ID, Page } from "src/types";

/** Can this page be a workspace's Home banner? Everyone in the workspace
 *  must be able to open it, so: the workspace's own page (not a teamspace's),
 *  not a database row, not in the trash, open to the whole workspace. */
export function canBeWorkspaceBanner(
  page: Page,
  workspaceId: ID | null | undefined,
) {
  return (
    !!workspaceId &&
    page.workspaceId === workspaceId &&
    !page.teamspaceId &&
    !page.sourceId &&
    !page.deletedAt &&
    (page.generalAccess === "workspace" || page.generalAccess === "public")
  );
}
