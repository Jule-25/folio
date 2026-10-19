import { useTranslation } from "react-i18next";
import type { CardLayout } from "src/types";
import "./card-layout-picker.scss";

/**
 * "Card layout" in the Layout panel (gallery and board): how a card lists
 * its properties. Compact — side by side, wrapping; List — one per line.
 * Each option is a small drawing of the card it gives.
 */
export function CardLayoutPicker({
  value,
  onChange,
}: {
  value: CardLayout;
  onChange: (value: CardLayout) => void;
}) {
  const { t } = useTranslation();
  const options = [
    { value: "compact", label: t("database.layout.cardLayoutCompact") },
    { value: "list", label: t("database.layout.cardLayoutList") },
  ] as const;

  return (
    <div className="db-card-layout">
      <div className="db-card-layout__label">
        {t("database.layout.cardLayout")}
      </div>
      <div
        className="db-card-layout__options"
        role="radiogroup"
        aria-label={t("database.layout.cardLayout")}
      >
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              data-selected={selected || undefined}
              className="db-card-layout__option"
              onClick={() => onChange(o.value)}
            >
              <span className="db-card-layout__preview" aria-hidden="true">
                {o.value === "list" && (
                  <span className="db-card-layout__band" />
                )}
                <span className="db-card-layout__dot" />
                {o.value === "compact" ? (
                  <>
                    <span className="db-card-layout__bars">
                      <span className="db-card-layout__bar" />
                      <span className="db-card-layout__bar" />
                      <span className="db-card-layout__bar" />
                    </span>
                    <span className="db-card-layout__bars">
                      <span className="db-card-layout__bar" />
                      <span className="db-card-layout__bar" />
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      className="db-card-layout__bar"
                      style={{ width: "60%" }}
                    />
                    <span
                      className="db-card-layout__bar"
                      style={{ width: "42%" }}
                    />
                  </>
                )}
              </span>
              <span className="db-card-layout__name">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
