// ─── Pending record deletes (Undo, #170) ────────────────────────────────────
// Deleting rows hides them at once and deletes their pages only after the
// Undo toast has had its time. Undo just un-hides them: nothing was deleted,
// and the database's self-healing seed (use-database-seed.ts) puts back any
// record node that was removed from the document.
//
// Module-level so the delete still happens if the database unmounts (the
// user leaves the page) before the timer runs out.
import type { ID } from "src/types";

/** How long the rows stay restorable. Matches the toast's life with an action. */
export const UNDO_MS = 8000;

interface Batch {
  id: number;
  recordIds: ID[];
  commit: () => Promise<unknown>;
  timer: ReturnType<typeof setTimeout>;
}

let hidden: ReadonlySet<ID> = new Set();
let current: Batch | null = null;
let openBatch: Batch | null = null; // still taking ids in this tick
let nextId = 1;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

function setHidden(next: Set<ID>) {
  hidden = next;
  emit();
}

function commitBatch(batch: Batch) {
  clearTimeout(batch.timer);
  if (current === batch) current = null;
  // Keep the rows hidden until their pages are gone, so they don't flash
  // back between the timer and the delete's optimistic cache update.
  void batch
    .commit()
    .catch(() => {})
    .finally(() => {
      const next = new Set(hidden);
      batch.recordIds.forEach((id) => next.delete(id));
      setHidden(next);
    });
}

export const pendingRecordDeletes = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(): ReadonlySet<ID> {
    return hidden;
  },

  /**
   * Hide `recordIds` now and run `deleteOne` for each when the undo window
   * closes. Deletes made while a batch is still pending join it and restart
   * its timer, so the newest toast ("Deleted 3 rows") and its Undo cover
   * everything not yet deleted. (The toast skips a message identical to one
   * on screen; a growing count keeps each new one distinct.) `notify` runs
   * once per tick, after it, with the batch's size so far.
   */
  schedule(
    recordIds: ID[],
    deleteOne: (id: ID) => Promise<unknown>,
    notify: (batchId: number, count: number) => void,
  ) {
    if (recordIds.length === 0) return;

    if (!openBatch) {
      let batch = current;
      if (batch) {
        clearTimeout(batch.timer);
      } else {
        const fresh: Batch = {
          id: nextId++,
          recordIds: [],
          commit: () => Promise.all(fresh.recordIds.map((id) => deleteOne(id))),
          timer: 0 as unknown as ReturnType<typeof setTimeout>,
        };
        batch = fresh;
      }
      const b = batch;
      b.timer = setTimeout(() => commitBatch(b), UNDO_MS);
      current = openBatch = b;
      queueMicrotask(() => {
        openBatch = null;
        notify(b.id, b.recordIds.length);
      });
    }

    const batch = openBatch;
    const next = new Set(hidden);
    for (const id of recordIds) {
      if (next.has(id)) continue;
      next.add(id);
      batch.recordIds.push(id);
    }
    setHidden(next);
  },

  /** Bring a batch's rows back, if its delete hasn't run yet. */
  undo(batchId: number) {
    const batch = current;
    if (!batch || batch.id !== batchId) return;
    clearTimeout(batch.timer);
    current = null;
    const next = new Set(hidden);
    batch.recordIds.forEach((id) => next.delete(id));
    setHidden(next);
  },
};

// Leaving the app with a delete pending: run it now rather than lose it.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (current) commitBatch(current);
  });
}
