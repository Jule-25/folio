import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ID } from "src/types";
import { useToast } from "src/features/shell/toast";
import { pendingRecordDeletes } from "../utils/pending-record-deletes";

/**
 * Delete records with an Undo toast (#170). The rows disappear at once; their
 * pages are deleted when the toast's time is up, unless Undo is pressed.
 * Takes the caller's removeRecordAsync (from its useDataSource). Removing
 * the record nodes from the document stays the caller's job, as before.
 */
export function useDeleteRecords(
  removeRecordAsync: (recordId: ID) => Promise<unknown>,
) {
  const { t } = useTranslation();
  const { show } = useToast();

  return useCallback(
    (recordIds: ID[]) =>
      pendingRecordDeletes.schedule(
        recordIds,
        removeRecordAsync,
        (batchId, count) =>
          show(t("database.rowsDeleted", { count }), "success", {
            label: t("trash.undo"),
            onClick: () => pendingRecordDeletes.undo(batchId),
          }),
      ),
    [removeRecordAsync, show, t],
  );
}
