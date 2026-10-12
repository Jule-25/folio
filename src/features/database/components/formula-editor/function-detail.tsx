import { useTranslation } from "react-i18next";
import {
  CardItemGroup,
  CardGroupLabel,
} from "src/components/tiptap-ui-primitive/card";
import { Separator } from "src/components/tiptap-ui-primitive/separator";
import { Button } from "src/components/tiptap-ui-primitive/button";
import { DynamicIcon } from "src/features/pages/cover/dynamic-icon";
import type { FormulaFunctionHelp } from "./formula-help";

interface FunctionDetailProps {
  fn: FormulaFunctionHelp;
  /** Put the call (or the example) into the formula. */
  onInsert: (text: string, cursor?: number) => void;
  insertCall: { text: string; cursor: number };
}

/** One function: how to call it, what it does, and an example to insert. */
export default function FunctionDetail({
  fn,
  onInsert,
  insertCall,
}: FunctionDetailProps) {
  const { t } = useTranslation();

  return (
    <CardItemGroup
      style={{
        // Tracks the editor card: 500px on desktop, viewport-bound on phones.
        minWidth: "min(500px, calc(100vw - 32px))",
        width: "100%",
        alignItems: "stretch",
      }}
      orientation="vertical"
    >
      <div className="formula-fn-detail__head">
        <code className="formula-fn-detail__signature">{fn.signature}</code>
        <Button
          variant="ghost"
          size="small"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(insertCall.text, insertCall.cursor)}
        >
          <DynamicIcon name="add" size={14} filled={false} />
          <span className="tiptap-button-text">
            {t("database.formulaHelp.insert")}
          </span>
        </Button>
      </div>
      <p className="formula-fn-detail__description">
        {t(`database.formulaHelp.fn.${fn.name}`)}
      </p>

      <Separator style={{ height: 0.5 }} orientation="horizontal" />

      <CardItemGroup orientation="vertical">
        <CardGroupLabel>{t("database.formulaHelp.example")}</CardGroupLabel>
        <Button
          variant="ghost"
          style={{ gap: 6, justifyContent: "flex-start" }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(fn.example)}
        >
          <code
            className="tiptap-button-text formula-snippet"
            style={{ fontFamily: "monospace", fontSize: 12 }}
          >
            {fn.example}
          </code>
          {fn.result !== undefined && (
            <span className="formula-fn-detail__result">→ {fn.result}</span>
          )}
          <DynamicIcon name="content_copy" size={14} filled={false} />
        </Button>
      </CardItemGroup>
    </CardItemGroup>
  );
}
