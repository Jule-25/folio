import type { DataSource, DatabaseProperty, Page } from "src/types";
import { isReadOnlyProperty } from "src/types";
import { formatUniqueId } from "src/lib/unique-id";
import { convertValue } from "src/lib/convert-value";

// What a row is called outside its database: its ID ("TASK-12") when its
// database has an ID property, and a few of its values, as text — for row
// mentions, their hover card, and finding rows by ID.

/** The database's ID property (the first, if there are several). */
export function idPropertyOf(
  source: DataSource | null | undefined,
): DatabaseProperty | undefined {
  return source?.properties.find((p) => p.config.type === "unique_id");
}

/** "TASK-12", or "" when the row has no ID (yet). */
export function rowIdText(
  row: Page,
  source: DataSource | null | undefined,
): string {
  const prop = idPropertyOf(source);
  return prop ? formatUniqueId(row.values?.[prop.id], prop.config) : "";
}

/** Types worth a line in the hover card: what a row is "about". */
const SUMMARY_TYPES = new Set([
  "status",
  "select",
  "multi_select",
  "person",
  "date",
  "checkbox",
  "number",
]);

/** A date value ("2026-10-02", or a range) as "Oct 2, 2026". */
function dateText(value: unknown): string {
  const start =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && "start" in value
        ? String((value as { start?: unknown }).start ?? "")
        : "";
  const d = start ? new Date(start) : null;
  return d && !isNaN(d.getTime())
    ? d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";
}

/** Up to `max` of the row's set values, as "Property: text". */
export function rowSummary(
  row: Page,
  source: DataSource | null | undefined,
  max = 4,
): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  for (const prop of source?.properties ?? []) {
    if (out.length >= max) break;
    const type = prop.config.type;
    if (!SUMMARY_TYPES.has(type) || isReadOnlyProperty(type)) continue;
    const value = row.values?.[prop.id];
    if (value == null || value === "") continue;
    const text =
      type === "date"
        ? dateText(value)
        : String(
            convertValue(value, type, "text", prop.config, { type: "text" }) ??
              "",
          );
    if (text && !(type === "checkbox" && value === false)) {
      out.push({ name: prop.name, text });
    }
  }
  return out;
}

/** Finding a row by what people type: its ID ("task-12", "TASK-1"…). */
export function idMatches(idText: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !!idText && !!q && idText.toLowerCase().startsWith(q);
}

/**
 * A database's search box: a row matches by its title, or by its ID — typed
 * whole ("TASK-12", any case) or as its number ("12"). `q` is lower case.
 */
export function rowMatchesSearch(
  row: Page,
  q: string,
  properties: DatabaseProperty[] | undefined,
): boolean {
  if ((row.title ?? "").toLowerCase().includes(q)) return true;
  const idProp = properties?.find((p) => p.config.type === "unique_id");
  if (!idProp) return false;
  const n = row.values?.[idProp.id];
  if (typeof n !== "number") return false;
  return (
    String(n) === q || formatUniqueId(n, idProp.config).toLowerCase() === q
  );
}
