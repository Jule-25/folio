import type { PropertyConfig } from "../types";

/**
 * A Unique ID as shown: the property's prefix and the row's number
 * ("TASK-12"), or the number alone. The number is given by the database
 * (migration 045); empty until the row has one.
 */
export function formatUniqueId(value: unknown, config: PropertyConfig): string {
  if (typeof value !== "number") return "";
  const prefix = config.type === "unique_id" ? config.prefix?.trim() : "";
  return prefix ? `${prefix}-${value}` : String(value);
}
