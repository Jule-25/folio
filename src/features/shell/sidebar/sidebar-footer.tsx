import { memo } from "react";
import { SidebarDock } from "./sidebar-dock";
import "./sidebar-footer.scss";

// Pinned under the page tree: the dock (Home · Inbox · Chats · Search ·
// account).
export const SidebarFooter = memo(() => {
  return (
    <div className="sb-footer">
      <SidebarDock />
    </div>
  );
});
SidebarFooter.displayName = "SidebarFooter";
