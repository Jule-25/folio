import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTableOverlays } from "./use-table-overlays";
import clsx from "clsx";
import "./table-grip.scss";

/** The grip's short side (px); it's centred on the border. */
const GRIP_THICKNESS = 16;

interface TableRowColOverlayProps {
  orientation?: "row" | "column";
  children: ReactNode;
  className?: string;
}

export function TableRowColOverlay({
  orientation,
  children,
  className,
}: TableRowColOverlayProps) {
  const { left, top, width, height } = useTableOverlays();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const visible = !!width && !!height;

  // Measure the table's viewport rect from a zero-size anchor we drop into the
  // normal (non-portaled) tree. The anchor sits inside .table-overlays, so its
  // offsetParent chain reaches the table; we read the nearest .tableWrapper
  // table. position:fixed overlays are then placed against this live rect, so
  // they escape every clipping ancestor without needing the hook's coord space.
  useLayoutEffect(() => {
    const anchorEl = anchorRef.current;
    if (!anchorEl) return;
    const root = anchorEl.closest(".table-overlays");
    const tableEl = root?.querySelector("table") ?? null;
    if (!tableEl) return;

    const measure = () => setRect(tableEl.getBoundingClientRect());
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(tableEl);
    // reposition on scroll/resize so overlays track the table
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
    // Re-run when the overlay appears: on the first render it's hidden, so
    // the anchor isn't in the DOM yet and there's nothing to measure.
  }, [visible]);

  if (!visible) return null;

  // The zero-size anchor always renders in the normal tree (for measuring).
  const anchor = (
    <span
      ref={anchorRef}
      style={{ position: "absolute", width: 0, height: 0 }}
    />
  );

  if (!rect) return anchor;

  // `top`/`left`/`width`/`height` from the hook are offsets WITHIN the table's
  // coordinate space (same as before, when they were used with the table-flush
  // .table-overlays as positioning parent). We now add the table's viewport
  // origin (rect.left/rect.top) to place them with position:fixed.
  // Notion-style: a small grip sitting ON the table's border — the left
  // border, centred on the hovered row; the top border, centred on the
  // hovered column. The strip it's centred in lets no clicks through except
  // on the grip itself.
  const overlay =
    orientation === "row" ? (
      <div
        className={clsx("table-grip-track", className)}
        style={{
          position: "fixed",
          top: rect.top + (top ?? 0),
          left: rect.left - GRIP_THICKNESS / 2,
          width: GRIP_THICKNESS,
          height,
        }}
      >
        {children}
      </div>
    ) : (
      <div
        className={clsx("table-grip-track", className)}
        style={{
          position: "fixed",
          left: rect.left + (left ?? 0),
          top: rect.top - GRIP_THICKNESS / 2,
          width,
          height: GRIP_THICKNESS,
        }}
      >
        {children}
      </div>
    );

  return (
    <>
      {anchor}
      {createPortal(overlay, document.body)}
    </>
  );
}
