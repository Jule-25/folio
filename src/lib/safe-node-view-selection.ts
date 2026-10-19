import { ReactNodeView } from "@tiptap/react";

// ─────────────────────────────────────────────────────────────────────────────
// Guard for a crash inside Tiptap's React node views:
//
//   TypeError: Cannot read properties of undefined (reading 'size')
//     at NodeViewDesc.posBeforeChild … ← getPos() ← handleSelectionUpdate (rAF)
//
// Every React node view re-checks, one frame after each selection change,
// whether the selection covers it (to show it as selected). It asks
// ProseMirror for its position — and when its DOM has just been replaced
// (a block inserted next to it, a collaborative update rebuilding it) the view
// is no longer in ProseMirror's tree, and that lookup throws instead of
// returning undefined. The editor stops responding until a reload.
//
// This is the same check (@tiptap/react 3.x, ReactNodeView
// .handleSelectionUpdate), with the position lookup guarded: a node view that
// isn't in the document any more has nothing to select. Imported once, by
// use-editor-extensions.ts, before any node view exists (the method is bound
// in each view's constructor).
// ─────────────────────────────────────────────────────────────────────────────

type ViewInternals = {
  selectionRafId: number | null;
  getPos: () => number | undefined;
  editor: { state: { selection: { from: number; to: number } } };
  node: { nodeSize: number };
  renderer: { props: { selected?: boolean } };
  selectNode: () => void;
  deselectNode: () => void;
};

const proto = ReactNodeView.prototype as unknown as {
  handleSelectionUpdate: (this: ViewInternals) => void;
  __folioSafeSelection?: boolean;
};

if (!proto.__folioSafeSelection) {
  proto.__folioSafeSelection = true;
  proto.handleSelectionUpdate = function (this: ViewInternals) {
    if (this.selectionRafId) {
      cancelAnimationFrame(this.selectionRafId);
      this.selectionRafId = null;
    }
    this.selectionRafId = requestAnimationFrame(() => {
      this.selectionRafId = null;
      let pos: number | undefined;
      try {
        pos = this.getPos();
      } catch {
        return; // not in the document any more: nothing to (de)select
      }
      if (typeof pos !== "number") return;
      const { from, to } = this.editor.state.selection;
      if (from <= pos && to >= pos + this.node.nodeSize) {
        if (!this.renderer.props.selected) this.selectNode();
      } else if (this.renderer.props.selected) {
        this.deselectNode();
      }
    });
  };
}
