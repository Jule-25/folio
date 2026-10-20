import type { JSONContent } from "@tiptap/core";
import { usePersonNames } from "src/hooks/use-person-names";
import { RowMention } from "src/features/database/components/row-mention/row-mention";
import { TextWithRowIds } from "src/features/database/components/row-mention/text-with-row-ids";

// Renders a comment body. Handles BOTH formats:
//   - legacy: a plain string (old comments) → rendered as text
//   - new: ProseMirror JSON (stringified) → rendered with mention tokens
// Mentions resolve their stored id → the CURRENT name, so renames reflect.
export function CommentBody({ body }: { body: string }) {
  const resolveName = usePersonNames();

  // Try to parse as JSON; if it fails, it's a legacy plain-string comment.
  let doc: JSONContent | null = null;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object" && parsed.type === "doc") {
      doc = parsed;
    }
  } catch {
    doc = null;
  }

  if (!doc) {
    // Legacy plain-text comment.
    return (
      <span className="comment-body">
        <TextWithRowIds text={body} />
      </span>
    );
  }

  return (
    <span className="comment-body">
      {renderNodes(doc.content ?? [], resolveName)}
    </span>
  );
}

function renderNodes(
  nodes: JSONContent[],
  resolveName: (id: string) => string,
): React.ReactNode {
  return nodes.map((node, i) => {
    if (node.type === "text") {
      // A row's ID ("BUG-42") in the text links to the row.
      return (
        <span key={i}>
          <TextWithRowIds text={node.text ?? ""} />
        </span>
      );
    }
    if (node.type === "mention" && node.attrs?.rowId) {
      return (
        <RowMention
          key={i}
          rowId={node.attrs.rowId as string}
          label={node.attrs.label as string | undefined}
        />
      );
    }
    if (node.type === "mention") {
      const id = node.attrs?.id as string | undefined;
      const label = id ? resolveName(id) : (node.attrs?.label ?? "unknown");
      return (
        <span key={i} className="comment-mention" data-id={id}>
          @{label}
        </span>
      );
    }
    if (node.type === "paragraph") {
      return (
        <span key={i} className="comment-body__p">
          {renderNodes(node.content ?? [], resolveName)}
        </span>
      );
    }
    // Fallback: recurse into any content.
    if (node.content) return renderNodes(node.content, resolveName);
    return null;
  });
}
