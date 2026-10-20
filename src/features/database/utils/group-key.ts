import type { DatabaseProperty, Page } from "src/types";
import { relationRecordIds, isMirrorRelation } from "src/lib/relation-ids";

// One way to group rows by a property, shared by the table / list groups
// (group-records.ts) and the board columns (use-board-layout.ts):
// which value a row has, the key of its group, the group's label, and the
// order of groups that come from values rather than a fixed option list.

export const NO_GROUP_KEY = "__none__";

/** What a grouping needs beyond the rows. */
export type GroupContext = {
  /** Page id → title (relation groups). */
  titleOf?: (id: string) => string | undefined;
  /** Person id → name (person, created by, edited by groups). */
  personName?: (id: string) => string | undefined;
};

/** The value a row groups by. Some live on the page itself, not in values. */
export function groupCellValue(row: Page, prop: DatabaseProperty): unknown {
  switch (prop.config.type) {
    case "created_by":
      return row.ownerId ?? null;
    case "edited_by":
      return row.editedBy ?? row.ownerId ?? null;
    case "created_time":
      return row.createdAt ?? null;
    case "edited_time":
      return row.updatedAt ?? row.createdAt ?? null;
    default:
      return row.values?.[prop.id] ?? null;
  }
}

/** "YYYY-MM-DD" in local time, for day groups. */
function dayKey(value: unknown): string | null {
  const raw =
    value && typeof value === "object" && "start" in value
      ? (value as { start?: unknown }).start
      : value;
  if (raw == null || raw === "") return null;
  // A date without a time is already a day; don't let UTC shift it.
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw as string | number);
  if (isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** The group a value falls in. Lists (multi-select, people, relations)
 *  group by their first item. */
export function groupKey(value: unknown, prop: DatabaseProperty): string {
  const t = prop.config.type;
  if (t === "checkbox") return value ? "true" : "false";
  if (value == null || value === "") return NO_GROUP_KEY;

  if (t === "date" || t === "created_time" || t === "edited_time") {
    return dayKey(value) ?? NO_GROUP_KEY;
  }
  if (t === "relation") {
    return relationRecordIds(value)[0] ?? NO_GROUP_KEY;
  }
  if (Array.isArray(value)) {
    const first = value[0];
    if (first == null) return NO_GROUP_KEY;
    return typeof first === "object" && "id" in first
      ? String((first as { id: unknown }).id)
      : String(first);
  }
  if (typeof value === "object" && "id" in value) {
    return String((value as { id: unknown }).id);
  }
  return String(value);
}

/** A group's name as people read it. */
export function groupLabelFor(
  key: string,
  prop: DatabaseProperty,
  ctx: GroupContext = {},
): string {
  if (key === NO_GROUP_KEY) return `No ${prop.name}`;
  const cfg = prop.config;
  switch (cfg.type) {
    case "select":
    case "multi_select":
      return cfg.options.find((o) => o.id === key)?.label ?? key;
    case "status":
      return (
        cfg.groups.flatMap((g) => g.items).find((i) => i.id === key)?.name ??
        key
      );
    case "checkbox":
      return key === "true" ? "Checked" : "Unchecked";
    case "relation":
      return ctx.titleOf?.(key) || "Untitled";
    case "person":
    case "created_by":
    case "edited_by":
      return ctx.personName?.(key) ?? key;
    case "date":
    case "created_time":
    case "edited_time": {
      const [y, m, d] = key.split("-").map(Number);
      const date = new Date(y, (m ?? 1) - 1, d ?? 1);
      return isNaN(date.getTime())
        ? key
        : date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
    }
    case "rollup":
    case "number": {
      const n = Number(key);
      return isNaN(n) ? key : n.toLocaleString();
    }
    default:
      return key;
  }
}

/** Order for groups made from values (dates and numbers ascending, text
 *  A–Z by label). Option-based groups keep their option order instead. */
export function compareGroups(
  prop: DatabaseProperty,
): (
  a: { key: string; label: string },
  b: { key: string; label: string },
) => number {
  const t = prop.config.type;
  if (t === "date" || t === "created_time" || t === "edited_time") {
    return (a, b) => a.key.localeCompare(b.key);
  }
  return (a, b) => {
    const na = Number(a.key);
    const nb = Number(b.key);
    if (
      (t === "number" || t === "rollup" || t === "formula") &&
      !isNaN(na) &&
      !isNaN(nb)
    ) {
      return na - nb;
    }
    return a.label.localeCompare(b.label);
  };
}

/** Whether a row can be moved into a group by writing the value: false for
 *  computed properties and the derived side of a two-way relation. */
export function canWriteGroupValue(prop: DatabaseProperty): boolean {
  const t = prop.config.type;
  if (
    t === "formula" ||
    t === "rollup" ||
    t === "created_time" ||
    t === "edited_time" ||
    t === "created_by" ||
    t === "edited_by" ||
    t === "unique_id" ||
    t === "title"
  ) {
    return false;
  }
  return !isMirrorRelation(prop);
}
