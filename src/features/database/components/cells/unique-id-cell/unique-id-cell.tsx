import type { CellProps } from "../types";
import { formatUniqueId } from "src/lib/unique-id";

/** The row's ID (#161): read-only, numbered by the database. */
export function UniqueIdCell({
  value,
  config,
  unwrapped,
  className,
}: CellProps<"unique_id">) {
  return (
    <div
      className={className ?? "db-cell"}
      data-wrap={unwrapped ? "false" : "true"}
    >
      <span>{formatUniqueId(value, config)}</span>
    </div>
  );
}
