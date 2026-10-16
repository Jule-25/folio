import { type ReactNode } from "react";
import { useTableOverlays } from "./use-table-overlays";
import clsx from "clsx";

interface TableAddRowColOverlayProps {
  orientation?: "row" | "column";
  children: ReactNode;
  className?: string;
}

export function TableAddRowColOverlay({
  orientation,
  children,
  className,
}: TableAddRowColOverlayProps) {
  const { tableWidth, tableHeight, isLastCol, isLastRow } = useTableOverlays();

  if (tableWidth === 0 || tableHeight === 0) {
    return null;
  }

  return (
    <>
      {orientation === "row" && isLastRow && (
        // A + grip on the bottom border, centred under the table.
        <div
          className={clsx("table-grip-track", className)}
          style={{
            position: "absolute",
            width: `${tableWidth}px`,
            height: 16,
            bottom: "-8px",
            marginLeft: "-20px",
          }}
        >
          {children}
        </div>
      )}
      {orientation === "column" && isLastCol && (
        // A + grip on the right border, centred beside the table.
        <div
          className={clsx("table-grip-track", className)}
          style={{
            position: "absolute",
            height: `${tableHeight}px`,
            width: 16,
            right: "-8px",
          }}
        >
          {children}
        </div>
      )}
    </>
  );
}
