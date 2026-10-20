// ─── CardActionsProvider ────────────────────────────────────────────────────
// Builds the record/card action handlers ONCE from the database context, then:
//   1. provides them via CardActionsContext (board/gallery cards, in-tree), and
//   2. publishes them to cardActionsStore (the body-portaled drag-handle Menu,
//      which is outside the tree and can't read context).
//
// Mount this INSIDE DatabaseProvider (so it can read useDatabaseContext) and
// wrap the database's rendered subtree. All record menus then call
// useCardActions() instead of receiving handlers as props — one source, no
// prop-drilling, reaches both in-tree and portaled consumers.
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useDatabaseContext } from "./database-context";
import { usePatchPage } from "src/hooks/use-patch-page";
import { patchPage as patchPageApi } from "src/api/pages";
import { CardActionsContext } from "./card-actions-context";
import { cardActionsStore } from "./card-actions-store";
import type { CardActionsValue } from "./card-actions-context-value";
import type { CellValue, ID, PageCategory, PropertyType } from "src/types";
import { useDataSource } from "../hooks/use-data-source";
import type { Target } from "src/features/pages/cover/types";
import { useActivePageActions } from "src/features/pages/context/active-page-context";
import { usePageViewActions } from "src/features/pages/context/page-view-context";
import { removeRecordNodes } from "../utils/remove-record-nodes";
import { recordSelection } from "../utils/record-selection-store";
import { useDeleteRecords } from "../hooks/use-delete-records";
import { noteRecordOpener } from "../utils/record-opener";
import { useRowLinks } from "../hooks/use-row-links";
import { useToast } from "src/features/shell/toast";
import { useTranslation } from "react-i18next";
import { useNotificationActions } from "src/features/inbox/notification/notification-context";
import { useCurrentPerson } from "src/hooks/use-session";
import { useWorkspacePeople } from "../hooks/use-workspace-people";
import { rowIdText } from "../utils/row-summary";

export function CardActionsProvider({ children }: { children: ReactNode }) {
  const {
    source,
    sortedRecords,
    visibleProperties,
    db,
    editor,
    attrs,
    moveRecordBy,
    canMoveRecord,
  } = useDatabaseContext();
  const databaseId = attrs.id;
  const { setActivePageId } = useActivePageActions();
  const { rowUrl } = useRowLinks();
  const toast = useToast();
  const { t } = useTranslation();
  const { addNotification } = useNotificationActions();
  const { person: me } = useCurrentPerson();
  const people = useWorkspacePeople();
  const { setTarget } = usePageViewActions();
  const { setCellValue, removeRecordAsync, addRecordAsync } = useDataSource(
    source?.id,
  );

  const deleteRecords = useDeleteRecords(removeRecordAsync);

  const dbRef = useRef(db);
  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  // For page-level patches (favorite / move / icon) — the source doesn't expose
  // a page patch, so use the same mutation the data source uses internally.
  const { mutate: patchPageMutate } = usePatchPage(({ id, patch }) =>
    patchPageApi(id, patch),
  );

  const value = useMemo<CardActionsValue>(() => {
    const recordById = new Map(sortedRecords.map((r) => [r.id, r]));
    const getRecord = (id: ID) => recordById.get(id) ?? null;
    const isFavorite = (id: ID) => getRecord(id)?.category === "Favorites";

    return {
      getRecord,
      properties: visibleProperties,
      isFavorite,

      setValue: (recordId, propertyId, v) =>
        setCellValue(recordId, propertyId, v as CellValue<PropertyType>),

      // Undoable (#170). Several records deleted together (the record menu
      // calls this once per record) share one toast.
      deleteRecord: (recordId) => deleteRecords([recordId]),

      duplicateRecord: (recordId) => {
        const r = getRecord(recordId);
        if (!r) return;
        // No dedicated duplicate on the source — seed a new record. If the
        // source gains addRecordAsync({ values }) later, copy r.values here.
        void addRecordAsync({ title: r.title ?? "" });
      },

      toggleFavorite: (recordId) => {
        const r = getRecord(recordId);
        patchPageMutate({
          id: recordId,
          patch: {
            category: r?.category === "Favorites" ? "Private" : "Favorites",
          },
        });
      },

      // Moved under another page, a record leaves the database: it becomes
      // an ordinary page there (no source, no property values), and its
      // row/card goes from this database's document and selection.
      moveRecord: (recordId, newParentId, category) => {
        patchPageMutate({
          id: recordId,
          patch: {
            parentId: newParentId,
            category: (category as PageCategory) ?? "Private",
            sourceId: null,
            values: null,
          },
        });
        if (editor && !editor.isDestroyed && databaseId) {
          removeRecordNodes(editor, databaseId, [recordId]);
          if (recordSelection.isSelected(databaseId, recordId)) {
            recordSelection.toggle(databaseId, recordId);
          }
        }
      },

      setRecordIcon: (recordId, iconName, color, target) => {
        const r = getRecord(recordId);
        patchPageMutate({
          id: recordId,
          patch: {
            cover: {
              ...(r?.cover ?? {
                coverImage: null,
                gradient: null,
                positionY: null,
              }),
              iconName,

              color: color ?? null,
              target: (target as Target | undefined) ?? "Icons",
            },
          },
        });
      },
      setRecordCoverPosition: (recordId, positionY) => {
        const r = getRecord(recordId);
        if (!r) return;
        patchPageMutate({
          id: recordId,
          patch: { cover: { ...r.cover, positionY } },
        });
      },
      moveRecordBy,
      canMoveRecord,
      openInRecord: (recordId, mode) => {
        if (mode === "sidePeek") {
          noteRecordOpener(recordId);
          setTarget({ pageId: recordId, view: "Peek" });
        } else {
          // New tab = full page.
          setActivePageId(recordId);
        }
      },

      copyRecordLink: (recordId) => {
        void navigator.clipboard
          .writeText(rowUrl(recordId))
          .then(() => toast.show(t("database.rowLink.copied"), "success"))
          .catch(() => toast.show(t("database.rowLink.failed"), "error"));
      },

      askToLook: (recordId, personId) => {
        const row = sortedRecords.find((r) => r.id === recordId);
        if (!row) return;
        const idText = rowIdText(row, source);
        const title = row.title || t("rowMention.untitled");
        // "TASK-12 · Fix login" — the ID first, when there is one.
        const name = idText ? `${idText} · ${title}` : title;
        addNotification({
          type: "row-look",
          recipientId: personId,
          // A new notification each time: asking again is a new ask.
          dedupKey: `row-look:${recordId}:${personId}:${Date.now()}`,
          title: t("database.askToLook.notifTitle", {
            who: me?.name || t("database.askToLook.someone"),
          }),
          message: name,
          sourcePageId: recordId,
          sourcePageTitle: name,
          mentionId: recordId,
          mentionLabel: idText || title,
        });
        const who = people.find((p) => p.id === personId)?.name ?? "";
        toast.show(t("database.askToLook.sent", { name: who }), "success");
      },

      openLayout: () => dbRef.current.openViewOptionsAt({ type: "layout" }),
      openPropertyVisibility: () =>
        dbRef.current.openViewOptionsAt({ type: "properties" }),
      openEditProperty: (propertyId) =>
        dbRef.current.setOpenPropertyId(propertyId),

      onEditGroups: () => dbRef.current.openViewOptionsAt({ type: "group" }),
    };
  }, [
    sortedRecords,
    visibleProperties,
    patchPageMutate,
    setCellValue,
    deleteRecords,
    addRecordAsync,
    setActivePageId,
    setTarget,
    editor,
    databaseId,
    moveRecordBy,
    canMoveRecord,
    rowUrl,
    toast,
    t,
    addNotification,
    me?.name,
    people,
    source,
  ]);

  // Publish to the store for the portaled drag-handle Menu (outside the tree),
  // under this database's id: a page can hold several databases.
  useEffect(() => {
    if (!databaseId) return;
    cardActionsStore.set(databaseId, value);
    return () => cardActionsStore.clear(databaseId, value);
  }, [value, databaseId]);

  return (
    <CardActionsContext.Provider value={value}>
      {children}
    </CardActionsContext.Provider>
  );
}
