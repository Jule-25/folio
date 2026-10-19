// Open-record decoration for the inline database.
//
// Paints a highlight on the record whose page is currently OPEN in peek/center
// view — the row you're viewing in the side panel stays marked in the table, so
// you can see which record the panel belongs to. Sibling of the active-cell
// decoration, but scoped to the RECORD node and driven by external view state.
//
// Unlike the active cell (a doc position set by clicks inside ProseMirror),
// this is a pageId set from OUTSIDE — the peek/center view target lives in React
// context. A small effect watches that target and calls setOpenRecord(pageId);
// the plugin finds the databaseRecord node whose recordId matches and decorates
// it. A pageId is stable across doc edits, so there's no position mapping — the
// match is recomputed from the id on every decoration pass.
//
// The painted class is `.db-record-open`.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

export const openRecordPluginKey = new PluginKey<OpenRecordState>(
  "databaseOpenRecord",
);

interface OpenRecordState {
  /** The pageId (== recordId) open in peek/center, or null for none. */
  openId: string | null;
  /** Position of the database block it was opened from — only that block
   *  marks it. null: unknown, every block marks it. */
  from: number | null;
}

interface OpenRecordMeta {
  openId: string | null;
  from: number | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    databaseOpenRecord: {
      /** Mark the databaseRecord with this recordId as open (highlight). */
      setOpenRecord: (
        pageId: string | null,
        /** The database block it was opened from (its position). */
        from?: number | null,
      ) => ReturnType;
      /** Clear the open-record decoration. */
      clearOpenRecord: () => ReturnType;
    };
  }
}

export const DatabaseOpenRecord = Extension.create({
  name: "databaseOpenRecord",

  addCommands() {
    return {
      setOpenRecord:
        (pageId, from = null) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            const meta: OpenRecordMeta = { openId: pageId, from };
            dispatch(tr.setMeta(openRecordPluginKey, meta));
          }
          return true;
        },
      clearOpenRecord:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            const meta: OpenRecordMeta = { openId: null, from: null };
            dispatch(tr.setMeta(openRecordPluginKey, meta));
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<OpenRecordState>({
        key: openRecordPluginKey,

        state: {
          init: () => ({ openId: null, from: null }),

          apply(tr, value) {
            const meta = tr.getMeta(openRecordPluginKey) as
              | OpenRecordMeta
              | undefined;
            if (meta !== undefined) {
              return { openId: meta.openId, from: meta.from };
            }
            // No explicit change — the id is stable across doc edits; the
            // block's position moves with them.
            if (tr.docChanged && value.from != null) {
              return { ...value, from: tr.mapping.map(value.from) };
            }
            return value;
          },
        },

        props: {
          decorations(state) {
            const { openId, from } = this.getState(state) ?? {
              openId: null,
              from: null,
            };
            if (!openId) return DecorationSet.empty;

            const decorations: Decoration[] = [];
            const visit = (node: PMNode, pos: number) => {
              if (
                node.type.name === "databaseRecord" &&
                node.attrs.recordId === openId
              ) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: "db-record-open",
                  }),
                );
                return false; // don't descend into the matched record
              }
              // Only databaseRecord nodes matter; keep descending to find it.
              return undefined;
            };

            // Only inside the block it was opened from, when known.
            const block = from != null ? state.doc.nodeAt(from) : null;
            if (block?.type.name === "database") {
              block.descendants((node, offset) =>
                visit(node, from! + 1 + offset),
              );
            } else {
              state.doc.descendants(visit);
            }

            return decorations.length
              ? DecorationSet.create(state.doc, decorations)
              : DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
