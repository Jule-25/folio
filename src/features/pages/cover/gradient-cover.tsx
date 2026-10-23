import { useState, useRef, useCallback, useEffect, memo } from "react";
import { useActivePageState } from "src/features/pages/context/active-page-context";
import CoverControlsGroup from "./cover-controls";
import type { Page } from "src/types";
import { useEditorLayout } from "src/features/shell/context/editor-layout-context";

export const GradientCover = memo(function GradientCover({
  gradient,
  onRemoveCoverAsync,
  page,
}: {
  page: Page;
  gradient: string;
  onRemoveCoverAsync: () => Promise<void>;
}) {
  const [btnPosition, setBtnPosition] = useState({ top: 0, right: 0 });
  const [hovering, setHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { collapsed } = useEditorLayout();

  const onPopoverOpenChange = useCallback(
    (open: boolean) => setPopoverOpen(open),
    [],
  );

  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setBtnPosition({
        top: 60,
        right: window.innerWidth - rect.right + 24,
      });
    }
  }, []);
  const { activePage } = useActivePageState();

  const showControls = hovering || popoverOpen;

  if (!activePage) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "30vh",
        maxHeight: 280,
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div
        style={{ background: gradient }}
        className="gradient-cover"
        data-collapsed={collapsed ? "true" : undefined}
      >
        {showControls && (
          <CoverControlsGroup
            page={page}
            btnPosition={btnPosition}
            onRemoveCoverAsync={onRemoveCoverAsync}
            popoverOpen={popoverOpen}
            onPopoverOpenChange={onPopoverOpenChange}
          />
        )}
      </div>
    </div>
  );
});
