import type { Page } from "src/types";
import { colorForPersonId } from "./person-color";

/** A teamspace's colour: its icon's colour when it has one, otherwise a
 *  stable colour from its id. Used by its sidebar tile and its space. */
export function teamspaceTint(page: Page): string {
  const c = page.cover.color;
  if (page.cover.target === "Icons" && c && c !== "var(--tt-text-color)")
    return c;
  return colorForPersonId(page.id);
}
