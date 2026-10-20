// Which database block a record was opened FROM, so only that block marks
// the open record (extensions/database-open-record.ts). The same record can
// show in several blocks on a page (a linked view, the same view placed
// twice); opening it from one shouldn't mark it in the others.
//
// A record is opened by a click, so its block is the one the last pointerdown
// inside a database landed in. Opened any other way (sidebar, relation, link)
// there's no opener, and every block marks it, as before.

let lastPointerBlock: Element | null = null;
let opener: { pageId: string; block: Element } | null = null;

if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (e) => {
      const block = (e.target as Element | null)?.closest?.(
        ".react-renderer.node-database",
      );
      // Only clicks inside a database: a menu item ("Open in side peek") is
      // portaled outside it, and must keep the block its menu was opened in.
      if (block) lastPointerBlock = block;
    },
    true,
  );
}

/** Call when a database view opens a record (useOpenRecord, card menu). */
export function noteRecordOpener(pageId: string) {
  opener = lastPointerBlock ? { pageId, block: lastPointerBlock } : null;
}

/** The block `pageId` was opened from, or null when unknown. */
export function recordOpenerBlock(pageId: string): Element | null {
  return opener?.pageId === pageId ? opener.block : null;
}