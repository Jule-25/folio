export const columnKeyAtPoint = (
  grid: HTMLElement,
  x: number,
): string | null => {
  const marked = grid.querySelectorAll<HTMLElement>("[data-col-key]");
  let best: { key: string; dist: number } | null = null;
  for (const el of marked) {
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right) return el.getAttribute("data-col-key");
    const cx = (r.left + r.right) / 2;
    const d = Math.abs(x - cx);
    const key = el.getAttribute("data-col-key");
    if (key && (!best || d < best.dist)) best = { key, dist: d };
  }
  return best?.key ?? null;
};

export const beforeCardAtPoint = (
  grid: HTMLElement,
  columnKey: string,
  y: number,
  skipId: string,
): string | null => {
  const cards = Array.from(
    grid.querySelectorAll<HTMLElement>(
      `[data-record-id][data-col-key="${columnKey}"]`,
    ),
  ).filter((c) => c.getAttribute("data-record-id") !== skipId);
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    if (y < r.top + r.height / 2) return c.getAttribute("data-record-id");
  }
  return null;
};

// ── Gallery ─────────────────────────────────────────────────────────────────

/** Only the record wrappers: the card inside (.db-board-card) carries the
 *  same data-type / data-record-id, and counting both put every card in the
 *  list twice. */
const GALLERY_CARD = ".db-record--card[data-record-id]";

/**
 * A gallery's visible cards, minus the one being dragged, in reading order,
 * grouped into rows. CSS `order` places the cards, so DOM order isn't the
 * order on screen.
 */
function galleryRows(gallery: HTMLElement, skipId: string): HTMLElement[][] {
  const cards = Array.from(gallery.querySelectorAll<HTMLElement>(GALLERY_CARD))
    .filter(
      (card) =>
        card.dataset.recordId !== skipId && card.getClientRects().length > 0,
    )
    .map((card) => ({ card, rect: card.getBoundingClientRect() }))
    .sort((a, b) =>
      Math.abs(a.rect.top - b.rect.top) > 2
        ? a.rect.top - b.rect.top
        : a.rect.left - b.rect.left,
    );

  const rows: { top: number; cards: HTMLElement[] }[] = [];
  for (const { card, rect } of cards) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row.top - rect.top) <= 2) row.cards.push(card);
    else rows.push({ top: rect.top, cards: [card] });
  }
  return rows.map((r) => r.cards);
}

export interface GalleryDropTarget {
  /** The card the dragged one goes before; null = at the very end. */
  beforeRecordId: string | null;
  /** Where to draw the drop line: beside this card, on this side. */
  card: HTMLElement | null;
  side: "before" | "after";
}

/**
 * Where a card dropped at (clientX, clientY) lands. Gaps count too: the
 * pointer picks the row it's in (or, between two rows, the row below), then
 * the slot by the cards' horizontal middles. Dropping right of a row's last
 * card puts it after that card, which is before the next row's first.
 */
export function galleryDropTarget(
  gallery: HTMLElement,
  clientX: number,
  clientY: number,
  skipId: string,
): GalleryDropTarget {
  const rows = galleryRows(gallery, skipId);
  const rowIndex = rows.findIndex((row) =>
    row.some((card) => clientY <= card.getBoundingClientRect().bottom),
  );

  // Below every row (or no cards at all): at the end, after the last card.
  if (rowIndex === -1) {
    const last = rows[rows.length - 1]?.at(-1) ?? null;
    return { beforeRecordId: null, card: last, side: "after" };
  }

  const row = rows[rowIndex];
  for (const card of row) {
    const r = card.getBoundingClientRect();
    if (clientX < r.left + r.width / 2) {
      return {
        beforeRecordId: card.dataset.recordId ?? null,
        card,
        side: "before",
      };
    }
  }

  const lastInRow = row[row.length - 1];
  const nextRowFirst = rows[rowIndex + 1]?.[0];
  return {
    beforeRecordId: nextRowFirst?.dataset.recordId ?? null,
    card: lastInRow,
    side: "after",
  };
}

/** The drop line beside `card`, on `side`; hidden when there's no card. */
export function showGalleryDropIndicator(
  gallery: HTMLElement,
  card: HTMLElement | null,
  side: "before" | "after",
): void {
  if (!card) {
    hideGalleryDropIndicator(gallery);
    return;
  }
  const indicator = getGalleryDropIndicator(gallery);
  const galleryRect = gallery.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();

  // Half the 16px gap: the line sits in the middle of it.
  const x =
    side === "before"
      ? cardRect.left - galleryRect.left - 9
      : cardRect.right - galleryRect.left + 7;

  indicator.style.height = `${cardRect.height}px`;
  indicator.style.transform = `translate3d(${x}px, ${cardRect.top - galleryRect.top}px, 0)`;
  indicator.style.display = "block";
}

export function beforeRecordAtPoint(
  container: HTMLElement,
  clientY: number,
  draggingId: string,
): string | null {
  const cards = Array.from(
    container.querySelectorAll<HTMLElement>("[data-record-id]"),
  ).filter((el) => el.dataset.recordId !== draggingId);

  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    if (clientY < midpoint) {
      return card.dataset.recordId ?? null;
    }
  }

  return null;
}

export function getGalleryDropIndicator(gallery: HTMLElement): HTMLElement {
  let indicator = gallery.querySelector<HTMLElement>(
    ".db-gallery-drop-indicator",
  );

  if (!indicator) {
    indicator = document.createElement("div");
    indicator.className = "db-gallery-drop-indicator";
    gallery.appendChild(indicator);
  }

  return indicator;
}

export function hideGalleryDropIndicator(gallery: HTMLElement): void {
  const indicator = gallery.querySelector<HTMLElement>(
    ".db-gallery-drop-indicator",
  );

  if (indicator) {
    indicator.style.display = "none";
  }
}
