/**
 * Parse the date values used by database properties.
 *
 * Created/edited time properties are stored as epoch milliseconds, while
 * user-authored date values are normally ISO strings. Keeping the conversion
 * here prevents callers from accidentally turning an epoch number into an
 * invalid date by stringifying it first.
 */
export function toDate(value: unknown): Date | null {
  if (value == null || value === "") return null;

  if (typeof value === "object" && value !== null && "start" in value) {
    return toDate((value as { start: unknown }).start);
  }

  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : typeof value === "number"
        ? new Date(value)
        : new Date(String(value));

  return isNaN(date.getTime()) ? null : date;
}
