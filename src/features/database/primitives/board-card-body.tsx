import { useOpenRecord } from "../hooks/use-open-record";
import type {
  CellValue,
  DatabaseProperty,
  DatabaseView,
  Page,
} from "src/types";
import { BoardCardCover } from "./board-card-cover";
import { BoardCardContent } from "./board-card-content";
import { Cell } from "../components/cells/cell";
import { BoardCardControls } from "../components/board-card-controls/board-card-controls";
import { useState } from "react";
import { useCurrentEditor } from "@tiptap/react";
import type { DragStorage } from "../extensions";
import { normalizeColor } from "../utils/pill-colors";
import "./board-card-body.scss";

export function BoardCardBody({
  record,
  properties,
  titleProp,
  otherProps,
  cardPreview,
  view,
  recordId,
  setCellValue,
  color,
}: {
  record: Page;
  properties: DatabaseProperty[];
  titleProp: DatabaseProperty | null;
  otherProps: DatabaseProperty[];
  cardPreview: "none" | "cover" | "content";
  view: DatabaseView;
  recordId: string | null;
  setCellValue: (
    recordId: string,
    propertyId: string,
    value: CellValue | null,
  ) => void;
  color?: string;
}) {
  const onOpenRecord = useOpenRecord(view);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { editor } = useCurrentEditor();

  if (!recordId) return null;

  return (
    <div
      className="db-board-card"
      data-record-id={recordId ?? undefined}
      data-type="database-record"
      data-view-type={view.type}
      data-dragging={dragging}
      // In a coloured board column the card takes its colour (see
      // board-card-body.scss): a tinted border, and a tinted card in dark.
      data-accent={(view.type === "board" && !!color) || undefined}
      draggable
      style={{
        ...(view.type === "board" && color
          ? ({
              "--card-accent": `var(--tt-color-accent-${normalizeColor(color)})`,
            } as React.CSSProperties)
          : {}),
        borderRadius: "var(--tt-radius-lg)",
        padding: 0,
        margin: view.type === "gallery" ? "0px !important" : undefined,
        height: view.type === "board" ? "fit-content" : "100%",
      }}
      onDragStart={(event) => {
        if (!editor) return;
        setDragging(true);
        const storage = editor.storage.boardDrag as DragStorage;
        // if (!storage.isBoardActive()) return false;
        // eslint-disable-next-line react-hooks/immutability
        storage.draggingId = recordId;
        if (storage.draggingId && event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", storage.draggingId);
        }
      }}
      onDragEnd={() => setDragging(false)}
      onClick={() => onOpenRecord(recordId)}
    >
      {cardPreview === "cover" && (
        <>
          <BoardCardCover
            page={record}
            recordId={recordId}
            height={120}
            fit={
              view.type === "gallery" || view.type === "board"
                ? view.coverFit
                : "cover"
            }
          />
          <BoardCardControls
            record={record}
            onOpenRecord={() => onOpenRecord(recordId)}
            editing={editing}
            onEnableEdit={() => setEditing(true)}
            menuOpen={menuOpen}
            onMenuOpenChange={setMenuOpen}
            color={color}
          />
        </>
      )}
      {cardPreview === "content" && <BoardCardContent page={record} />}
      {titleProp && (
        <div
          className="db-board-card__title"
          style={{ background: "transparent" }}
          onClick={(e) => e.stopPropagation()}
        >
          <Cell
            property={titleProp}
            value={(record.values?.[titleProp.id] ?? null) as CellValue | null}
            record={record}
            onChange={(v) => setCellValue(recordId, titleProp.id, v)}
            view={view}
            properties={properties}
            onEditingChange={setEditing}
            autoEdit={editing}
            unwrapped={false}
          />

          {cardPreview !== "cover" && view.type !== "calendar" && (
            <BoardCardControls
              record={record}
              onOpenRecord={() => onOpenRecord(recordId)}
              editing={editing}
              onEnableEdit={() => setEditing(true)}
              menuOpen={menuOpen}
              onMenuOpenChange={setMenuOpen}
              color={color}
            />
          )}
        </div>
      )}
      {view.type !== "calendar" && (
        <div
          className="db-board-card__props"
          onClick={(e) => e.stopPropagation()}
        >
          {otherProps.map((p) => (
            <Cell
              key={p.id}
              property={p}
              value={(record.values?.[p.id] ?? null) as CellValue | null}
              record={record}
              onChange={(v) => setCellValue(recordId, p.id, v)}
              view={view}
              properties={properties}
            />
          ))}
        </div>
      )}
    </div>
  );
}
