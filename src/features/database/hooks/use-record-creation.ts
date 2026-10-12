import { useCallback, useMemo } from "react";
import type { Editor } from "@tiptap/core";
import type {
  DatabaseAttrs,
  DataSource,
  ID,
  Page,
  CellValue,
  PropertyType,
  DatabaseProperty,
} from "src/types";
import { insertRecordNode } from "./use-database-seed";
import { NONE_KEY, valueForGroupKey } from "../utils/group-records";
import { canWriteGroupValue } from "../utils/group-key";
import { useWorkspacePeople } from "./use-workspace-people";
import { startingTemplateId } from "../utils/row-templates";

export function useRecordCreation({
  editor,
  attrs,
  source,
  groupProp,
  addRecordAsync,
  setCellValue,
  setEditingRecordId,
}: {
  editor: Editor;
  attrs: DatabaseAttrs;
  source: DataSource | null;
  groupProp: DatabaseProperty | undefined;
  addRecordAsync: (opts?: {
    title?: string;
    templateId?: string;
  }) => Promise<Page>;
  setCellValue: (
    recordId: string,
    propertyId: string,
    value: CellValue<PropertyType>,
  ) => void;
  setEditingRecordId: (id: ID) => void;
}) {
  // A new row in a person group gets that person (with their name).
  const people = useWorkspacePeople();
  const personName = useMemo(() => {
    const names = new Map(people.map((p) => [p.id, p.name] as const));
    return (id: string) => names.get(id);
  }, [people]);

  // Insert the freshly-created page's node into the editor, if the db is wired.
  const insertNode = useCallback(
    (page: Page) => {
      if (editor && attrs.id && attrs.sourceId && source) {
        insertRecordNode(
          editor,
          attrs.id,
          attrs.sourceId,
          page,
          source.properties,
        );
      }
    },
    [editor, attrs.id, attrs.sourceId, source],
  );

  // New rows start from the default template, when there is one.
  const newRecordOpts = useCallback(() => {
    const templateId = startingTemplateId(source);
    return templateId ? { templateId } : { title: "" };
  }, [source]);

  const onNewRecord = useCallback(() => {
    addRecordAsync(newRecordOpts())
      .then((page) => {
        insertNode(page);
        setEditingRecordId(page.id);
      })
      .catch((error) => console.error("Failed to create page", error));
  }, [addRecordAsync, insertNode, setEditingRecordId, newRecordOpts]);

  const onNewRecordInGroup = useCallback(
    (groupKey: string) => {
      // The column's value goes over the template's.
      addRecordAsync(newRecordOpts())
        .then((page) => {
          insertNode(page);
          // Computed groups (formula, rollup, created by…) can't be set.
          if (
            groupProp &&
            groupKey !== NONE_KEY &&
            canWriteGroupValue(groupProp)
          ) {
            setCellValue(
              page.id,
              groupProp.id,
              valueForGroupKey(groupKey, groupProp, { personName }) as never,
            );
          }
          setEditingRecordId(page.id);
        })
        .catch((error) => console.error("Failed to create page", error));
    },
    [
      addRecordAsync,
      newRecordOpts,
      insertNode,
      setCellValue,
      groupProp,
      setEditingRecordId,
      personName,
    ],
  );

  return { onNewRecord, onNewRecordInGroup };
}
