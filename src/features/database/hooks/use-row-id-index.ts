import { useMemo } from "react";
import type { DataSource, Page } from "src/types";
import { usePagesBase } from "src/hooks/use-pages";
import { useDataSources } from "src/hooks/use-data-sources";
import { rowIdText } from "../utils/row-summary";

/** A row that has an ID, with that ID as text ("TASK-12"). */
export type RowWithId = { row: Page; idText: string };

// Every live database row (not a template, not in the trash).
const selectRows = (pages: Page[]) =>
  pages.filter(
    (p) =>
      p.sourceId != null && p.deletedAt == null && p.category !== "Template",
  );

/**
 * The rows that have an ID, by ID (lower case, "task-12") — for turning IDs
 * typed in text into links and for finding rows by ID. Rows whose database
 * has no ID property aren't in it.
 */
export function useRowIdIndex(): {
  byId: Map<string, RowWithId>;
  list: RowWithId[];
} {
  const { data: rows } = usePagesBase(selectRows);
  const { data: sources } = useDataSources();

  return useMemo(() => {
    const sourceById = new Map(
      ((sources as DataSource[] | undefined) ?? []).map((s) => [s.id, s]),
    );
    const list: RowWithId[] = [];
    const byId = new Map<string, RowWithId>();
    for (const row of rows ?? []) {
      const idText = rowIdText(row, sourceById.get(row.sourceId!));
      if (!idText) continue;
      const entry = { row, idText };
      list.push(entry);
      byId.set(idText.toLowerCase(), entry);
    }
    return { byId, list };
  }, [rows, sources]);
}

/** An ID as people type it: a prefix, a dash, a number ("TASK-12"). A bare
 *  number is never taken for an ID. */
export const ROW_ID_PATTERN =
  /(?<![\p{L}\p{N}_-])(\p{L}[\p{L}\p{N}_]*-\d+)(?![\p{L}\p{N}_])/gu;
