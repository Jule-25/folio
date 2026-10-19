// ─── Card actions store ─────────────────────────────────────────────────────
// The drag-handle Menu is portaled to document.body — OUTSIDE the React tree,
// so it can't read the CardActionsContext. This module store is the bridge:
// CardActionsProvider publishes the current handler bundle here, and the
// portaled menu reads it (the same pattern recordSelection uses to cross that
// boundary). In-tree consumers (board/gallery cards) use the context directly;
// only the portal falls back to this.
//
// REACTIVE: the store notifies subscribers on every set/clear, so portaled
// consumers (via useSyncExternalStore in useCardActions) re-render when the
// provider republishes — e.g. after a favorite toggles and the bundle's
// isFavorite/getRecord reflect the new state. Without this, the portaled menu
// read a stale snapshot and never updated (the in-tree context path did update,
// which is why the toggle worked in the card menu but not the drag-handle menu).
//
import type { CardActionsValue } from "./card-actions-context-value";

// Keyed by database id. With one shared slot, the last database to render
// won, and the row menu of another database on the same page found no
// record (it showed nothing) or acted on the wrong database.
const bundles = new Map<string, CardActionsValue>();
let last: CardActionsValue | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export const cardActionsStore = {
  set(databaseId: string, value: CardActionsValue) {
    bundles.set(databaseId, value);
    last = value;
    emit();
  },
  /** Removes the bundle only if it's still the one this provider set. */
  clear(databaseId: string, value: CardActionsValue) {
    if (bundles.get(databaseId) !== value) return;
    bundles.delete(databaseId);
    if (last === value) last = null;
    emit();
  },
  /** This database's bundle; without an id, the latest one published. */
  get(databaseId?: string | null): CardActionsValue | null {
    return databaseId ? (bundles.get(databaseId) ?? null) : last;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
