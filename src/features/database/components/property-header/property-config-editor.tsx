// ─── PropertyConfigEditor ─────────────────────────────────────────────────
// The per-type edit surface (select / status / relation / rollup / formula /
// number / date / person). Each branch renders its own PropertyEditPopover.
// Re-derives db + source from context; onClose lets the formula editor close

import type { DatabaseProperty, PropertyConfig, SelectOption } from "src/types";
import { useDatabaseContext } from "../../context/database-context";
import { useDataSource } from "../../hooks/use-data-source";
import { PropertyEditPopover } from "../property-edit-popover";
import { SelectOptionsEditor } from "../../ui/select/select-options-editor";
import { StatusEditDisplay } from "../../ui/status/status-edit-display";
import { RelationEditDisplay } from "../relation-edit-display";
import { RollupEditDisplay } from "../rollup-edit-display";
import FormulaEditor from "../formula-editor/formula-editor";
import { NumberEditDisplay } from "../number-edit-display";
import { DateEditDisplay } from "../date-edit-display/date-edit-display";
import { PersonEditDisplay } from "../person-edit-display";
import { MenuRow } from "../menu-row";
import { MoveHorizontal, Smile } from "lucide-react";
import { useState } from "react";
import { Input } from "src/components/tiptap-ui-primitive/input";
import { formatUniqueId } from "src/lib/unique-id";

// the parent header popover.
export function PropertyConfigEditor({
  prop,
  onClose,
}: {
  prop: DatabaseProperty;
  onClose: () => void;
}) {
  const { db, attrs } = useDatabaseContext();
  const { source } = useDataSource(attrs.sourceId);
  const statusConfig = prop.config.type === "status" ? prop.config : null;

  return (
    <>
      {prop.config.type === "select" && (
        <PropertyEditPopover>
          <SelectOptionsEditor
            options={prop.config.options}
            onEditOption={(option) =>
              db.updateProperty(prop.id, {
                ...prop,
                config: {
                  ...prop.config,
                  options: (
                    prop.config as {
                      type: typeof prop.config.type;
                      options: SelectOption[];
                    }
                  ).options.map((o) => (o.id !== option.id ? o : option)),
                } as PropertyConfig,
              })
            }
            onChange={(options) =>
              db.updateProperty(prop.id, {
                ...prop,
                config: {
                  ...(prop.config as {
                    type: "select";
                    options: SelectOption[];
                  }),
                  options,
                },
              })
            }
          />
        </PropertyEditPopover>
      )}
      {statusConfig && (
        <PropertyEditPopover>
          <StatusEditDisplay
            groups={statusConfig.groups}
            onChange={(groups) =>
              db.updateProperty(prop.id, {
                ...prop,
                config: { ...statusConfig, groups },
              })
            }
          />
        </PropertyEditPopover>
      )}
      {prop.config.type === "multi_select" && (
        <PropertyEditPopover>
          <SelectOptionsEditor
            options={prop.config.options}
            onEditOption={(option) =>
              db.updateProperty(prop.id, {
                ...prop,
                config: {
                  ...prop.config,
                  options: (
                    prop.config as {
                      type: typeof prop.config.type;
                      options: SelectOption[];
                    }
                  ).options.map((o) => (o.id !== option.id ? o : option)),
                } as PropertyConfig,
              })
            }
            onChange={(options) =>
              db.updateProperty(prop.id, {
                ...prop,
                config: {
                  ...(prop.config as {
                    type: "select";
                    options: SelectOption[];
                  }),
                  options,
                },
              })
            }
          />
        </PropertyEditPopover>
      )}
      {prop.config.type === "relation" && (
        <PropertyEditPopover>
          <RelationEditDisplay
            prop={prop}
            source={source ?? undefined}
            onChange={(config, name) =>
              db.updateProperty(prop.id, {
                ...prop,
                config,
                ...(name ? { name } : {}),
              })
            }
          />
        </PropertyEditPopover>
      )}
      {prop.config.type === "rollup" && (
        <PropertyEditPopover>
          <RollupEditDisplay
            prop={prop}
            properties={source?.properties ?? []}
            onChange={(config) =>
              db.updateProperty(prop.id, { ...prop, config })
            }
          />
        </PropertyEditPopover>
      )}
      {prop.config.type === "formula" && (
        <PropertyEditPopover>
          <FormulaEditor
            propertyId={prop.id}
            properties={source?.properties ?? []}
            onDone={onClose}
          />
        </PropertyEditPopover>
      )}
      {prop.config.type === "number" && (
        <PropertyEditPopover>
          <NumberEditDisplay
            prop={prop}
            onChange={(patch) => {
              if (prop.config.type !== "number") return;
              db.updateProperty(prop.id, {
                ...prop,
                config: { ...prop.config, ...patch },
              });
            }}
          />
        </PropertyEditPopover>
      )}
      {prop.config.type === "date" && (
        <PropertyEditPopover>
          <DateEditDisplay
            prop={prop}
            onChange={(config) =>
              db.updateProperty(prop.id, { ...prop, config })
            }
          />
        </PropertyEditPopover>
      )}
      {prop.config.type === "person" && (
        <PropertyEditPopover>
          <PersonEditDisplay
            prop={prop}
            onChange={(config) =>
              db.updateProperty(prop.id, { ...prop, config })
            }
          />
        </PropertyEditPopover>
      )}
      {prop.config.type === "url" && (
        <MenuRow
          Icon={MoveHorizontal}
          label="Show full url"
          checked={prop.config.showFullUrl}
          onToggle={(checked) =>
            void db.updateProperty(prop.id, {
              config: { type: "url", showFullUrl: checked },
            })
          }
          toggle
        />
      )}
      {prop.config.type === "unique_id" && (
        <UniqueIdPrefixEditor
          prefix={prop.config.prefix ?? ""}
          onChange={(prefix) =>
            void db.updateProperty(prop.id, {
              config: { type: "unique_id", ...(prefix ? { prefix } : {}) },
            })
          }
        />
      )}
      {prop.config.type === "title" && (
        <MenuRow
          Icon={Smile}
          label="Show page icon"
          checked={
            prop.config.showPageIcon === undefined
              ? true
              : prop.config.showPageIcon
          }
          onToggle={(checked) =>
            void db.updateProperty(prop.id, {
              config: { type: "title", showPageIcon: checked },
            })
          }
          toggle
        />
      )}
    </>
  );
}

// The ID property's prefix ("TASK" → TASK-12), saved on Enter or when the
// field loses focus, with an example of what the IDs will look like.
function UniqueIdPrefixEditor({
  prefix,
  onChange,
}: {
  prefix: string;
  onChange: (prefix: string) => void;
}) {
  const [draft, setDraft] = useState(prefix);
  const commit = () => {
    const next = draft.trim();
    if (next !== prefix) onChange(next);
  };

  return (
    <div className="db-unique-id-prefix">
      <label className="db-unique-id-prefix__label">
        ID prefix
        <Input
          value={draft}
          placeholder="Type a prefix"
          maxLength={12}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") setDraft(prefix);
          }}
        />
      </label>
      <span className="db-unique-id-prefix__example">
        {formatUniqueId(1, { type: "unique_id", prefix: draft })},{" "}
        {formatUniqueId(2, { type: "unique_id", prefix: draft })}…
      </span>
    </div>
  );
}
