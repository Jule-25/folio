import { useMemo } from "react";
import { rowMatchesSearch } from "../utils/row-summary";
import type { DataSource, ID, Page, TableView } from "src/types";
import type { UseDatabaseReturn } from "./use-database";
import { recordMatchesFilters } from "../utils/apply-filters";
import { useSession } from "src/hooks/use-session";
import { sortRecords } from "../utils/apply-sorts";
import { usePageTitles } from "./use-page-titles";
import { useTableLayout } from "./use-table-layout";

export function useTableRecords({
  resolvedRecords,
  source,
  db,
  editingRecordId,
}: {
  resolvedRecords: Page[];
  source: DataSource | undefined;
  db: UseDatabaseReturn;
  editingRecordId: ID | null;
}) {
  const activeView = db.activeView;
  // For the "Me" person filter.
  const meId = useSession().session?.user.id ?? null;
  // For relation filters and sorts, which go by the linked pages' titles.
  const titleOf = usePageTitles();
  const filters = activeView?.filters;
  const sorts = activeView?.sorts;
  const properties = source?.properties;
  const searchQuery = db.searchQuery;

  const sortedRecords = useMemo(() => {
    const props = properties ?? [];
    const filtered = filters?.length
      ? resolvedRecords.filter((r) =>
          recordMatchesFilters(r, filters, props, { meId, titleOf }),
        )
      : resolvedRecords;

    const q = searchQuery.trim().toLowerCase();
    const searched = q
      ? filtered.filter((r) => rowMatchesSearch(r, q, props))
      : filtered;

    const sorted = sortRecords(searched, sorts ?? [], props, { titleOf });

    // Pin the row being created to the end so it doesn't jump under the sort.
    if (!editingRecordId) return sorted;
    const idx = sorted.findIndex((r) => r.id === editingRecordId);
    if (idx === -1) return sorted;
    return [...sorted.slice(0, idx), ...sorted.slice(idx + 1), sorted[idx]];
  }, [
    editingRecordId,
    meId,
    titleOf,
    resolvedRecords,
    filters,
    sorts,
    properties,
    searchQuery,
  ]);

  const groupByPropertyId = useMemo(
    () =>
      activeView?.type === "table"
        ? ((activeView as TableView).groupByPropertyId ?? null)
        : null,
    [activeView],
  );

  const groupProp = useMemo(
    () =>
      groupByPropertyId
        ? properties?.find((p) => p.id === groupByPropertyId)
        : undefined,
    [properties, groupByPropertyId],
  );

  const collapsedKeys = useMemo(
    () => new Set((activeView as TableView)?.collapsedGroups ?? []),
    [activeView],
  );

  const { tableLayout } = useTableLayout(sortedRecords, source ?? null, db);
  const { rowSlots, headers } = tableLayout;

  return { sortedRecords, groupProp, collapsedKeys, rowSlots, headers };
}
