import { Extension } from "@tiptap/core";
import type { Node as PMNode, NodeType } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// ─── Containment ────────────────────────────────────────────────────────────
// Marks every block that sits inside a container block (a callout, a list
// item, a quote, a column, an appendix…) with the container's name:
//
//   <div class="react-renderer node-database" data-contained-in="callout">
//
// so a node's styles can say "when I'm nested" once —
// `[data-contained-in] { … }` — instead of listing every container's inner
// element (.callout-content, li, blockquote > *, …) and growing that list
// with each new container. The counterpart of TopLevelClassExtension, which
// marks the document's direct children.
//
// Only a container's DIRECT children are marked (a database in a callout,
// not its records); a container nested in another is itself marked, and
// marks its own children. Decoration-based, like TopLevelClassExtension: it
// paints an attribute, never changes the document, and is rebuilt only when
// the document changes.

export interface ContainmentOptions {
  /** The attribute put on contained blocks; its value is the container's
   *  node name. */
  attribute: string;
  /** Which node types are containers. Default: every node whose content
   *  takes blocks (`block+`, `paragraph block*`, …), except the document. */
  isContainer: (type: NodeType) => boolean;
}

/** Content expressions that take blocks: "block+", "paragraph block*", … */
const takesBlocks = (type: NodeType) =>
  type.name !== "doc" && /\bblock\b/.test(type.spec.content ?? "");

function buildDecorations(
  doc: PMNode,
  attribute: string,
  isContainer: (type: NodeType) => boolean,
): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!isContainer(node.type)) return true;
    const container = node.type.name;
    // The container's children start one position in (after its open token).
    node.forEach((child, offset) => {
      if (!child.isBlock) return;
      const from = pos + 1 + offset;
      decorations.push(
        Decoration.node(from, from + child.nodeSize, {
          [attribute]: container,
        }),
      );
    });
    return true; // keep going: containers inside containers
  });

  return DecorationSet.create(doc, decorations);
}

/**
 * Build a containment extension. `createContainment()` gives the default
 * (every block container, `data-contained-in`); pass options to narrow the
 * containers or rename the attribute, e.g. a second instance that only
 * tracks columns:
 *
 *   createContainment({
 *     name: "inColumn",
 *     attribute: "data-in-column",
 *     isContainer: (t) => t.name === "column",
 *   })
 */
export function createContainment({
  name = "containment",
  ...options
}: Partial<ContainmentOptions> & { name?: string } = {}) {
  const key = new PluginKey<DecorationSet>(name);

  return Extension.create<ContainmentOptions>({
    name,

    addOptions() {
      return {
        attribute: options.attribute ?? "data-contained-in",
        isContainer: options.isContainer ?? takesBlocks,
      };
    },

    addProseMirrorPlugins() {
      const { attribute, isContainer } = this.options;
      const build = (doc: PMNode) =>
        buildDecorations(doc, attribute, isContainer);

      return [
        new Plugin<DecorationSet>({
          key,
          state: {
            init: (_, state) => build(state.doc),
            apply: (tr, old) => (tr.docChanged ? build(tr.doc) : old),
          },
          props: {
            decorations: (state) => key.getState(state),
          },
        }),
      ];
    },
  });
}

/** Every block inside any block container gets `data-contained-in`. */
export const Containment = createContainment();
