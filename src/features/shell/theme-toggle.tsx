import { useEffect, useState } from "react";
import { Button } from "src/components/tiptap-ui-primitive/button";
import { MoonStarIcon } from "src/components/tiptap-icons/moon-star-icon";
import { SunIcon } from "src/components/tiptap-icons/sun-icon";
import {
  useCurrentWorkspace,
  useManageWorkspace,
} from "src/hooks/use-workspaces";
import { useCurrentPerson } from "src/hooks/use-session";
import { useAppearance } from "./appearance/appearance";

const isDark = () => document.documentElement.classList.contains("dark");

// Light / dark switch (••• menu on smaller screens). The theme belongs to the
// workspace (workspace.settings.defaultTheme, applied by useApplyTheme), so
// owners change it there. Other members just switch this window — it used to
// re-apply an old per-person setting from browser storage the moment the
// menu opened, flipping the theme.
export function ThemeToggle() {
  const { workspace } = useCurrentWorkspace();
  const { person } = useCurrentPerson();
  const { setSettingAsync } = useManageWorkspace();
  const [dark, setDark] = useState(isDark);
  const [appearance] = useAppearance();

  // Follow the workspace theme when it changes (or the OS, for "system").
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDark()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    if (workspace && person?.role === "owner") {
      void setSettingAsync(
        workspace.id,
        "defaultTheme",
        next ? "dark" : "light",
      );
    }
  };

  if (appearance !== "default") return null;

  return (
    <Button
      onClick={toggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      variant="ghost"
      size="large"
      style={{
        width: "1.25rem",
        height: "1.25rem",
        minWidth: "1.25rem",
        minHeight: "1.25rem",
      }}
    >
      {dark ? (
        <MoonStarIcon
          className="tiptap-button-icon"
          style={{ color: "var(--tt-text-primary)" }}
        />
      ) : (
        <SunIcon
          className="tiptap-button-icon"
          style={{ color: "var(--tt-text-primary)" }}
        />
      )}
    </Button>
  );
}
