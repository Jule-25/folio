import { useCallback } from "react";
import type { DatabaseView, ID, OpenPageIn } from "src/types";
import { usePageViewActions } from "src/features/pages/context/page-view-context";
import { useOptionalActivePage } from "src/features/pages/context/active-page-context";
import { noteRecordOpener } from "../utils/record-opener";

/** What "Open pages in" means when a view hasn't set it — the same default
 *  the layout panel shows. */
export const DEFAULT_OPEN_PAGE_IN: OpenPageIn = "Side";

/**
 * Opens a record the way its view says ("Open pages in"): Side → side peek,
 * Center → centered peek, Full → the page itself. Every place that opens a
 * record (table title, board/gallery card, calendar and timeline bars) goes
 * through this, so they all agree.
 *
 * "Full" navigates (setActivePageId): the overlays only draw Peek and Center,
 * so a Full target there did nothing. Any open peek closes on the way.
 */
export function useOpenRecord(view: DatabaseView | null | undefined) {
  const { setTarget } = usePageViewActions();
  const { setActivePageId } = useOptionalActivePage();
  const openIn = view?.openPageIn ?? DEFAULT_OPEN_PAGE_IN;

  return useCallback(
    (recordId: ID) => {
      if (openIn === "Full") {
        setTarget(undefined);
        setActivePageId(recordId);
      } else {
        noteRecordOpener(recordId);
        setTarget({
          pageId: recordId,
          view: openIn === "Center" ? "Center" : "Peek",
        });
      }
    },
    [openIn, setTarget, setActivePageId],
  );
}
