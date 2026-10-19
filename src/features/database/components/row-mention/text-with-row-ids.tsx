import type { ReactNode } from "react";
import { ROW_ID_PATTERN, useRowIdIndex } from "../../hooks/use-row-id-index";
import { RowMention } from "./row-mention";

/**
 * Plain text in which a row's ID ("BUG-42") becomes a link to the row — a
 * row mention — the way "#123" links an issue on GitHub. Only IDs of rows
 * that exist are linked; anything else stays text. For comments and chat.
 */
export function TextWithRowIds({ text }: { text: string }) {
  const { byId } = useRowIdIndex();
  if (byId.size === 0 || !text) return <>{text}</>;

  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(ROW_ID_PATTERN)) {
    const hit = byId.get(m[1].toLowerCase());
    if (!hit || m.index === undefined) continue;
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <RowMention
        key={`${m.index}-${hit.row.id}`}
        rowId={hit.row.id}
        label={hit.row.title}
      />,
    );
    last = m.index + m[0].length;
  }
  if (parts.length === 0) return <>{text}</>;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
