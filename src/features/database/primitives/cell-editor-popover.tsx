import { useEffect, useRef, useState, type ReactNode } from "react";
import { useCurrentEditor } from "@tiptap/react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "src/components/tiptap-ui-primitive/popover";
import "./cell-editor-popover.scss";

export interface CellEditorPopoverProps {
  /** The cell's plain-text display (the trigger). */
  trigger: ReactNode;
  /** The editor shown inside the floating box. */
  children: (close: () => void) => ReactNode;
  readonly?: boolean;
  /** Width of the floating editor box. */
  width?: number | string;
  /** Minimum height of the floating editor box. */
  minHeight?: number | string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Notion-style cell editor: the cell shows plain text; clicking opens a small
 * floating bordered box anchored over the cell. Reusable across cell types.
 */
export function CellEditorPopover({
  trigger,
  children,
  readonly,
  width,
  minHeight,
  open: controlledOpen,
  onOpenChange,
}: CellEditorPopoverProps) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const { editor } = useCurrentEditor();
  const rootRef = useRef<HTMLDivElement>(null);
  // The box opens over the whole table cell, not the text inside it: the
  // display's height changes with the cell (wrapped titles are shorter than
  // the 34px row), so a fixed offset from it landed the box up and to the
  // left (#175). Outside a table cell, it opens over the display itself.
  const anchorRef = useRef({
    getBoundingClientRect: () => {
      const el = rootRef.current;
      const cell = el?.closest<HTMLElement>(".db-node-cell") ?? el;
      return cell?.getBoundingClientRect() ?? new DOMRect();
    },
  });

  const open = controlledOpen ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;

  // Sync the active-cell decoration with edit state. Runs AFTER render (effect),
  // so reading rootRef here is safe — never in the render path.
  //   open  → clear the ring (the open editor box is signal enough)
  //   close → restore the ring on this cell (Notion resting "selected" state)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    if (open) {
      editor.commands.clearActiveCell();
      return;
    }

    const el = rootRef.current;
    if (!el) return;
    const pos = editor.view.posAtDOM(el, 0);
    if (pos < 0) return;
    const $pos = editor.state.doc.resolve(pos);
    for (let depth = $pos.depth; depth > 0; depth--) {
      if ($pos.node(depth).type.name === "databaseCell") {
        editor.commands.setActiveCell($pos.before(depth));
        return;
      }
    }
  }, [open, editor]);

  if (readonly) {
    return <div className="db-cell-editor__display">{trigger}</div>;
  }

  // Not editing → a plain div, NO Radix Popover. This is the common case (every
  // cell that isn't currently being edited). Mounting a full Radix Popover per
  // cell — hundreds per table — leaked its dismiss-layer listeners and portal
  // DOM when ProseMirror destroyed the cell node views (the detached-DOM leak),
  // and was pure render/memory overhead. The Popover now exists ONLY for the one
  // cell actually open for editing.
  if (!open) {
    return (
      <div
        ref={rootRef}
        className="db-cell-editor__display"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger}
      </div>
    );
  }

  // Editing → mount the Radix Popover (defaultOpen so it opens immediately).
  return (
    <Popover open onOpenChange={setOpen} defaultOpen>
      {/* No PopoverTrigger: it registers itself as the anchor, and swapping
          it out for the custom anchor remounts this div (detached → 0×0). */}
      <PopoverAnchor virtualRef={anchorRef} />
      <div
        ref={rootRef}
        className="db-cell-editor__display"
        data-editing="true"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </div>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={0}
        avoidCollisions={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
        className="db-cell-editor__popover"
        style={{
          // Placed below the cell, then pulled up by the cell's height, so its
          // top-left sits on the cell's top-left at any row height.
          marginTop: "calc(-1 * var(--radix-popover-trigger-height))",
          width: width ?? "var(--radix-popover-trigger-width)",
          minWidth: "var(--radix-popover-trigger-width)",
          minHeight: minHeight ?? "var(--radix-popover-trigger-height)",
        }}
      >
        <div className="db-cell-editor__box">
          {children(() => setOpen(false))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
