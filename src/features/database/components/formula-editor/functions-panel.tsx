import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CardItemGroup,
  CardGroupLabel,
} from "src/components/tiptap-ui-primitive/card";
import { Button } from "src/components/tiptap-ui-primitive/button";
import {
  FORMULA_CATEGORIES,
  FORMULA_HELP,
  type FormulaFunctionHelp,
} from "./formula-help";

interface FunctionsPanelProps {
  selectedName: string | undefined;
  onSelect: (f: FormulaFunctionHelp) => void;
  // Inserts the call into the formula — focus-gated downstream like the
  // properties panel, so with the editor unfocused a click only shows help.
  onInsert?: (f: FormulaFunctionHelp) => void;
}

/** Every function the formula editor runs, grouped, with a search. */
export default function FunctionsPanel({
  selectedName,
  onSelect,
  onInsert,
}: FunctionsPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? FORMULA_HELP.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            t(`database.formulaHelp.fn.${f.name}`).toLowerCase().includes(q),
        )
      : FORMULA_HELP;
    return FORMULA_CATEGORIES.map((category) => ({
      category,
      items: matches.filter((f) => f.category === category),
    })).filter((g) => g.items.length > 0);
  }, [query, t]);

  return (
    <CardItemGroup
      orientation="vertical"
      style={{
        alignItems: "stretch",
        gap: 6,
        width: "100%",
        // See properties-panel: drop the primitive's max-content floor.
        minWidth: 0,
      }}
    >
      <div className="formula-functions__head">
        <CardGroupLabel>{t("database.formulaHelp.functions")}</CardGroupLabel>
        <input
          className="formula-functions__search"
          placeholder={t("database.formulaHelp.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // Keep typing here out of the formula editor's shortcuts.
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>

      <div className="formula-functions__list">
        {groups.length === 0 && (
          <span className="formula-functions__empty">
            {t("database.formulaHelp.none")}
          </span>
        )}
        {groups.map(({ category, items }) => (
          <div key={category} className="formula-functions__group">
            <span className="formula-functions__category">
              {t(`database.formulaHelp.category.${category}`)}
            </span>
            <div className="formula-functions__grid">
              {items.map((f) => (
                <Button
                  key={f.name}
                  variant="ghost"
                  style={{
                    width: "100%",
                    height: 26,
                    minHeight: 26,
                    padding: "0 6px",
                    justifyContent: "flex-start",
                    borderRadius: "var(--tt-radius-sm)",
                  }}
                  data-highlighted={f.name === selectedName}
                  // Keep the formula editor focused (see properties-panel).
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(f);
                    onInsert?.(f);
                  }}
                >
                  <code className="tiptap-button-text formula-functions__name">
                    {f.name}
                  </code>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CardItemGroup>
  );
}
