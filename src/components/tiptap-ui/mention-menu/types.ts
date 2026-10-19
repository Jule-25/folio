import type {
  SuggestionKeyDownProps,
  SuggestionOptions,
} from "@tiptap/suggestion";
import type { Page } from "src/types";

export type MentionItem = {
  id: string;
  label: string;
  avatar?: string;
  role?: string;
  title?: "Date" | "People" | "Pages" | "Rows";
  date?: string;
  type?: "user" | "page" | "date" | "row" | "divider";
  /** Row items: the row's ID ("TASK-12"), when its database has one. */
  idText?: string;
  cover?: Page["cover"];
  /** Date items: the ISO date the chip starts with, and how it reads. */
  iso?: string;
  hint?: string;
  remind?: string;
  includeTime?: boolean;
};

export type MentionSuggestion = Omit<SuggestionOptions<MentionItem>, "editor">;

export type MentionListRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

export type MentionListProps = {
  items: MentionItem[];
  command: (item: MentionItem) => void;
};

/** A database row the @ menu can mention (set by the menu from the loaded
 *  pages and databases, read by the suggestion's items()). */
export type RowMentionEntry = {
  id: string;
  title: string;
  idText: string;
  cover: Page["cover"];
  /** The database it's in, so two rows with the same title can be told
   *  apart. */
  dbName: string;
};
