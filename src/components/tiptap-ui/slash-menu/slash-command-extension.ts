/* eslint-disable @typescript-eslint/no-explicit-any */
import { Editor, Extension, posToDOMRect } from "@tiptap/core";
import Suggestion, {
  exitSuggestion,
  type SuggestionProps,
} from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { Plugin } from "@tiptap/pm/state";
import SlashList from "./slash-command-list";
import {
  computePosition,
  flip,
  offset,
  shift,
  type VirtualElement,
} from "@floating-ui/dom";

import "./slash-command-extension.scss";
import {
  getSlashCommands,
  type SlashCommand as SlashItem,
} from "./slash-commands";
import i18n from "src/i18n/config";
import { canInsertHere } from "src/components/tiptap-extension/containment-extension";
import {
  getRecentSlashIds,
  normalize,
  recordSlashUse,
  RECENT_PREFIX,
  scoreSlashItem,
} from "./slash-search";
import type { ID, Page } from "src/types";

const isColorItem = (cmd: SlashItem) => cmd.id.startsWith("color-");
const isColorStructural = (cmd: SlashItem) =>
  cmd.id === "colorsDivider" || cmd.id === "colors";

// No slash menu in code. (Table cells have one: Containment leaves out the
// blocks a cell refuses — see canInsertHere below.)
const FORBIDDEN_BLOCKS = ["codeBlock", "code"] as const;

const isInForbiddenBlock = (editor: Editor) =>
  FORBIDDEN_BLOCKS.some((block) => editor.isActive(block));

interface SlashCommandOptions {
  commands: SlashItem[];
  /** Keep only some items (e.g. the landing's provider-free editor). */
  filter?: (item: SlashItem) => boolean;
}

declare module "@tiptap/core" {
  interface Options {
    slashCommand: SlashCommandOptions;
  }
}

interface SlashCommandStorage {
  activePageId: ID;
  addPageAsync: ({
    title,
    parentId,
  }: {
    title: string;
    parentId: ID | null;
  }) => Promise<Page>;
  setActivePageId: (pageId: ID) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    slashCommand: {
      syncSlashCommandCtx: (param: SlashCommandStorage) => ReturnType;
    };
  }
}

declare module "@tiptap/core" {
  interface Storage {
    slashCommand: SlashCommandStorage;
  }
}

export const SlashCommand = Extension.create<
  SlashCommandOptions,
  SlashCommandStorage
>({
  name: "slashCommand",

  addOptions() {
    return {
      commands: getSlashCommands(i18n.t),
    };
  },

  addStorage() {
    return {
      activePageId: "",
      addPageAsync: async () => ({}) as Page,
      setActivePageId: () => {},
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const keep = this.options.filter ?? (() => true);
    let reactRenderer: ReactRenderer<any> | null = null;
    let selectedIndex = 0;
    let resizeObserver: ResizeObserver | null = null;
    // Where the open menu's "/" is, and where the user last closed one
    // (Escape, the Close button). A closed menu stays closed for that "/"
    // only: typing another "/" anywhere — or the + button adding one —
    // opens a new menu. (A plain "closed" flag used to swallow the next
    // menu, wherever it was.)
    let openFrom = -1;
    let closedFrom = -1;

    const closeMenu = () => {
      closedFrom = openFrom;
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (reactRenderer) {
        reactRenderer.element?.remove();
        reactRenderer.destroy();
        reactRenderer = null;
      }
      exitSuggestion(editor.view);
    };

    const updatePosition = (element: HTMLElement) => {
      const virtualElement: VirtualElement = {
        getBoundingClientRect: () =>
          posToDOMRect(
            editor.view,
            editor.state.selection.from,
            editor.state.selection.to,
          ),
      };
      computePosition(virtualElement, element, {
        placement: "bottom-start",
        strategy: "absolute",
        middleware: [offset(2), shift(), flip()],
      }).then(({ x, y, strategy }) => {
        element.style.width = "max-content";
        element.style.position = strategy;
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
      });
    };

    function createRenderer(props: SuggestionProps<SlashItem>) {
      selectedIndex = 0;
      openFrom = props.range.from;

      reactRenderer = new ReactRenderer(SlashList, {
        editor,
        props: {
          ...props,
          selectedIndex,
          onClickItem: (item: SlashItem) => {
            props.command(item);
            exitSuggestion(editor.view);
          },
          onClose: closeMenu,
        },
      });

      reactRenderer.element.style.position = "absolute";

      document.body.appendChild(reactRenderer.element);

      updatePosition(reactRenderer.element);

      resizeObserver = new ResizeObserver(() => {
        if (reactRenderer) updatePosition(reactRenderer.element);
      });
      resizeObserver.observe(reactRenderer.element);
    }

    function updateRenderer(props: SuggestionProps<SlashItem>) {
      if (!reactRenderer) {
        return;
      }
      openFrom = props.range.from;

      reactRenderer.updateProps({
        ...props,
        selectedIndex,
        onClickItem: (item: SlashItem) => {
          props.command(item);
          exitSuggestion(editor.view);
        },
        onClose: closeMenu,
      });
    }

    function destroyRenderer(props: SuggestionProps<SlashItem>) {
      const { editor, range } = props;
      const { state } = editor;

      const docSize = state.doc.content.size;

      if (range.from >= docSize) {
        reactRenderer?.destroy();
        reactRenderer = null;
        return;
      }

      const clampedTo = Math.min(range.to, docSize);

      try {
        const textAtRange = state.doc.textBetween(
          range.from,
          clampedTo,
          "\0",
          "\0",
        );
        const cursorPos = state.selection.from;
        const stillSlash = textAtRange.startsWith("/");
        const cursorInside =
          cursorPos >= range.from && cursorPos <= range.to + 1;

        if (stillSlash && cursorInside) return;
      } catch {
        // The range is stale (the document changed under it): fall through
        // and close the menu.
      }

      if (reactRenderer) {
        try {
          reactRenderer.destroy();
          resizeObserver?.disconnect();
          resizeObserver = null;
        } catch (error) {
          console.warn("Failed to destroy reactRenderer", error);
        }
        try {
          if (reactRenderer.element?.parentNode)
            reactRenderer.element.parentNode.removeChild(reactRenderer.element);
        } catch (error) {
          console.warn("Failed to remove element", error);
        }
        reactRenderer = null;
      }
    }

    const suggestion = Suggestion<SlashItem>({
      editor,
      char: "/",
      startOfLine: false,
      decorationClass: "slash-suggestion",
      allowSpaces: true,
      decorationContent: i18n.t("slash.filter"),
      allowedPrefixes: null,

      items: ({ query, editor }) => {
        if (isInForbiddenBlock(editor)) {
          return [];
        }

        // Rebuild fresh each query so a language switch re-localizes the menu.
        const commands = getSlashCommands(i18n.t).filter(
          (cmd) => keep(cmd) && (!cmd.node || canInsertHere(editor, cmd.node)),
        );
        const q = normalize(query || "");

        // No query: recently used first, then every block (colors hidden).
        if (!q) {
          const blocks = commands.filter(
            (cmd) => !isColorItem(cmd) && !isColorStructural(cmd),
          );
          const byId = new Map(blocks.map((cmd) => [cmd.id, cmd]));
          const recents = getRecentSlashIds()
            .map((id) => byId.get(id))
            .filter((cmd): cmd is SlashItem => cmd?.type === "command");
          if (recents.length === 0) return blocks;
          return [
            {
              id: "recent",
              type: "title",
              title: i18n.t("slash.sections.recent"),
            },
            // Copies with their own id, so the list keys and keyboard
            // navigation don't confuse them with the item further down.
            ...recents.map((cmd) => ({ ...cmd, id: RECENT_PREFIX + cmd.id })),
            { id: "recentDivider", type: "separator", title: "separator" },
            ...blocks,
          ];
        }

        // A query: a flat list, best matches first (English and French
        // titles and keywords). Colors come last, from two letters on.
        return commands
          .map((cmd, index) => ({
            cmd,
            index,
            score:
              cmd.type !== "command" || (isColorItem(cmd) && q.length < 2)
                ? 0
                : scoreSlashItem(cmd, q),
          }))
          .filter((r) => r.score > 0)
          .sort(
            (a, b) =>
              Number(isColorItem(a.cmd)) - Number(isColorItem(b.cmd)) ||
              b.score - a.score ||
              a.index - b.index,
          )
          .map((r) => r.cmd);
      },

      command: ({ editor: ed, range, props }) => {
        ed.chain().focus().deleteRange(range).run();
        if (props?.id) recordSlashUse(props.id);
        props?.run?.(ed);
        props?.runAsync?.(ed, this.storage);
      },
      render: () => ({
        onStart: (props) => {
          // Don't show the decoration or renderer inside forbidden blocks
          if (isInForbiddenBlock(props.editor)) {
            exitSuggestion(editor.view);
            return;
          }

          // The menu the user just closed, for the same "/": keep it closed.
          if (props.range.from === closedFrom) {
            exitSuggestion(editor.view);
            return;
          }
          closedFrom = -1;
          createRenderer(props);
          requestAnimationFrame(() => {
            const el = editor.view.dom.querySelector(".slash-suggestion");
            el?.classList.add("is-empty");
          });
        },
        onUpdate: (props) => {
          if (props.items.length === 0) return;
          if (!reactRenderer) return;

          updateRenderer(props);

          requestAnimationFrame(() => {
            const el = editor.view.dom.querySelector(".slash-suggestion");
            if (props.query.length > 0) {
              el?.classList.remove("is-empty");
            } else {
              el?.classList.add("is-empty");
            }
          });
        },
        onKeyDown({ event }) {
          if (event.key === "Escape") {
            closeMenu();
            return true;
          }

          return false;
        },
        onExit: destroyRenderer,
      }),
    });

    // Forget a closed menu once its "/" is gone (deleted or replaced), so a
    // "/" typed again in the same spot opens the menu.
    const forgetClosed = new Plugin({
      view: () => ({
        update(view) {
          if (closedFrom < 0) return;
          const { doc } = view.state;
          if (
            closedFrom >= doc.content.size ||
            doc.textBetween(closedFrom, closedFrom + 1, "\0", "\0") !== "/"
          ) {
            closedFrom = -1;
          }
        },
      }),
    });

    return [suggestion as unknown as Plugin, forgetClosed];
  },
  addCommands() {
    return {
      syncSlashCommandCtx:
        ({ activePageId, setActivePageId, addPageAsync }) =>
        () => {
          this.storage.activePageId = activePageId;
          this.storage.setActivePageId = setActivePageId;
          this.storage.addPageAsync = addPageAsync;
          return true;
        },
    };
  },
});
