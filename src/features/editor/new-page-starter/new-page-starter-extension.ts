import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// The new-page starter's slot in the document: while a page has only its title
// (and nothing written below it) and the cursor is in the title, a widget sits
// right under the title. NewPageStarter portals its rows into that widget's
// element — this extension only decides where, and handles Enter.
//
// Runtime-only blocks inserted after the title (the page-comment row) don't
// count as content; a database row's property panel turns the starter off.

export interface NewPageStarterStorage {
  /** The widget's element; NewPageStarter renders into it. */
  slot: HTMLElement | null;
}

declare module "@tiptap/core" {
  interface Storage {
    newPageStarter: NewPageStarterStorage;
  }
  interface Commands<ReturnType> {
    newPageStarter: {
      /** Put the cursor at the start of the page body (adding an empty
       *  paragraph when there is none). */
      focusPageBody: () => ReturnType;
    };
  }
}

/** Transaction meta for a sanctioned change of a database page's block
 *  structure (the starter turning a page into a database). The structured
 *  page guard lets it through and takes its result as the new baseline. */
export const RESTRUCTURE_META = "structuredPageGuard:restructure";

const RUNTIME_BLOCKS = new Set(["pageComment"]);
const ROW_PAGE_BLOCK = "recordPropertyPanel";

/** Where the page body starts: the first block after the title that isn't
 *  runtime-only, or the end of the doc. Null when there's no title. */
export function pageBodyStart(doc: ProseMirrorNode): number | null {
  if (doc.firstChild?.type.name !== "title") return null;
  let start: number | null = null;
  doc.forEach((node, offset, index) => {
    if (start !== null || index === 0) return;
    if (RUNTIME_BLOCKS.has(node.type.name)) return;
    if (node.type.name === ROW_PAGE_BLOCK) return;
    start = offset;
  });
  return start ?? doc.content.size;
}

/** Where the starter goes, or null when it shouldn't show: the page has a
 *  title, at most one empty paragraph below it, isn't a database row, and
 *  the cursor is in the title. */
export function starterPosition(state: EditorState): number | null {
  const { doc, selection } = state;
  if (doc.firstChild?.type.name !== "title") return null;
  if (selection.$from.parent.type.name !== "title") return null;

  let bodyBlocks = 0;
  let blank = true;
  doc.forEach((node, _offset, index) => {
    if (index === 0 || !blank) return;
    if (node.type.name === ROW_PAGE_BLOCK) {
      blank = false;
      return;
    }
    if (RUNTIME_BLOCKS.has(node.type.name)) return;
    bodyBlocks += 1;
    if (
      bodyBlocks > 1 ||
      node.type.name !== "paragraph" ||
      node.content.size > 0
    ) {
      blank = false;
    }
  });
  return blank ? pageBodyStart(doc) : null;
}

const newPageStarterKey = new PluginKey("newPageStarter");

function createSlot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const slot = document.createElement("div");
  slot.className = "new-page-starter-slot top-level-block";
  slot.contentEditable = "false";
  return slot;
}

export const NewPageStarterExtension = Extension.create<
  unknown,
  NewPageStarterStorage
>({
  name: "newPageStarter",
  // Ahead of the default keymaps, so Enter in the title is ours while the
  // starter shows.
  priority: 1000,

  // The slot exists from the start, so NewPageStarter has it on its first
  // render (onCreate would come after React's first pass).
  addStorage() {
    return { slot: createSlot() };
  },

  onDestroy() {
    this.storage.slot = null;
  },

  addCommands() {
    return {
      focusPageBody:
        () =>
        ({ tr, state, dispatch }) => {
          const at = pageBodyStart(tr.doc);
          if (at === null) return false;
          if (!dispatch) return true;
          const next = at < tr.doc.content.size ? tr.doc.nodeAt(at) : null;
          if (!next?.isTextblock) {
            tr.insert(at, state.schema.nodes.paragraph.create());
          }
          tr.setSelection(TextSelection.create(tr.doc, at + 1));
          tr.scrollIntoView();
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    const editor = this.editor;

    return [
      new Plugin({
        key: newPageStarterKey,
        props: {
          decorations(state) {
            const slot = storage.slot;
            if (!slot) return null;
            if (editor.storage.structuredPageGuard?.isStructuredActivePage?.())
              return null;
            const pos = starterPosition(state);
            if (pos === null) return null;
            return DecorationSet.create(state.doc, [
              Decoration.widget(pos, () => slot, {
                key: "new-page-starter",
                side: -1,
                ignoreSelection: true,
                stopEvent: () => true,
              }),
            ]);
          },

          // "Press Enter to continue with an empty page" — only while the
          // starter is actually showing (NewPageStarter filled the slot).
          handleKeyDown(view, event) {
            if (event.key !== "Enter" || event.isComposing) return false;
            if (
              event.shiftKey ||
              event.metaKey ||
              event.ctrlKey ||
              event.altKey
            )
              return false;
            const slot = storage.slot;
            if (!slot?.isConnected || slot.childElementCount === 0)
              return false;
            if (starterPosition(view.state) === null) return false;
            return editor.commands.focusPageBody();
          },
        },
      }),
    ];
  },
});
