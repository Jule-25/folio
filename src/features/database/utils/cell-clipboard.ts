import type { CellValue, DatabaseProperty, SelectOption } from "src/types";
import { formatUniqueId } from "src/lib/unique-id";

/**
 * Copy and paste for table cells (Ctrl/⌘+C, Ctrl/⌘+V on the active cell).
 *
 * Each cell registers what it can do under "recordId:propertyId"; the
 * active-cell plugin looks it up from the cell node it has active. A cell
 * shown in two views of the same database registers twice — either copy
 * works, they hold the same value.
 */
export interface CellClipboard {
  copyText: () => string;
  /** false when the text doesn't fit the property (an unknown option…). */
  paste: (text: string) => boolean;
}

const registry = new Map<string, CellClipboard[]>();

export const cellKey = (recordId: string, propertyId: string) =>
  `${recordId}:${propertyId}`;

export function registerCellClipboard(key: string, api: CellClipboard) {
  registry.set(key, [...(registry.get(key) ?? []), api]);
  return () => {
    const rest = (registry.get(key) ?? []).filter((a) => a !== api);
    if (rest.length) registry.set(key, rest);
    else registry.delete(key);
  };
}

export function cellClipboard(key: string): CellClipboard | undefined {
  return registry.get(key)?.[0];
}

const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** A cell's value as the text a spreadsheet would show. */
export function cellText(
  property: DatabaseProperty,
  value: CellValue | null,
): string {
  if (value == null) return "";
  const config = property.config;
  switch (config.type) {
    case "select":
      return (value as SelectOption).label ?? "";
    case "multi_select":
      return (value as SelectOption[]).map((o) => o.label).join(", ");
    case "status": {
      const item = config.groups
        .flatMap((g) => g.items)
        .find((i) => i.id === value);
      return item?.name ?? "";
    }
    case "checkbox":
      return value ? "Yes" : "No";
    case "date": {
      const d = value as CellValue<"date">;
      if (d == null) return "";
      return typeof d === "string"
        ? d
        : d.end
          ? `${d.start} → ${d.end}`
          : d.start;
    }
    case "unique_id":
      return formatUniqueId(value, config);
    case "person":
    case "relation":
      return ""; // no single text worth copying
    default:
      return typeof value === "object" ? "" : String(value);
  }
}

/** The value `text` stands for in this property, or null when it doesn't
 *  fit (the paste is skipped). Read-only types never take a paste. */
export function parseCellText(
  property: DatabaseProperty,
  text: string,
): { value: CellValue | null } | null {
  const t = text.trim();
  const config = property.config;
  switch (config.type) {
    case "title":
    case "text":
    case "url":
    case "email":
    case "phone":
      return { value: text };
    case "number": {
      if (!t) return { value: null };
      const n = Number(t.replace(/[\s,]/g, ""));
      return Number.isFinite(n) ? { value: n } : null;
    }
    case "checkbox":
      return { value: /^(true|yes|y|1|x|✓|oui|vrai)$/i.test(t) };
    case "select": {
      if (!t) return { value: null };
      const option = config.options.find((o) => same(o.label, t));
      return option ? { value: option } : null;
    }
    case "multi_select": {
      const options = t
        .split(",")
        .map((label) => config.options.find((o) => same(o.label, label)))
        .filter((o): o is SelectOption => !!o);
      return { value: options };
    }
    case "status": {
      const item = config.groups
        .flatMap((g) => g.items)
        .find((i) => same(i.name, t));
      return item ? { value: item.id } : null;
    }
    case "date": {
      if (!t) return { value: null };
      const time = Date.parse(t);
      return Number.isNaN(time)
        ? null
        : { value: new Date(time).toISOString() };
    }
    default:
      return null;
  }
}
