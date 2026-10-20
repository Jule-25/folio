// Active-cell decoration for the inline database.
//
// Paints a ring + corner-dot on ONE cell at a time — the "active" cell — the
// way Notion highlights the cell you just edited or clicked into. This is a
// DECORATION, not a ProseMirror NodeSelection: it's purely visual, so it never
// steals the selection, never blocks typing, and works the same whether the
// cell edits via inline text or a React popover.
//
// State is a single position (the active cell's `pos`, i.e. the position just
// BEFORE the databaseCell node). Setting a new one replaces the old — one
// active cell at a time, like a selection. The position is mapped through every
// transaction so it stays correct as the doc changes; if the node at that
// position is no longer a databaseCell (deleted / replaced), it clears itself.
//
// Set it from:
//   - a click on a cell (handled here)
//   - the Enter keymap on the cell node (commit → activate)
//   - a cell editor's commit/close callback, via the command below
//
// The painted class is `.db-cell-active`; style the ring + dot against that
// (mirror what .ProseMirror-selectednode used).

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { cellClipboard, cellKey } from "../utils/cell-clipboard";

export const activeCellPluginKey = new PluginKey<ActiveCellState>(
  "databaseActiveCell",
);

interface ActiveCellState {
  /** Position just before the active databaseCell node, or null for none. */
  active: number | null;
}

/** Meta payload on a transaction to change the active cell. */
interface ActiveCellMeta {
  /** New active position, or null to clear. */
  active: number | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    databaseActiveCell: {
      /** Mark the databaseCell at `pos` as active (ring + dot). */
      setActiveCell: (pos: number | null) => ReturnType;
      /** Clear the active-cell decoration. */
      clearActiveCell: () => ReturnType;
    };
  }
}

/** Is there a databaseCell node exactly at `pos`? */
function isCellAt(doc: import("@tiptap/pm/model").Node, pos: number): boolean {
  if (pos < 0 || pos > doc.content.size) return false;
  const node = doc.nodeAt(pos);
  return !!node && node.type.name === "databaseCell";
}

type Direction = "up" | "down" | "left" | "right";

/** The active cell's own box (its .db-node-cell; the wrappers around it are
 *  display: contents and have no size). */
function cellElement(
  view: import("@tiptap/pm/view").EditorView,
  pos: number,
): HTMLElement | null {
  const dom = view.nodeDOM(pos);
  if (!(dom instanceof HTMLElement)) return null;
  return dom.querySelector<HTMLElement>(".db-node-cell") ?? dom;
}

/**
 * The cell next to the one at `pos` in `dir`, found by where cells are ON
 * SCREEN: rows are placed by their sorted order (grid-row), not their order
 * in the doc, and hidden columns have no box. Tables only.
 */
function neighbourCell(
  view: import("@tiptap/pm/view").EditorView,
  pos: number,
  dir: Direction,
): number | null {
  const from = cellElement(view, pos);
  const table = from?.closest(".db-table");
  if (!from || !table) return null;

  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const vertical = dir === "up" || dir === "down";

  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  table.querySelectorAll<HTMLElement>(".db-node-cell").forEach((el) => {
    if (el === from) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return; // hidden
    const dx = r.left + r.width / 2 - ax;
    const dy = r.top + r.height / 2 - ay;
    const along =
      dir === "down" ? dy : dir === "up" ? -dy : dir === "right" ? dx : -dx;
    const across = Math.abs(vertical ? dx : dy);
    if (along <= 1) return; // behind us
    if (across > (vertical ? a.width : a.height) / 2) return; // other column/row
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  });
  if (!best) return null;

  // The cell node that owns that box.
  const p = view.posAtDOM(best, 0);
  if (view.state.doc.nodeAt(p)?.type.name === "databaseCell") return p;
  const $p = view.state.doc.resolve(p);
  for (let depth = $p.depth; depth > 0; depth--) {
    if ($p.node(depth).type.name === "databaseCell") return $p.before(depth);
  }
  return null;
}

/** Copy / paste handlers of the cell at `pos` (see utils/cell-clipboard). */
function clipboardAt(view: import("@tiptap/pm/view").EditorView, pos: number) {
  const node = view.state.doc.nodeAt(pos);
  const { recordId, propertyId } = (node?.attrs ?? {}) as {
    recordId?: string | null;
    propertyId?: string | null;
  };
  return recordId && propertyId
    ? cellClipboard(cellKey(recordId, propertyId))
    : undefined;
}

const ARROW_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export const DatabaseActiveCell = Extension.create({
  name: "databaseActiveCell",

  addCommands() {
    return {
      setActiveCell:
        (pos) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            const meta: ActiveCellMeta = { active: pos };
            dispatch(tr.setMeta(activeCellPluginKey, meta));
          }
          return true;
        },
      clearActiveCell:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            const meta: ActiveCellMeta = { active: null };
            dispatch(tr.setMeta(activeCellPluginKey, meta));
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<ActiveCellState>({
        key: activeCellPluginKey,

        state: {
          init: () => ({ active: null }),

          apply(tr, value) {
            // An explicit set/clear wins.
            const meta = tr.getMeta(activeCellPluginKey) as
              | ActiveCellMeta
              | undefined;
            if (meta !== undefined) {
              if (meta.active === null) return { active: null };
              // Validate it points at a cell in the NEW doc.
              return {
                active: isCellAt(tr.doc, meta.active) ? meta.active : null,
              };
            }

            // No explicit change — map the existing position through this tr.
            if (value.active === null) return value;
            if (!tr.docChanged) return value;

            const mapped = tr.mapping.map(value.active, -1);
            // If the mapped position no longer sits on a cell, drop it.
            return {
              active: isCellAt(tr.doc, mapped) ? mapped : null,
            };
          },
        },
        // Keys for the active cell, listened for on the DOCUMENT: after a
        // cell editor closes, focus is on the page body, not the editor, so
        // the editor's own key handling never sees them.
        view(editorView) {
          const onKey = (event: KeyboardEvent) => {
            const active = activeCellPluginKey.getState(
              editorView.state,
            )?.active;
            if (active === null || active === undefined) return;
            if (event.metaKey || event.ctrlKey || event.altKey) return;

            // Someone is typing somewhere (a cell editor, a menu's search,
            // another editor): leave their keys alone.
            const target = event.target as HTMLElement | null;
            if (
              target &&
              (target.closest(
                "input, textarea, select, [data-radix-popper-content-wrapper]",
              ) ||
                (target.isContentEditable && target !== editorView.dom))
            ) {
              return;
            }

            const setActive = (pos: number | null) => {
              const meta: ActiveCellMeta = { active: pos };
              editorView.dispatch(
                editorView.state.tr.setMeta(activeCellPluginKey, meta),
              );
            };

            const dir: Direction | undefined =
              event.key === "Tab"
                ? event.shiftKey
                  ? "left"
                  : "right"
                : ARROW_DIRECTION[event.key];

            if (dir) {
              const next = neighbourCell(editorView, active, dir);
              if (next === null) return; // not in a table, or at the edge
              event.preventDefault();
              event.stopPropagation();
              setActive(next);
              cellElement(editorView, next)?.scrollIntoView({
                block: "nearest",
                inline: "nearest",
              });
            } else if (event.key === "Enter") {
              const opener = cellElement(
                editorView,
                active,
              )?.querySelector<HTMLElement>(
                ".db-cell-editor__display, button, [role='button'], input[type='checkbox']",
              );
              if (!opener) return;
              event.preventDefault();
              event.stopPropagation();
              opener.click();
            } else if (event.key === "Escape") {
              setActive(null);
            }
          };

          // Ctrl/⌘+C and Ctrl/⌘+V on the active cell. The copy/paste
          // EVENTS, not the keys: they carry the clipboard with no
          // permission prompt.
          const activeFor = (event: ClipboardEvent) => {
            const active = activeCellPluginKey.getState(
              editorView.state,
            )?.active;
            if (active === null || active === undefined) return null;
            const target = event.target as HTMLElement | null;
            if (
              target &&
              (target.closest(
                "input, textarea, select, [data-radix-popper-content-wrapper]",
              ) ||
                (target.isContentEditable && target !== editorView.dom))
            ) {
              return null;
            }
            // Text selected on the page: let the browser copy that.
            if (!window.getSelection()?.isCollapsed) return null;
            return active;
          };

          const onCopy = (event: ClipboardEvent) => {
            const active = activeFor(event);
            if (active === null) return;
            const text = clipboardAt(editorView, active)?.copyText();
            if (text === undefined) return;
            event.preventDefault();
            event.clipboardData?.setData("text/plain", text);
          };

          // One value fills the active cell; rows and tabs copied from a
          // spreadsheet fill down and to the right from it. Values that don't
          // fit a column (an unknown option, text in a number…) are skipped.
          const onPaste = (event: ClipboardEvent) => {
            const active = activeFor(event);
            if (active === null) return;
            const text = event.clipboardData?.getData("text/plain");
            if (text == null) return;
            event.preventDefault();
            const rows = text
              .replace(/\r/g, "")
              .replace(/\n$/, "")
              .split("\n")
              .map((row) => row.split("\t"));
            let rowStart: number | null = active;
            for (const row of rows) {
              if (rowStart === null) break;
              let cell: number | null = rowStart;
              for (const value of row) {
                if (cell === null) break;
                clipboardAt(editorView, cell)?.paste(value);
                cell = neighbourCell(editorView, cell, "right");
              }
              rowStart = neighbourCell(editorView, rowStart, "down");
            }
          };

          // Capture: run before the editor moves its text cursor.
          document.addEventListener("keydown", onKey, true);
          document.addEventListener("copy", onCopy, true);
          document.addEventListener("paste", onPaste, true);
          return {
            destroy: () => {
              document.removeEventListener("keydown", onKey, true);
              document.removeEventListener("copy", onCopy, true);
              document.removeEventListener("paste", onPaste, true);
            },
          };
        },
        props: {
          decorations(state) {
            const { active } = this.getState(state) ?? { active: null };
            if (active === null) return DecorationSet.empty;

            const node = state.doc.nodeAt(active);
            if (!node || node.type.name !== "databaseCell") {
              return DecorationSet.empty;
            }

            return DecorationSet.create(state.doc, [
              Decoration.node(active, active + node.nodeSize, {
                class: "db-cell-active",
              }),
            ]);
          },

          // Clicking a cell makes it the active one.
          handleClick(view, pos) {
            const $pos = view.state.doc.resolve(pos);
            for (let depth = $pos.depth; depth > 0; depth--) {
              if ($pos.node(depth).type.name === "databaseCell") {
                const cellPos = $pos.before(depth);
                const cur = activeCellPluginKey.getState(view.state)?.active;
                if (cur !== cellPos) {
                  const meta: ActiveCellMeta = { active: cellPos };
                  view.dispatch(
                    view.state.tr.setMeta(activeCellPluginKey, meta),
                  );
                }
                // Return false: don't consume the click — the cell still gets
                // to focus / open its editor as normal.
                return false;
              }
            }
            // Clicked outside any cell → clear.
            const cur = activeCellPluginKey.getState(view.state)?.active;
            if (cur !== null && cur !== undefined) {
              const meta: ActiveCellMeta = { active: null };
              view.dispatch(view.state.tr.setMeta(activeCellPluginKey, meta));
            }
            return false;
          },
        },
      }),
    ];
  },
});
