import { useTranslation } from "react-i18next";
import { DEFAULT_LOAD_LIMIT, LOAD_LIMIT_OPTIONS } from "../../utils/load-limit";
import "./load-limit-picker.scss";

/**
 * "Load limit" in the Layout panel (table and list): how many rows show
 * before "Load more". 0 = all of them.
 */
export function LoadLimitPicker({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  const current = value ?? DEFAULT_LOAD_LIMIT;

  return (
    <div className="db-load-limit">
      <span className="db-load-limit__label" id="db-load-limit-label">
        {t("database.layout.loadLimit")}
      </span>
      <div
        className="db-load-limit__options"
        role="radiogroup"
        aria-labelledby="db-load-limit-label"
      >
        {LOAD_LIMIT_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={current === n}
            className="db-load-limit__option"
            onClick={() => onChange(n)}
          >
            {n === 0 ? t("database.layout.loadAll") : n}
          </button>
        ))}
      </div>
    </div>
  );
}
