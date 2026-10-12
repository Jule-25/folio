import { makeLineIcon as icon, type LineIconProps } from "./line-icon";

// Folio's own sidebar glyphs, drawn for the Dense list sidebar (design 13)
// its quiet top row (design 18) and bottom dock (design 27): Home, Inbox,
// Chats, Search, the default page icon, and the top row's chevron, collapse
// and plus. Plain inline SVG on a
// 24×24 grid, round caps and joins, no icon library.
// Sidebar rows use them at 16px with a 1.8 stroke, pages at 15px:
//   <SbHomeIcon />                      → 16px, stroke 1.8
//   <SbPageIcon size={15} />
//   <SbInboxIcon strokeWidth={2} />

export type SidebarIconProps = LineIconProps;

// A house: pitched roof and walls in one stroke, a door cut into the floor.
export const SbHomeIcon = icon(
  "SbHomeIcon",
  <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
);

// A tray: slanted sides, a flat floor with a dip where mail lands.
export const SbInboxIcon = icon(
  "SbInboxIcon",
  <>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </>,
);

// A rounded-square speech bubble with two lines of text, tail bottom left.
export const SbChatsIcon = icon(
  "SbChatsIcon",
  <>
    <path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6l-5 4v-4a2 2 0 0 1-2-2z" />
    <path d="M8.5 8.5h7M8.5 12h4" />
  </>,
);

// A magnifier: round lens, short handle to the bottom right.
export const SbSearchIcon = icon(
  "SbSearchIcon",
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);

// A page with a folded top-right corner (pages without their own icon).
export const SbPageIcon = icon(
  "SbPageIcon",
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </>,
);

// The space switcher's chevron.
export const SbChevronDownIcon = icon(
  "SbChevronDownIcon",
  <path d="m6 9 6 6 6-6" />,
);

// Collapse the sidebar: two chevrons pointing left.
export const SbCollapseIcon = icon(
  "SbCollapseIcon",
  <>
    <path d="m11 17-5-5 5-5" />
    <path d="m18 17-5-5 5-5" />
  </>,
);

// Expand it again: the same, pointing right.
export const SbExpandIcon = icon(
  "SbExpandIcon",
  <>
    <path d="m13 17 5-5-5-5" />
    <path d="m6 17 5-5-5-5" />
  </>,
);

// New page, as a square with a pen writing into its top-right corner.
export const SbComposeIcon = icon(
  "SbComposeIcon",
  <>
    <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
    <path d="M17.6 3.4a2 2 0 0 1 2.9 2.9L12 14.8l-3.6.8.8-3.6z" />
  </>,
);

// New page.
export const SbPlusIcon = icon("SbPlusIcon", <path d="M12 5v14M5 12h14" />);

// A top-level row's chevron (points right; rotated when open).
export const SbChevronRightIcon = icon(
  "SbChevronRightIcon",
  <path d="m9 6 6 6-6 6" />,
);
