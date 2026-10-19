// ─── CardActionsContext ─────────────────────────────────────────────────────
// React context for the record/card action handlers. In-tree consumers
// (board/gallery cards) read it directly. The portaled drag-handle Menu reads
// the store fallback — subscribed via useSyncExternalStore so it RE-RENDERS when
// the provider republishes (after a favorite toggles, an icon changes, etc.).
// A plain store.get() here would be non-reactive: the drag-handle menu would
// show a stale snapshot, which is exactly why favorites toggled in the in-tree
// card menu but not the portaled drag-handle menu.
import { useContext, useSyncExternalStore } from "react";
import { createContext } from "react";
import type { CardActionsValue } from "./card-actions-context-value";
import { cardActionsStore } from "./card-actions-store";

export const CardActionsContext = createContext<CardActionsValue | null>(null);

/** `databaseId`: for the portaled menu, which database's actions to read. */
export function useCardActions(
  databaseId?: string | null,
): CardActionsValue | null {
  const ctx = useContext(CardActionsContext);

  // Subscribe to the store regardless (hook order must be stable). When used
  // in-tree, ctx wins; when portaled (ctx null), the subscribed store value is
  // returned and updates reactively as the provider republishes.
  const read = () => cardActionsStore.get(databaseId);
  const stored = useSyncExternalStore(cardActionsStore.subscribe, read, read);

  return ctx ?? stored;
}
