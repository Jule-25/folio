import type {
  Page,
  CellValue,
  DatabaseProperty,
  CellValueMap,
} from "src/types";
import { useDataSource } from "src/hooks/use-data-sources";
import { usePatchPage } from "src/hooks/use-patch-page";
import { patchPage as patchPageApi } from "src/api/pages";
import { PROPERTY_TYPE_ICONS } from "src/types/property-type-meta";
import { DynamicIcon } from "src/features/pages/cover/dynamic-icon";
import { TextCellDisplay } from "src/features/database/primitives/text-cell-display";
import { NumberCellDisplay } from "src/features/database/primitives/number-cell-display";
import { SelectCellDisplay } from "src/features/database/primitives/select-cell-display";
import { StatusCellDisplay } from "src/features/database/primitives/status-cell-display";
import { CheckboxCellDisplay } from "src/features/database/primitives/checkbox-cell-display";
import { MultiSelectCellDisplay } from "src/features/database/primitives/multi-select-cell-display";
import { DateCellDisplay } from "src/features/database/primitives/date-cell-display";
import { EmailCellDisplay } from "src/features/database/primitives/email-cell-display";
import { UrlCellDisplay } from "src/features/database/primitives/url-cell-display";
import { PhoneCellDisplay } from "src/features/database/primitives/phone-cell-display";
import { RelationCell } from "src/features/database/components/cells/relation-cell";
import { RollupCell } from "src/features/database/components/cells/rollup-cell";
import { evaluateFormula } from "src/features/database/components/formula-editor/formula-evaluator";
import { PersonCellDisplay } from "src/features/database/primitives/person-cell-display";
import {
  findPerson,
  useWorkspacePeople,
} from "src/features/database/hooks/use-workspace-people";
import "./record-property-panel.scss";
import i18n from "src/i18n/config";
import { useTranslation } from "react-i18next";
import { formatRelativeTime } from "src/utils/format-relative";
import { useFormulaEngineReady } from "../components/formula-editor/formula-engine";

export function RecordPropertyPanel({ page }: { page: Page }) {
  const { data: source } = useDataSource(page.sourceId);
  const patchPage = usePatchPage(({ id, patch }) => patchPageApi(id, patch));

  // not a row, or schema not loaded → nothing to show
  if (page.sourceId == null || page.values == null || !source) return null;

  const values = page.values;

  const updateCell = (propertyId: string, newValue: CellValue) => {
    patchPage.mutate({
      id: page.id,
      patch: { values: { ...values, [propertyId]: newValue } },
    });
  };

  // Title is excluded: it's the page's own title, shown at the top of the page,
  // not a property row.
  const properties = source.properties.filter((p) => p.config.type !== "title");
  if (properties.length === 0) return null;

  return (
    <div className="record-prop-panel">
      {properties.map((prop) => (
        <PropertyRow
          key={prop.id}
          prop={prop}
          page={page}
          value={values[prop.id]}
          onChange={(v) => updateCell(prop.id, v)}
          allProperties={source.properties}
        />
      ))}
    </div>
  );
}

function PropertyRow({
  prop,
  page,
  value,
  onChange,
  allProperties,
}: {
  prop: DatabaseProperty;
  page: Page;
  value: CellValue;
  onChange: (v: CellValue) => void;
  /** the whole schema — a rollup resolves its relation through it */
  allProperties: DatabaseProperty[];
}) {
  // PROPERTY_TYPE_ICONS holds Material Symbols NAME STRINGS now — not icon
  // components — so it's rendered through DynamicIcon rather than as <Icon />.
  const iconName = PROPERTY_TYPE_ICONS[prop.config.type];
  const { t } = useTranslation();
  const people = useWorkspacePeople();

  useFormulaEngineReady();

  // Created by / Edited by: one person, resolved from the page itself.
  const personRef = (id: string | null | undefined) => {
    const person = findPerson(people, id);
    return (
      <PersonCellDisplay
        value={person ? [person] : []}
        people={people}
        onChange={() => {}}
        readonly
      />
    );
  };

  const rendered = (() => {
    switch (prop.config.type) {
      case "text":
        return (
          <TextCellDisplay
            value={value as CellValueMap["text"]}
            onChange={(v) => onChange(v as CellValue)}
          />
        );

      case "number":
        return (
          <NumberCellDisplay
            value={(value as CellValueMap["number"]) ?? null}
            format={prop.config.format}
            prefix={prop.config.prefix}
            suffix={prop.config.suffix}
            decimalPlaces={prop.config.decimalPlaces}
            // No bar/ring in the panel: those render against a COLUMN's max,
            // which doesn't exist here — a single record has no column.
            showAs="number"
            onChange={(v) => onChange(v as CellValue)}
            align="left"
          />
        );

      case "select":
        return (
          <SelectCellDisplay
            value={value as CellValueMap["select"]}
            options={prop.config.options}
            onChange={onChange}
          />
        );

      case "status":
        return (
          <StatusCellDisplay
            value={
              (value as CellValueMap["status"]) ??
              prop.config.groups.flatMap((g) => g.items)[0].name
            }
            groups={prop.config.groups}
            onChange={(item) => onChange(item.id)}
          />
        );

      case "checkbox":
        return (
          <CheckboxCellDisplay
            value={(value as CellValueMap["checkbox"]) ?? false}
            onChange={() => onChange(!value)}
          />
        );

      case "multi_select":
        return (
          <MultiSelectCellDisplay
            value={(value as CellValueMap["multi_select"]) ?? []}
            options={prop.config.options}
            onChange={onChange}
          />
        );

      case "date":
        return (
          <DateCellDisplay
            value={value as CellValueMap["date"]}
            onChange={onChange}
          />
        );

      case "email":
        return (
          <EmailCellDisplay
            value={(value as string) ?? ""}
            onChange={(v) => onChange(v as CellValue)}
          />
        );

      case "url":
        return (
          <UrlCellDisplay
            value={(value as string) ?? ""}
            onChange={(v) => onChange(v as CellValue)}
          />
        );

      case "phone":
        return (
          <PhoneCellDisplay
            value={(value as string) ?? ""}
            onChange={(v) => onChange(v as CellValue)}
          />
        );

      case "person":
        return (
          <PersonCellDisplay
            value={(value as CellValueMap["person"]) ?? []}
            people={people}
            onChange={(v) => onChange(v as CellValue)}
            single={prop.config.limit === "single"}
          />
        );

      // ── Computed / record-level: read-only, and NOT from values[] ──────────
      // These live on the page itself, not in values[] — reading values[propId]
      // returns null, which is why they rendered empty.
      case "created_time":
        return (
          <span className="record-prop-panel__value record-prop-panel__value--text">
            {formatRelativeTime(page.createdAt, t, i18n.language)}
          </span>
        );

      case "edited_time":
        return (
          <DateCellDisplay
            value={page.updatedAt as CellValueMap["date"]}
            onChange={() => {}}
            readonly
          />
        );

      case "created_by":
        return personRef(page.ownerId);

      case "edited_by":
        return personRef(page.editedBy ?? page.ownerId);

      // Both sides of a two-way relation are editable here too.
      case "relation":
        return (
          <RelationCell
            value={value as CellValueMap["relation"]}
            config={prop.config}
            onChange={(v) => onChange(v as CellValue)}
            recordId={page.id}
            unwrapped={false}
            className="record-prop-panel__value"
          />
        );

      case "rollup":
        return (
          <RollupCell
            config={prop.config}
            record={page}
            properties={allProperties}
            className="record-prop-panel__value"
          />
        );

      case "formula": {
        const result = evaluateFormula(prop.config.expression, {
          properties: allProperties,
          cellValues: page.values ?? {},
          page,
          personName: (id) => findPerson(people, id)?.name,
        });
        return (
          <span className="record-prop-panel__value record-prop-panel__value--text">
            {typeof result === "boolean"
              ? result
                ? "☑"
                : "☐"
              : (result ?? "")}
          </span>
        );
      }
      // Anything else has no display in the panel yet; returning null drops
      // the whole row rather than showing a broken one.
      default:
        return null;
    }
  })();

  if (!rendered) return null;

  return (
    <div className="record-prop-panel__row">
      <div className="record-prop-panel__label">
        <DynamicIcon
          name={iconName}
          size={20}
          filled={false}
          className="record-prop-panel__label-icon"
        />
        <span>{prop.name}</span>
      </div>
      <div className="record-prop-panel__value-wrapper">{rendered}</div>
    </div>
  );
}
