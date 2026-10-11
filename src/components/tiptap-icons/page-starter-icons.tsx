import { makeLineIcon as icon } from "./line-icon";

// Glyphs for the new-page starter (what a fresh page can become): Templates,
// and one per database view. Same 24×24 line style as the sidebar icons.
//   <PsTableIcon />          → 16px, stroke 1.8

// Templates: a wide block over two small ones.
export const PsTemplateIcon = icon(
  "PsTemplateIcon",
  <>
    <rect x="3" y="3" width="18" height="7" rx="1.5" />
    <rect x="3" y="13" width="7" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
  </>,
);

// Table: a frame with a header row and a first column.
export const PsTableIcon = icon(
  "PsTableIcon",
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M9 10v10" />
  </>,
);

// Board: three columns of uneven height.
export const PsBoardIcon = icon(
  "PsBoardIcon",
  <>
    <rect x="3" y="4" width="5" height="16" rx="1.5" />
    <rect x="10" y="4" width="5" height="10" rx="1.5" />
    <rect x="17" y="4" width="4" height="13" rx="1.5" />
  </>,
);

// List: three rows, each with a small square.
export const PsListIcon = icon(
  "PsListIcon",
  <>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <rect x="3" y="4.5" width="3" height="3" rx=".6" />
    <rect x="3" y="10.5" width="3" height="3" rx=".6" />
    <rect x="3" y="16.5" width="3" height="3" rx=".6" />
  </>,
);

// Gallery: a 2×2 grid of cards.
export const PsGalleryIcon = icon(
  "PsGalleryIcon",
  <>
    <rect x="3" y="4" width="8" height="7" rx="1.5" />
    <rect x="13" y="4" width="8" height="7" rx="1.5" />
    <rect x="3" y="13" width="8" height="7" rx="1.5" />
    <rect x="13" y="13" width="8" height="7" rx="1.5" />
  </>,
);

// Calendar: a page with a header and two rings.
export const PsCalendarIcon = icon(
  "PsCalendarIcon",
  <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </>,
);

// Timeline: staggered bars along a dashed axis.
export const PsTimelineIcon = icon(
  "PsTimelineIcon",
  <>
    <path d="M4 6h9M8 12h10M6 18h8" />
    <path d="M3 3v18" strokeDasharray="2 2" />
  </>,
);

// The › on rows that open a submenu.
export const PsChevronRightIcon = icon(
  "PsChevronRightIcon",
  <path d="m9 18 6-6-6-6" />,
);
