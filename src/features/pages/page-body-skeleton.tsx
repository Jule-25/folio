import type { Page } from "src/types";
import { useDataSource } from "src/hooks/use-data-sources";
import { Bone } from "src/components/tiptap-ui-primitive/bone/bone";
import "src/features/database/record-property-panel/record-property-panel.scss";
import "./page-body-skeleton.scss";

// Body lines: varied widths so they read as prose, in a fixed pattern
// (random widths would change on every render and flicker).
const LINE_WIDTHS = [92, 78, 85, 60, 88, 71];
const LABEL_WIDTHS = [70, 92, 58, 80];
const VALUE_WIDTHS = [120, 86, 150, 64];

/**
 * What the peek and center views show while the page's live document syncs
 * and the editor starts. Laid out in the same box as the editor
 * (`contentClassName` is the class the view gives EditorContent), so the
 * swap to the real page moves nothing:
 *   • the title is the real one — the page is already known;
 *   • a database row gets one bone row per property, like the property
 *     panel it will show (the schema is usually cached by the open view);
 *   • then a few lines of body.
 */
export function PageBodySkeleton({
  page,
  contentClassName,
}: {
  /** null while the page itself is still loading */
  page: Page | null;
  contentClassName: string;
}) {
  const isRow = page?.sourceId != null;
  const { data: source } = useDataSource(isRow ? page.sourceId : null);

  // The panel lists every property but the title.
  const propertyCount = !isRow
    ? 0
    : source
      ? source.properties.filter((p) => p.config.type !== "title").length
      : Object.keys(page.values ?? {}).length || 4;

  return (
    <div className={`${contentClassName} page-body-skeleton`} aria-busy="true">
      <div className="tiptap ProseMirror">
        {page ? (
          <h1 data-type="title" className={page.title ? undefined : "is-empty"}>
            {page.title}
          </h1>
        ) : (
          <div className="page-body-skeleton__title">
            <Bone width="55%" height={30} rounded />
          </div>
        )}

        {propertyCount > 0 && (
          <div className="record-prop-panel">
            {Array.from({ length: Math.min(propertyCount, 12) }).map((_, i) => (
              <div key={i} className="record-prop-panel__row">
                <span className="record-prop-panel__label">
                  <Bone width={16} height={16} rounded />
                  <Bone
                    width={LABEL_WIDTHS[i % LABEL_WIDTHS.length]}
                    height={12}
                    rounded
                  />
                </span>
                <span className="record-prop-panel__value-wrapper">
                  <Bone
                    width={VALUE_WIDTHS[i % VALUE_WIDTHS.length]}
                    height={12}
                    rounded
                  />
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="page-body-skeleton__lines">
          {LINE_WIDTHS.map((w, i) => (
            <Bone key={i} width={`${w}%`} height={14} rounded />
          ))}
        </div>
      </div>
    </div>
  );
}
