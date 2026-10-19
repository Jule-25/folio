import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "src/components/tiptap-ui-primitive/card";
import { Input } from "src/components/tiptap-ui-primitive/input";
import { useWorkspacePeople } from "../../hooks/use-workspace-people";
import { useCurrentPerson } from "src/hooks/use-session";
import "./ask-to-look-flyout.scss";

/**
 * "Ask someone to look" (a row's menu): pick a workspace member; they get an
 * Inbox notification that opens the row in its database.
 */
export function AskToLookFlyout({
  onPick,
}: {
  onPick: (personId: string) => void;
}) {
  const { t } = useTranslation();
  const people = useWorkspacePeople();
  const { person: me } = useCurrentPerson();
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => p.id !== me?.id)
      .filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [people, me?.id, query]);

  return (
    <Card className="db-ask-to-look">
      <Input
        autoFocus
        value={query}
        placeholder={t("database.askToLook.search")}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation(); // typing mustn't drive the menu's shortcuts
          if (e.key === "Enter" && shown[0]) onPick(shown[0].id);
        }}
      />
      <div className="db-ask-to-look__list" role="listbox">
        {shown.length === 0 ? (
          <span className="db-ask-to-look__empty">
            {t("database.askToLook.nobody")}
          </span>
        ) : (
          shown.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={false}
              className="db-ask-to-look__person"
              onClick={() => onPick(p.id)}
            >
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt="" />
              ) : (
                <span className="db-ask-to-look__initial" aria-hidden="true">
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="db-ask-to-look__name">{p.name}</span>
            </button>
          ))
        )}
      </div>
    </Card>
  );
}
