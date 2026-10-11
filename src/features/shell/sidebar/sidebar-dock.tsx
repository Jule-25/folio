import { memo, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-location";
import {
  SbChatsIcon,
  SbHomeIcon,
  SbInboxIcon,
  SbSearchIcon,
} from "src/components/tiptap-icons/sidebar-icons";
import { TbX } from "src/components/tiptap-icons/tabler-icons";
import { useNotificationState } from "src/features/inbox/notification/notification-context";
import { useMyWorkspaceInvites } from "src/hooks/use-workspace-members";
import { useUnreadCounts } from "src/hooks/use-chat";
import { spaceHomePath, useCurrentSpace } from "src/hooks/use-current-space";
import { useIsMobile } from "src/hooks/use-breakpoint";
import { isMac } from "src/lib/tiptap-utils";
import { requestFindFocus } from "src/lib/find-store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "src/components/tiptap-ui-primitive/tooltip";
import { useEditorLayout } from "../context/editor-layout-context";
import { SidebarSearchInput } from "./sidebar-search-input";
import { SidebarAccount } from "./sidebar-account";
import "./sidebar-dock.scss";

const DOCK_ICON = { size: 18, strokeWidth: 1.8 } as const;

function DockTab({
  icon,
  label,
  active = false,
  count = 0,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <Tooltip delay={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="tab"
          aria-selected={active}
          aria-label={count > 0 ? `${label} (${count})` : label}
          className={`sb-dock__tab${active ? " is-active" : ""}`}
          onClick={onClick}
        >
          {icon}
          {count > 0 && (
            <span className="sb-dock__badge" aria-hidden>
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// The dock at the foot of the sidebar: Home · Inbox · Chats · Search, then
// your account. Each tab swaps what the sidebar body shows; Inbox and Chats
// carry red unread badges. Home again while already on Home goes to the
// space's home page. Search opens the find row at the top (SidebarFind).
export const SidebarDock = memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const space = useCurrentSpace();
  const { sidebarView, setSidebarView, onCollapsedChange } = useEditorLayout();

  const { unreadCount } = useNotificationState();
  // Workspace invitations count as something waiting in the inbox.
  const { data: invites = [] } = useMyWorkspaceInvites();
  const { data: chatUnread = {} } = useUnreadCounts();
  const chatTotal = useMemo(
    () => Object.values(chatUnread).reduce((a, b) => a + b, 0),
    [chatUnread],
  );

  const findShortcut = isMac() ? "⌘⇧F" : "Ctrl+Shift+F";

  const goHome = () => {
    if (sidebarView === "pages") {
      const teamspaceId = space.kind === "teamspace" ? space.id : null;
      navigate({ to: spaceHomePath(teamspaceId) });
      if (isMobile) onCollapsedChange(true);
      return;
    }
    setSidebarView("pages");
  };

  const openSearch = () => {
    setSidebarView("search");
    requestAnimationFrame(() => requestFindFocus());
  };

  return (
    <div
      className="sb-dock"
      role="tablist"
      aria-label={t("sidebar.navigation", "Sidebar")}
    >
      <DockTab
        icon={<SbHomeIcon {...DOCK_ICON} />}
        label={t("sidebar.home", "Home")}
        active={sidebarView === "pages" || sidebarView === "teams"}
        onClick={goHome}
      />
      <DockTab
        icon={<SbInboxIcon {...DOCK_ICON} />}
        label={t("sidebar.inbox", "Inbox")}
        active={sidebarView === "inbox"}
        count={unreadCount + invites.length}
        onClick={() => setSidebarView("inbox")}
      />
      <DockTab
        icon={<SbChatsIcon {...DOCK_ICON} />}
        label={t("chat.title", "Chats")}
        active={sidebarView === "chats"}
        count={chatTotal}
        onClick={() => setSidebarView("chats")}
      />
      <DockTab
        icon={<SbSearchIcon {...DOCK_ICON} />}
        label={`${t("find.open", "Search in pages")} (${findShortcut})`}
        active={sidebarView === "search"}
        onClick={openSearch}
      />
      <SidebarAccount compact />
    </div>
  );
});
SidebarDock.displayName = "SidebarDock";

// The find-in-pages row under the top row, shown while searching. It stays
// mounted (hidden) so Ctrl/⌘+Shift+F can focus it at once; × or Esc closes.
export const SidebarFind = memo(() => {
  const { t } = useTranslation();
  const { sidebarView, setSidebarView } = useEditorLayout();
  const isSearching = sidebarView === "search";

  return (
    <div
      className={`sb-find${isSearching ? " is-open" : ""}`}
      aria-hidden={!isSearching}
    >
      <div className="sb-find__inner">
        <SidebarSearchInput />
        <button
          type="button"
          className="sb-find__close"
          aria-label={t("find.close", "Close search")}
          title={t("find.close", "Close search")}
          tabIndex={isSearching ? 0 : -1}
          onClick={() => setSidebarView("pages")}
        >
          <TbX size={16} strokeWidth={1.7} />
        </button>
      </div>
    </div>
  );
});
SidebarFind.displayName = "SidebarFind";
