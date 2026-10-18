import { useMemo } from "react";
import type { DataSource, Page } from "src/types";
import type { UseDatabaseReturn } from "./use-database";
import { recordMatchesFilters } from "../utils/apply-filters";
import { useSession } from "src/hooks/use-session";
import { sortRecords } from "../utils/apply-sorts";
import { usePageTitles } from "./use-page-titles";
import { applyManualOrder } from "../utils/manual-order";

// filter → search → sort (or a table / list's own row order) → pin-editing

export function useResolvedRecords(
  resolvedRecords: Page[],
  source: DataSource | null,
  db: UseDatabaseReturn,
  editingRecordId: string | null,
): Page[] {
  const activeView = db.activeView;
  // For the "Me" person filter.
  const meId = useSession().session?.user.id ?? null;
  // For relation filters and sorts, which go by the linked pages' titles.
  const titleOf = usePageTitles();

  return useMemo(() => {
    const props = source?.properties ?? [];

    const filtered = activeView?.filters?.length
      ? resolvedRecords.filter((r) =>
          recordMatchesFilters(r, activeView.filters, props, { meId, titleOf }),
        )
      : resolvedRecords;

    const q = db.searchQuery.trim().toLowerCase();
    const searched = q
      ? filtered.filter((r) => (r.title ?? "").toLowerCase().includes(q))
      : filtered;

    const sorts = activeView?.sorts ?? [];
    // A table or list without a sort keeps the order its rows were dragged
    // into (manual-order.ts). A sort always wins.
    const sorted =
      sorts.length === 0 &&
      (activeView?.type === "table" || activeView?.type === "list")
        ? applyManualOrder(searched, activeView.manualOrder)
        : sortRecords(searched, sorts, props, { titleOf });

    // Pin the row being created to the end so it doesn't jump under the active
    // sort while its title is still changing.
    if (!editingRecordId) return sorted;
    const idx = sorted.findIndex((r) => r.id === editingRecordId);
    if (idx === -1) return sorted;
    return [...sorted.slice(0, idx), ...sorted.slice(idx + 1), sorted[idx]];
  }, [
    editingRecordId,
    meId,
    titleOf,
    resolvedRecords,
    activeView,
    source?.properties,
    db.searchQuery,
  ]);
}
