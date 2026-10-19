import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Page } from "src/types";
import { usePagesBase } from "src/hooks/use-pages";
import { useDataSource } from "src/hooks/use-data-sources";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "src/components/tiptap-ui-primitive/popover";
import { PageItemIcon } from "src/features/pages/page-item/page-item-icon";
import { useRowLinks } from "../../hooks/use-row-links";
import { rowIdText, rowSummary } from "../../utils/row-summary";
import "./row-mention.scss";

const OPEN_DELAY = 350;
const CLOSE_DELAY = 150;

/**
 * A mention of a database row: its ID ("TASK-12", when its database has an
 * ID property) and title. Clicking it opens the row where it lives (its
 * database, row in the peek — use-row-links); hovering shows a card with its
 * database and a few of its values.
 */
export function RowMention({
  rowId,
  label,
}: {
  rowId: string;
  /** The title when the mention was made — shown if the row isn't loaded. */
  label?: string;
}) {
  const { t } = useTranslation();
  const selectRow = useCallback(
    (pages: Page[]) => pages.find((p) => p.id === rowId),
    [rowId],
  );
  const { data: row } = usePagesBase(selectRow);
  const { data: source } = useDataSource(row?.sourceId ?? null);
  // The database is named by its page's title.
  const dbPageId = source?.pageId ?? null;
  const selectDbTitle = useCallback(
    (pages: Page[]) => pages.find((p) => p.id === dbPageId)?.title,
    [dbPageId],
  );
  const { data: dbTitle } = usePagesBase(selectDbTitle);
  const dbName = dbTitle || source?.name;
  const { openRow } = useRowLinks();

  const gone = !row || row.deletedAt != null;
  const idText = row ? rowIdText(row, source) : "";
  const title = row?.title || label || t("rowMention.untitled");

  // Hover card: opens after a short pause, stays while the pointer is on the
  // chip or the card.
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const later = (next: boolean, ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), ms);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const summary = row && source ? rowSummary(row, source) : [];

  return (
    <Popover open={open && !gone} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          type="button"
          className="row-mention"
          data-gone={gone || undefined}
          contentEditable={false}
          onClick={() => {
            if (gone) return;
            setOpen(false);
            openRow(rowId);
          }}
          onPointerEnter={() => later(true, OPEN_DELAY)}
          onPointerLeave={() => later(false, CLOSE_DELAY)}
        >
          {row && <PageItemIcon cover={row.cover} styles={{ fontSize: 12 }} />}
          {idText && <span className="row-mention__id">{idText}</span>}
          <span className="row-mention__title">
            {gone ? t("rowMention.unavailable") : title}
          </span>
        </button>
      </PopoverAnchor>
      <PopoverContent
        side="bottom"
        align="start"
        className="row-mention-card"
        style={{ zIndex: 99999 }}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={() => later(true, 0)}
        onPointerLeave={() => later(false, CLOSE_DELAY)}
      >
        <div className="row-mention-card__head">
          {row && <PageItemIcon cover={row.cover} styles={{ fontSize: 16 }} />}
          <span className="row-mention-card__title">{title}</span>
          {idText && <span className="row-mention__id">{idText}</span>}
        </div>
        {dbName && (
          <div className="row-mention-card__source">
            {t("rowMention.in", { name: dbName })}
          </div>
        )}
        {summary.length > 0 && (
          <dl className="row-mention-card__values">
            {summary.map(({ name, text }) => (
              <div key={name} className="row-mention-card__value">
                <dt>{name}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="row-mention-card__hint">{t("rowMention.open")}</div>
      </PopoverContent>
    </Popover>
  );
}
