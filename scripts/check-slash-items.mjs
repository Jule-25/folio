// Fails when a slash-menu item has translations but no entry in the menu:
// the sign that the entry was lost (unstaged, reverted) while its strings
// stayed. Run in CI with the other checks.
import { readFileSync } from "node:fs";

const en = JSON.parse(readFileSync("src/i18n/locales/en/common.json", "utf8"));
const src = readFileSync(
  "src/components/tiptap-ui/slash-menu/slash-commands.ts",
  "utf8",
);

const used = (key) =>
  src.includes(`slash.items.${key}.`) || // t("slash.items.key.title")
  src.includes(`"${key}"`) || // built from a list: ["…", "key", Icon]
  // numbered keys built from a variable: `slash.items.toggleHeading${level}`
  (/\d$/.test(key) &&
    src.includes(`slash.items.${key.replace(/\d+$/, "")}\${`));

const missing = Object.keys(en.slash.items).filter((key) => !used(key));

if (missing.length) {
  console.error(
    `✖ Slash items with translations but no menu entry: ${missing.join(", ")}`,
  );
  process.exit(1);
}
console.log("✔ Every slash item in the translations is in the menu.");
