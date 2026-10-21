import type { CellValue, DatabaseProperty, Page } from "src/types";
import { cellText } from "./cell-clipboard";

/** One CSV field: quoted when it holds a quote, a comma or a line break. */
function field(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The rows as CSV: a header of property names, then one line per row, each
 * value written the way copy writes it (options and people by name, IDs
 * with their prefix). Starts with a byte-order mark so Excel reads it as
 * UTF-8 (é, €…).
 */
export function toCsv(properties: DatabaseProperty[], rows: Page[]): string {
  const lines = [properties.map((p) => field(p.name)).join(",")];
  for (const row of rows) {
    lines.push(
      properties
        .map((p) =>
          field(
            p.config.type === "title"
              ? (row.title ?? "")
              : cellText(p, (row.values?.[p.id] ?? null) as CellValue | null),
          ),
        )
        .join(","),
    );
  }
  return "\uFEFF" + lines.join("\r\n");
}

/** Download `csv` as "<name>.csv" (characters Windows forbids replaced). */
export function downloadCsv(name: string, csv: string) {
  const safe = name.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Untitled";
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
