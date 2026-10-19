import type {
  CellValue,
  DatabaseProperty,
  DataSource,
  ID,
  Page,
  PropertyType,
  RowTemplate,
} from "src/types";

/** Computed from the row itself (or other rows): never copied from a
 *  template, they're worked out for the new row. */
const COMPUTED: ReadonlySet<PropertyType> = new Set<PropertyType>([
  "formula",
  "rollup",
  "created_time",
  "edited_time",
  "created_by",
  "edited_by",
  "unique_id",
]);

/**
 * The cell values a new row gets from a template.
 *
 * A template made with "New template" is a page: you open it and set its
 * properties in its property panel, so its values live on that page
 * (`templatePage.values`), and `template.values` stays empty. A template
 * saved from an existing row keeps a snapshot in `template.values` instead.
 * Both count; the page wins where both have a value. Computed properties
 * and properties no longer in the schema are left out.
 */
export function templateValues(
  template: RowTemplate,
  templatePage: Page | undefined,
  properties: DatabaseProperty[],
): Record<ID, CellValue> {
  const settable = new Set(
    properties.filter((p) => !COMPUTED.has(p.config.type)).map((p) => p.id),
  );
  const out: Record<ID, CellValue> = {};
  for (const source of [template.values, templatePage?.values]) {
    for (const [id, value] of Object.entries(source ?? {})) {
      if (settable.has(id)) out[id] = structuredClone(value);
    }
  }
  return out;
}

/** The template new rows start from (the default, if it still exists). */
export function startingTemplateId(source: DataSource | null | undefined) {
  const id = source?.defaultTemplateId ?? null;
  return id && (source?.rowTemplates ?? []).some((t) => t.id === id)
    ? id
    : undefined;
}
