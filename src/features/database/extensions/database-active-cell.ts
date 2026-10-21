// Active cell and cell range for the inline database's table.
//
// The ACTIVE cell gets a ring + corner dot, the way Notion highlights the
// cell you just edited or clicked into. A RANGE is a rectangle of cells
// grown from it: drag the corner dot, or Shift+click another cell. Both are
// DECORATIONS, not a ProseMirror selection: purely visual, they never steal
// the selection or block typing.
//
// State: the active cell's position (just BEFORE its databaseCell node) and
// the positions of the cells in the range (empty = just the active cell).
// Positions are mapped through every transaction; ones that no longer sit on
// a databaseCell are dropped.
//
// With a cell active (keys are listened for on the document: after a cell
// editor closes, focus is on the page body):
//   ← ↑ → ↓, Tab / Shift+Tab   move the active cell (clears the range)
//   Enter                      open the active cell's editor
//   Esc                        clear the range, then the active cell
//   Ctrl/⌘+C                   copy the cell, or the range as rows and tabs
//   Ctrl/⌘+V                   paste: one value fills the whole range; rows
//                              and tabs from a spreadsheet fill down and right
//   Delete / Backspace         empty the cell or the range
//
// Painted classes: `.db-cell-active` and `.db-cell-in-range`.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { cellClipboard, cellKey } from "../utils/cell-clipboard";

export const activeCellPluginKey = new PluginKey<ActiveCellState>(
  "databaseActiveCell",
);

interface ActiveCellState {
  /** Position just before the active databaseCell node, or null for none. */
  active: number | null;
  /** Cells of the range, the active one included; empty for none. */
  range: number[];
}

/** Meta payload on a transaction to change the active cell / range. */
interface ActiveCellMeta {
  /** New active position, or null to clear (clears the range too). */
  active?: number | null;
  /** New range; left out = cleared when `active` is set, else kept. */
  range?: number[];
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
function isCellAt(doc: PMNode, pos: number): boolean {
  if (pos < 0 || pos > doc.content.size) return false;
  const node = doc.nodeAt(pos);
  return !!node && node.type.name === "databaseCell";
}

// ── Cells on screen ─────────────────────────────────────────────────────────

type Direction = "up" | "down" | "left" | "right";

/** A cell's own box (its .db-node-cell; the wrappers around it are
 *  display: contents and have no size). */
function cellElement(view: EditorView, pos: number): HTMLElement | null {
  const dom = view.nodeDOM(pos);
  if (!(dom instanceof HTMLElement)) return null;
  return dom.querySelector<HTMLElement>(".db-node-cell") ?? dom;
}

/** The databaseCell node owning a .db-node-cell box. */
function cellPosOf(view: EditorView, el: HTMLElement): number | null {
  const p = view.posAtDOM(el, 0);
  if (view.state.doc.nodeAt(p)?.type.name === "databaseCell") return p;
  const $p = view.state.doc.resolve(p);
  for (let depth = $p.depth; depth > 0; depth--) {
    if ($p.node(depth).type.name === "databaseCell") return $p.before(depth);
  }
  return null;
}

/** The table's visible cell boxes. */
function tableCells(from: HTMLElement): HTMLElement[] {
  const table = from.closest(".db-table");
  if (!table) return [];
  return Array.from(
    table.querySelectorAll<HTMLElement>(".db-node-cell"),
  ).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

/**
 * The cell next to the one at `pos` in `dir`, found by where cells are ON
 * SCREEN: rows are placed by their sorted order (grid-row), not their order
 * in the doc, and hidden columns have no box. Tables only.
 */
function neighbourCell(
  view: EditorView,
  pos: number,
  dir: Direction,
): number | null {
  const from = cellElement(view, pos);
  if (!from) return null;

  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const vertical = dir === "up" || dir === "down";

  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of tableCells(from)) {
    if (el === from) continue;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - ax;
    const dy = r.top + r.height / 2 - ay;
    const along =
      dir === "down" ? dy : dir === "up" ? -dy : dir === "right" ? dx : -dx;
    const across = Math.abs(vertical ? dx : dy);
    if (along <= 1) continue; // behind us
    if (across > (vertical ? a.width : a.height) / 2) continue; // other line
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best ? cellPosOf(view, best) : null;
}

/**
 * The cells of the rectangle spanned by the cells at `a` and `b`, as rows
 * (top to bottom) of positions (left to right).
 */
function cellsBetween(view: EditorView, a: number, b: number): number[][] {
  const elA = cellElement(view, a);
  const elB = cellElement(view, b);
  if (!elA || !elB) return [];
  const ra = elA.getBoundingClientRect();
  const rb = elB.getBoundingClientRect();
  const left = Math.min(ra.left, rb.left);
  const right = Math.max(ra.right, rb.right);
  const top = Math.min(ra.top, rb.top);
  const bottom = Math.max(ra.bottom, rb.bottom);

  const inside = tableCells(elA)
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => {
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      return x > left && x < right && y > top && y < bottom;
    })
    .sort((p, q) => p.r.top - q.r.top || p.r.left - q.r.left);

  const rows: { y: number; cells: number[] }[] = [];
  for (const { el, r } of inside) {
    const pos = cellPosOf(view, el);
    if (pos === null) continue;
    const y = r.top + r.height / 2;
    const row = rows.find((line) => Math.abs(line.y - y) < r.height / 2);
    if (row) row.cells.push(pos);
    else rows.push({ y, cells: [pos] });
  }
  return rows.map((row) => row.cells);
}

/** The range as rows, or just the active cell. */
function selectionRows(view: EditorView, state: ActiveCellState): number[][] {
  if (state.active === null) return [];
  if (state.range.length < 2) return [[state.active]];
  const first = state.range[0];
  const last = state.range[state.range.length - 1];
  const rows = cellsBetween(view, first, last);
  return rows.length ? rows : [[state.active]];
}

/** Copy / paste handlers of the cell at `pos` (see utils/cell-clipboard). */
function clipboardAt(view: EditorView, pos: number) {
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

/** Typing somewhere else (a cell editor, a menu's search, another editor). */
function typingElsewhere(view: EditorView, target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (!!el.closest(
      "input, textarea, select, [data-radix-popper-content-wrapper]",
    ) ||
      (el.isContentEditable && el !== view.dom))
  );
}

/** The active cell's corner dot: the bottom-right 12px of its box. */
const CORNER = 12;

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
          init: () => ({ active: null, range: [] }),

          apply(tr, value) {
            const meta = tr.getMeta(activeCellPluginKey) as
              | ActiveCellMeta
              | undefined;
            if (meta !== undefined) {
              if (meta.active === null) return { active: null, range: [] };
              const active =
                meta.active === undefined
                  ? value.active
                  : isCellAt(tr.doc, meta.active)
                    ? meta.active
                    : null;
              if (active === null) return { active: null, range: [] };
              const range =
                meta.range !== undefined
                  ? meta.range.filter((p) => isCellAt(tr.doc, p))
                  : meta.active === undefined
                    ? value.range
                    : [];
              return { active, range };
            }

            if (value.active === null || !tr.docChanged) return value;
            const mapped = tr.mapping.map(value.active, -1);
            if (!isCellAt(tr.doc, mapped)) return { active: null, range: [] };
            return {
              active: mapped,
              range: value.range
                .map((p) => tr.mapping.map(p, -1))
                .filter((p) => isCellAt(tr.doc, p)),
            };
          },
        },

        view(editorView) {
          const getState = () =>
            activeCellPluginKey.getState(editorView.state) ?? {
              active: null,
              range: [],
            };
          const set = (meta: ActiveCellMeta) =>
            editorView.dispatch(
              editorView.state.tr.setMeta(activeCellPluginKey, meta),
            );
          const rangeOf = (from: number, to: number) =>
            cellsBetween(editorView, from, to).flat();

          // ── Keys ──
          const onKey = (event: KeyboardEvent) => {
            const state = getState();
            const active = state.active;
            if (active === null) return;
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            if (typingElsewhere(editorView, event.target)) return;

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
              set({ active: next });
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
              set(state.range.length > 1 ? { range: [] } : { active: null });
            } else if (event.key === "Delete" || event.key === "Backspace") {
              event.preventDefault();
              event.stopPropagation();
              for (const pos of selectionRows(editorView, state).flat()) {
                clipboardAt(editorView, pos)?.paste("");
              }
            }
          };

          // ── Copy / paste: the events, not the keys — they carry the
          //    clipboard with no permission prompt ──
          const activeFor = (event: Event) => {
            const state = getState();
            if (state.active === null) return null;
            if (typingElsewhere(editorView, event.target)) return null;
            // Text selected on the page: let the browser copy that.
            if (!window.getSelection()?.isCollapsed) return null;
            return state;
          };

          const onCopy = (event: ClipboardEvent) => {
            const state = activeFor(event);
            if (!state) return;
            const text = selectionRows(editorView, state)
              .map((row) =>
                row
                  .map((pos) => clipboardAt(editorView, pos)?.copyText() ?? "")
                  .join("\t"),
              )
              .join("\n");
            event.preventDefault();
            event.clipboardData?.setData("text/plain", text);
          };

          const onPaste = (event: ClipboardEvent) => {
            const state = activeFor(event);
            if (!state || state.active === null) return;
            const text = event.clipboardData?.getData("text/plain");
            if (text == null) return;
            event.preventDefault();
            const rows = text
              .replace(/\r/g, "")
              .replace(/\n$/, "")
              .split("\n")
              .map((row) => row.split("\t"));

            // One value and a range: fill every cell of the range with it.
            if (rows.length === 1 && rows[0].length === 1) {
              for (const pos of selectionRows(editorView, state).flat()) {
                clipboardAt(editorView, pos)?.paste(rows[0][0]);
              }
              return;
            }

            // A block: fill down and right from the range's first cell.
            let rowStart: number | null = state.range[0] ?? state.active;
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

          // ── Growing a range: drag the corner dot, or Shift+click ──
          let dragFrom: number | null = null;
          let swallowClick = false;

          const cellUnder = (x: number, y: number) => {
            const el = document
              .elementFromPoint(x, y)
              ?.closest<HTMLElement>(".db-table .db-node-cell");
            return el && editorView.dom.contains(el)
              ? cellPosOf(editorView, el)
              : null;
          };

          const onPointerDown = (event: PointerEvent) => {
            const { active } = getState();
            if (active === null || event.button !== 0) return;
            const box = cellElement(editorView, active);
            if (!box?.closest(".db-table")) return;

            // Shift+click another cell: the range from the active one to it.
            if (event.shiftKey) {
              const to = cellUnder(event.clientX, event.clientY);
              if (to === null || to === active) return;
              event.preventDefault();
              event.stopPropagation();
              swallowClick = true;
              set({ range: rangeOf(active, to) });
              return;
            }

            const r = box.getBoundingClientRect();
            const onCorner =
              event.clientX >= r.right - CORNER &&
              event.clientX <= r.right + 2 &&
              event.clientY >= r.bottom - CORNER &&
              event.clientY <= r.bottom + 2;
            if (!onCorner) return;
            event.preventDefault();
            event.stopPropagation();
            swallowClick = true;
            dragFrom = active;
          };

          const onPointerMove = (event: PointerEvent) => {
            if (dragFrom === null) return;
            const to = cellUnder(event.clientX, event.clientY);
            if (to === null) return;
            set({ range: to === dragFrom ? [] : rangeOf(dragFrom, to) });
          };

          const onPointerUp = () => {
            dragFrom = null;
          };

          // The click that ends a corner drag or a Shift+click mustn't open
          // the cell's editor.
          const onClick = (event: MouseEvent) => {
            if (!swallowClick) return;
            swallowClick = false;
            event.preventDefault();
            event.stopPropagation();
          };

          // Capture: run before the editor and the cells handle them.
          const listeners: [string, EventListener][] = [
            ["keydown", onKey as EventListener],
            ["copy", onCopy as EventListener],
            ["paste", onPaste as EventListener],
            ["pointerdown", onPointerDown as EventListener],
            ["pointermove", onPointerMove as EventListener],
            ["pointerup", onPointerUp as EventListener],
            ["click", onClick as EventListener],
          ];
          for (const [type, fn] of listeners) {
            document.addEventListener(type, fn, true);
          }
          return {
            destroy: () => {
              for (const [type, fn] of listeners) {
                document.removeEventListener(type, fn, true);
              }
            },
          };
        },

        props: {
          decorations(state) {
            const { active, range } = this.getState(state) ?? {
              active: null,
              range: [],
            };
            if (active === null) return DecorationSet.empty;

            const decorations: Decoration[] = [];
            for (const pos of range) {
              if (pos === active) continue;
              const node = state.doc.nodeAt(pos);
              if (node?.type.name !== "databaseCell") continue;
              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: "db-cell-in-range",
                }),
              );
            }
            const node = state.doc.nodeAt(active);
            if (node?.type.name === "databaseCell") {
              decorations.push(
                Decoration.node(active, active + node.nodeSize, {
                  class:
                    range.length > 1
                      ? "db-cell-active db-cell-in-range"
                      : "db-cell-active",
                }),
              );
            }
            return DecorationSet.create(state.doc, decorations);
          },

          // Clicking a cell makes it the active one (and drops the range).
          handleClick(view, pos, event) {
            if (event.shiftKey) return false; // grows the range instead
            const $pos = view.state.doc.resolve(pos);
            for (let depth = $pos.depth; depth > 0; depth--) {
              if ($pos.node(depth).type.name === "databaseCell") {
                const cellPos = $pos.before(depth);
                const cur = activeCellPluginKey.getState(view.state);
                if (cur?.active !== cellPos || (cur?.range.length ?? 0) > 1) {
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
