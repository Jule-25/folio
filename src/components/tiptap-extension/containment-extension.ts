import { Extension, type Editor } from "@tiptap/core";
import type { Node as PMNode, NodeType, ResolvedPos } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
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
//
// Rules: a container can refuse node types inside it, at any depth (a table
// cell takes callouts, lists, code… but not another table or a database).
// Two things follow from a rule:
//   · canInsertHere(editor, "table") — false in a cell, so menus (the slash
//     menu) can leave those items out;
//   · a local change that would put a refused node inside the container
//     (a paste, a drop, "turn into") doesn't apply. Collaborators' changes
//     (y-sync) are never refused, and refused nodes already in a document
//     stay editable — only new ones are kept out.

export interface ContainmentOptions {
  /** The attribute put on contained blocks; its value is the container's
   *  node name. */
  attribute: string;
  /** Which node types are containers. Default: every node whose content
   *  takes blocks (`block+`, `paragraph block*`, …), except the document. */
  isContainer: (type: NodeType) => boolean;
  /** Per container (by node name): node types it refuses, at any depth. */
  rules: Record<string, ContainmentRule>;
}

export interface ContainmentRule {
  deny: string[];
}

/** Does a container around `$pos` refuse `nodeName`? */
function refusedAt(
  $pos: ResolvedPos,
  nodeName: string,
  rules: Record<string, ContainmentRule>,
): boolean {
  for (let depth = $pos.depth; depth > 0; depth--) {
    if (rules[$pos.node(depth).type.name]?.deny.includes(nodeName)) {
      return true;
    }
  }
  return false;
}

/** The new document's ranges a transaction changed. */
function changedRanges(tr: Transaction): [number, number][] {
  const ranges: [number, number][] = [];
  tr.mapping.maps.forEach((map, i) => {
    const after = tr.mapping.slice(i + 1);
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      ranges.push([after.map(newStart, -1), after.map(newEnd, 1)]);
    });
  });
  return ranges;
}

/** Would a container refuse a node put inside it by `tr`? Only nodes that
 *  lie wholly in a changed range count: editing inside an old one is fine. */
function bringsRefusedNode(
  tr: Transaction,
  rules: Record<string, ContainmentRule>,
  refusable: Set<string>,
): boolean {
  let refused = false;
  for (const [from, to] of changedRanges(tr)) {
    tr.doc.nodesBetween(from, to, (node, pos) => {
      if (refused) return false;
      const name = node.type.name;
      if (
        refusable.has(name) &&
        pos >= from &&
        pos + node.nodeSize <= to &&
        refusedAt(tr.doc.resolve(pos), name, rules)
      ) {
        refused = true;
        return false;
      }
      return true;
    });
    if (refused) break;
  }
  return refused;
}

// Every containment extension in an editor keeps its rules in its storage,
// flagged, so canInsertHere can find them whatever the extension is named.
interface ContainmentStorage {
  containment: true;
  rules: Record<string, ContainmentRule>;
}

/**
 * Can a `nodeName` block go at the editor's selection? False when any
 * container around it refuses that type (see ContainmentOptions.rules).
 */
export function canInsertHere(editor: Editor, nodeName: string): boolean {
  const $from = editor.state.selection.$from;
  return !editor.extensionManager.extensions.some((ext) => {
    const storage = (editor.storage as unknown as Record<string, unknown>)[
      ext.name
    ] as Partial<ContainmentStorage> | undefined;
    return (
      storage?.containment === true &&
      !!storage.rules &&
      refusedAt($from, nodeName, storage.rules)
    );
  });
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

  return Extension.create<ContainmentOptions, ContainmentStorage>({
    name,

    addOptions() {
      return {
        attribute: options.attribute ?? "data-contained-in",
        isContainer: options.isContainer ?? takesBlocks,
        rules: options.rules ?? {},
      };
    },

    addStorage() {
      return { containment: true, rules: this.options.rules };
    },

    addProseMirrorPlugins() {
      const { attribute, isContainer, rules } = this.options;
      const refusable = new Set(Object.values(rules).flatMap((r) => r.deny));
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
          filterTransaction: (tr) =>
            refusable.size === 0 ||
            !tr.docChanged ||
            !!tr.getMeta("y-sync$") ||
            !bringsRefusedNode(tr, rules, refusable),
        }),
      ];
    },
  });
}

// What a table cell won't take: the page-wide, layout-sized blocks. Callouts,
// lists, quotes, code, headings, toggles, media, math… all go in.
const NOT_IN_A_CELL = [
  "tableWrapper",
  "table",
  "database",
  "columnBlock",
  "tabs",
  "codeGroup",
  "tocNode",
  "breadcrumb",
  "container",
];

/** Every block inside any block container gets `data-contained-in`; table
 *  cells keep the page-wide blocks out. */
export const Containment = createContainment({
  rules: {
    tableCell: { deny: NOT_IN_A_CELL },
    tableHeader: { deny: NOT_IN_A_CELL },
  },
});
