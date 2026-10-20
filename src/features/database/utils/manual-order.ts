import type { ID } from "src/types";
import { COLUMNS_SLOT, HEADER_SLOT, NEW_SLOT } from "./group-rows";

// ─────────────────────────────────────────────────────────────────────────────
// A table or list view's own row order (view.manualOrder), set by dragging a
// row or by Move up / Move down in the row's menu.
//
// manualOrder lists record ids. Records it doesn't list yet (added since the
// last reorder) follow in their usual order, so a new row shows at the end
// and nothing ever disappears from the view.
// ─────────────────────────────────────────────────────────────────────────────

/** `records` in the saved order: listed ids first, the rest after them. */
export function applyManualOrder<T extends { id: ID }>(
  records: T[],
  manualOrder: ID[] | undefined,
): T[] {
  if (!manualOrder?.length) return records;
  const rank = new Map(manualOrder.map((id, i) => [id, i] as const));
  const listed = records
    .filter((r) => rank.has(r.id))
    .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  const rest = records.filter((r) => !rank.has(r.id));
  return listed.length ? [...listed, ...rest] : records;
}

/** `order` with `id` moved to just before `beforeId` (null = to the end). */
export function moveBefore(order: ID[], id: ID, beforeId: ID | null): ID[] {
  const next = order.filter((x) => x !== id);
  const at = beforeId ? next.indexOf(beforeId) : -1;
  next.splice(at === -1 ? next.length : at, 0, id);
  return next;
}

/**
 * The records of a view's row slots (table / list layout), in order, and the
 * group each one is in ("" when the view isn't grouped). Group headers,
 * column strips and "New page" rows are slots too; they're skipped.
 */
export function rowsAndGroups(rowSlots: string[]): {
  order: ID[];
  groupOf: Map<ID, string>;
} {
  const order: ID[] = [];
  const groupOf = new Map<ID, string>();
  let group = "";
  for (const slot of rowSlots) {
    if (slot.startsWith(HEADER_SLOT)) {
      group = slot.slice(HEADER_SLOT.length);
      continue;
    }
    if (slot.startsWith(COLUMNS_SLOT) || slot.startsWith(NEW_SLOT)) continue;
    order.push(slot);
    groupOf.set(slot, group);
  }
  return { order, groupOf };
}

/**
 * Where Move up (-1) / Move down (+1) puts `id`: the record it should go
 * before (null = the end), or undefined when it can't move that way — it's
 * already first / last in its group. Rows only move within their group.
 */
export function neighbourTarget(
  rowSlots: string[],
  id: ID,
  delta: -1 | 1,
): ID | null | undefined {
  const { order, groupOf } = rowsAndGroups(rowSlots);
  const i = order.indexOf(id);
  if (i === -1) return undefined;
  const group = groupOf.get(id);
  const neighbour = order[i + delta];
  if (neighbour === undefined || groupOf.get(neighbour) !== group) {
    return undefined;
  }
  // Up: before the row above. Down: before the row after the one below.
  return delta === -1 ? neighbour : (order[i + 2] ?? null);
}
