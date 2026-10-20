import { beforeAll, expect, test } from "vitest";
import type { DatabaseProperty } from "src/types";
import { evaluateFormula } from "./formula-evaluator";
import { loadFormulaEngine } from "./formula-engine";

beforeAll(async () => {
  await loadFormulaEngine();
}, 60_000); // mathjs loads on first use; the first run can take a while

const text = (id: string, name: string): DatabaseProperty => ({
  id,
  name,
  config: { type: "text" },
});

test("prop() takes any property name and keeps similar names apart", () => {
  const properties = [
    text("due", "Date d'échéance"),
    text("eur", "Prix (€)"),
    text("gbp", "Prix (£)"),
    text("quote", 'Say "hi"'),
  ];
  const ctx = {
    properties,
    cellValues: { due: "2026-10-31", eur: "10", gbp: "20", quote: "yes" },
  };

  expect(evaluateFormula(`prop("Date d'échéance")`, ctx)).toBe("2026-10-31");
  expect(evaluateFormula(`prop("Prix (€)")`, ctx)).toBe("10");
  expect(evaluateFormula(`prop( 'Prix (£)' )`, ctx)).toBe("20");
  expect(evaluateFormula(`prop("Say \\"hi\\"")`, ctx)).toBe("yes");
});
