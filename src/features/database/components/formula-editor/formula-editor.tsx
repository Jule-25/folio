import { DynamicIcon } from "src/features/pages/cover/dynamic-icon";
import { useState, useRef, useMemo, useEffect } from "react";
import type { DatabaseProperty, ID, ConfigOf } from "src/types";
import { useDatabaseContext } from "../../context/database-context";
import { useDataSource } from "../../hooks/use-data-source";
import { resolveFormulaValues } from "./resolve-formula-values";
import { propCall, validateFormula } from "./formula-evaluator";
import FormulaBar, { type FormulaBarHandle } from "./formula-bar";
import PropertiesPanel from "./properties-panel";
import PropertyDetail from "./property-detail";
import FunctionsPanel from "./functions-panel";
import FunctionDetail from "./function-detail";
import { insertFor, type FormulaFunctionHelp } from "./formula-help";
import {
  Card,
  CardBody,
  CardHeader,
  CardItemGroup,
} from "src/components/tiptap-ui-primitive/card";
import { Separator } from "src/components/tiptap-ui-primitive/separator";
import { usePagesBase } from "src/hooks/use-pages";
import { loadFormulaEngine, useFormulaEngineReady } from "./formula-engine";

interface FormulaEditorProps {
  propertyId: ID;
  properties: DatabaseProperty[];
  onDone: () => void;
}

export default function FormulaEditor({
  propertyId,
  properties,
  onDone,
}: FormulaEditorProps) {
  const { db, attrs } = useDatabaseContext();
  const { source, setCellValue } = useDataSource(attrs.sourceId);
  const { data: pages } = usePagesBase((pages) =>
    pages.filter((p) => p.sourceId === source?.id),
  );

  const formulaProperty = properties.find((p) => p.id === propertyId);
  const initialExpression =
    formulaProperty?.config.type === "formula"
      ? formulaProperty.config.expression
      : "";

  const [formula, setFormula] = useState(initialExpression);
  const [selectedProperty, setSelectedProperty] =
    useState<DatabaseProperty | null>(properties[0] ?? null);
  // The help below shows the property or the function picked last.
  const [selectedFunction, setSelectedFunction] =
    useState<FormulaFunctionHelp | null>(null);

  function selectProperty(prop: DatabaseProperty) {
    setSelectedProperty(prop);
    setSelectedFunction(null);
  }

  const formulaBarRef = useRef<FormulaBarHandle>(null);

  // Opening the editor starts the mathjs download; the check runs once it
  // has loaded.
  const formulaReady = useFormulaEngineReady();
  useEffect(() => {
    void loadFormulaEngine();
  }, []);
  const error = useMemo(
    () =>
      formulaReady
        ? validateFormula(formula, { properties, cellValues: {} })
        : null,
    [formula, properties, formulaReady],
  );

  async function handleDone() {
    const newConfig = {
      type: "formula",
      expression: formula,
    } satisfies ConfigOf<"formula">;

    const updatedProperties = properties.map((p) =>
      p.id === propertyId ? { ...p, config: newConfig } : p,
    );

    db.updateProperty(propertyId, { config: newConfig });
    if (!source) return;

    await loadFormulaEngine(); // write real values, not nulls
    resolveFormulaValues(pages ?? [], updatedProperties, setCellValue);
    onDone();
  }

  // Focus-gated inside FormulaBar: only inserts when the editor has focus.
  function handleInsertSnippet(snippet: string, cursor?: number) {
    formulaBarRef.current?.insertSnippet(snippet, cursor);
  }

  // The Insert buttons in the function help: always insert, focusing the
  // formula first (the caret stays where it was).
  function insertNow(text: string, cursor?: number) {
    formulaBarRef.current?.focus();
    formulaBarRef.current?.insertSnippet(text, cursor);
  }

  return (
    <Card
      className="formula-editor"
      // 600px on a wide screen, but never wider than the viewport minus the
      // 16px gutters. The editor opens in a flyout anchored to a property
      // header, so a flat 600px floor pushed it off-screen on phones.
      style={{ width: "min(600px, calc(100vw - 32px))" }}
    >
      <CardHeader>
        <CardItemGroup style={{ width: "100%" }}>
          <FormulaBar
            ref={formulaBarRef}
            formula={formula}
            properties={properties}
            onChange={setFormula}
            onDone={handleDone}
          />
          {error && (
            <div className="formula-error" role="alert">
              <DynamicIcon
                name="warning"
                size={13}
                filled={false}
                className="formula-error__icon"
              />
              <span>{error}</span>
            </div>
          )}
        </CardItemGroup>
      </CardHeader>
      <CardBody style={{ width: "100%", padding: "6px 10px" }}>
        {/* Stacked, full width: properties flow into a multi-column grid on
            top, the selected property's detail/examples sit below with room
            for long formula strings. Replaces the old cramped 1fr/3fr split. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <PropertiesPanel
            properties={properties}
            selectedPropertyId={selectedProperty?.id}
            onSelectProperty={selectProperty}
            onInsertProperty={(prop) =>
              handleInsertSnippet(propCall(prop.name))
            }
          />
          <FunctionsPanel
            selectedName={selectedFunction?.name}
            onSelect={setSelectedFunction}
            onInsert={(f) => {
              const { text, cursor } = insertFor(f);
              handleInsertSnippet(text, cursor);
            }}
          />
          <Separator style={{ height: 0.5 }} orientation="horizontal" />
          {selectedFunction ? (
            <FunctionDetail
              fn={selectedFunction}
              insertCall={insertFor(selectedFunction)}
              onInsert={insertNow}
            />
          ) : (
            <PropertyDetail
              property={selectedProperty}
              properties={properties}
              onInsertSnippet={handleInsertSnippet}
            />
          )}
        </div>
      </CardBody>
    </Card>
  );
}
