import { StarterKit } from "@tiptap/starter-kit";
import {
  BulletList,
  ListItem,
  OrderedList,
  TaskItem,
  TaskList,
} from "@tiptap/extension-list";
import { TextAlign } from "@tiptap/extension-text-align";
import { Typography } from "@tiptap/extension-typography";
import { Highlight } from "@tiptap/extension-highlight";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Placeholder, Selection } from "@tiptap/extensions";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { TableKit } from "@tiptap/extension-table";
import UniqueID from "@tiptap/extension-unique-id";
import type { AnyExtension } from "@tiptap/core";
import { SlashCommand } from "src/components/tiptap-ui/slash-menu";
import { EmojiExtension } from "src/components/tiptap-ui/emoji-menu";
import DragHandleExtension from "src/components/tiptap-ui/drag-handle/drag-handle-extension";
import {
  NodeAlignment,
  NodeBackground,
  NodeClearContents,
  NodeColor,
  NodeFit,
  TopLevelClassExtension,
  Containment,
  MarkdownPaste,
  BlockSelection,
} from "src/components/tiptap-extension";
import { Image } from "src/components/tiptap-node/image-node/image";
import { ImageUploadNode } from "src/components/tiptap-node/image-upload-node/image-upload-node-extension";
import { HorizontalRule } from "src/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension";
import { ParagraphNode } from "src/components/tiptap-node/paragraph-node";
import { TableContextExtension } from "src/components/tiptap-node/table-node";
import { TableWrapperNode } from "src/components/tiptap-node/table-node/extensions/table-context";
import { Column, ColumnBlock } from "src/components/tiptap-node/column-node";
import { TitleNode } from "src/components/tiptap-node/title-node";
import { CodeBlockNode } from "src/components/tiptap-node/code-block-node";
import { CalloutExtension } from "src/components/tiptap-node/callout-node";
import { AudioExtension } from "src/components/tiptap-node/audio-node";
import {
  VideoExtension,
  YoutubeExtension,
} from "src/components/tiptap-node/video-node";
import { BookmarkNode } from "src/components/tiptap-node/bookmark-node/bookmark-node-extension";
import { MathInlineNode } from "src/components/tiptap-node/math-inline-node";
import { MathBlockNode } from "src/components/tiptap-node/math-block-node";
import { FileNode } from "src/components/tiptap-node/file-node";
import { Tab, Tabs } from "src/components/tiptap-node/tabs-node";
import {
  CodeGroup,
  CodeGroupItem,
} from "src/components/tiptap-node/code-group-node";
import { ButtonNode } from "src/components/tiptap-node/button-node";
import { Container } from "src/components/tiptap-node/container-node";
import {
  Appendix,
  AppendixContent,
  AppendixSummary,
} from "src/components/tiptap-node/appendix-node";
import { MAX_FILE_SIZE } from "src/lib/tiptap-utils";
import i18n from "src/i18n/config";

// The page editor's extensions (src/features/editor/hooks/use-editor-extensions.ts)
// for signed-out visitors. Left out, because they need an account: comments,
// databases, page links and breadcrumbs (they need pages), mentions (they
// need members), the table of contents (it reports to the page layout) and
// version diffs. Uploads stay in the browser (an object URL); nothing is sent.

/** Slash items that need something the landing doesn't have. */
const SLASH_LEFT_OUT = new Set([
  "breadcrumb",
  "toc",
  "mention",
  "page-1",
  "database-view",
]);

/** "Upload" without a server: the file stays in this tab. */
async function localUpload(
  file: File,
  onProgress?: (event: { progress: number }) => void,
): Promise<string> {
  onProgress?.({ progress: 100 });
  return URL.createObjectURL(file);
}

const openExternal = (href: string) => {
  if (/^https?:\/\//i.test(href)) {
    window.open(href, "_blank", "noopener,noreferrer");
  }
};

/**
 * Built per editor (extensions hold per-editor state). `collaborative`
 * turns off the built-in undo history, which Yjs replaces; the caller adds
 * the Collaboration extensions.
 */
export function makeLandingExtensions({
  collaborative = false,
}: { collaborative?: boolean } = {}): AnyExtension[] {
  return [
    // --- Core ---
    StarterKit.configure({
      paragraph: false,
      horizontalRule: false,
      listItem: false,
      bulletList: false,
      orderedList: false,
      link: { openOnClick: false, enableClickSelection: true },
      codeBlock: false,
      ...(collaborative ? { undoRedo: false } : {}),
    }),
    CodeBlockNode,
    Typography,
    Selection,
    TextStyle,
    Color,
    Superscript,
    Subscript,

    // --- Text formatting ---
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({
      includeChildren: true,
      placeholder: ({ node }) => {
        if (node.type.name === "title") return i18n.t("page.untitled", "Untitled");
        if (node.type.name === "appendixSummary") return "Untitled";
        if (["tableCell", "tableHeader", "table"].includes(node.type.name))
          return "";
        return i18n.t("landing.typeSlash", "Type / for blocks");
      },
      showOnlyCurrent: true,
      showOnlyWhenEditable: true,
    }),

    // --- Lists ---
    BulletList,
    OrderedList,
    ListItem,
    TaskList,
    TaskItem.configure({ nested: true }),

    // --- Nodes ---
    ParagraphNode,
    TitleNode,
    HorizontalRule,
    Image.configure({
      resize: {
        enabled: true,
        directions: ["left", "right"],
        alwaysPreserveAspectRatio: true,
      },
    }),
    ImageUploadNode.configure({
      accept: "image/*",
      maxSize: MAX_FILE_SIZE,
      limit: 3,
      upload: localUpload,
      onError: (error) => console.error("Upload failed:", error),
    }),
    Column,
    ColumnBlock,

    // --- Table ---
    TableKit.configure({ table: false }),
    TableContextExtension.configure({ resizable: true, handleWidth: 1 }),
    TableWrapperNode,

    // --- Node attributes ---
    MarkdownPaste,
    BlockSelection,
    NodeBackground.configure({ useStyle: false }),
    NodeAlignment.configure({ useStyle: false }),
    NodeColor.configure({ useStyle: false }),
    NodeFit.configure({ useStyle: false }),
    NodeClearContents,

    // --- Menus ---
    SlashCommand.configure({
      filter: (item) => !SLASH_LEFT_OUT.has(item.id),
    }),
    EmojiExtension,
    DragHandleExtension,

    // --- More nodes ---
    CalloutExtension,
    UniqueID.configure({
      types: [
        "paragraph",
        "heading",
        "blockquote",
        "figure",
        "codeBlock",
        "table",
        "callout",
      ],
      attributeName: "id",
    }),
    FileNode.configure({
      upload: localUpload,
      accept: "*/*",
      maxSize: 10 * 1024 * 1024,
      limit: 10,
    }),
    AudioExtension.configure({ upload: localUpload, maxSize: MAX_FILE_SIZE }),
    YoutubeExtension,
    VideoExtension.configure({ upload: localUpload, maxSize: MAX_FILE_SIZE }),
    BookmarkNode,
    MathInlineNode,
    MathBlockNode,
    Tabs,
    Tab,
    CodeGroup,
    CodeGroupItem,
    ButtonNode,
    Container.configure({ onNavigate: openExternal }),
    Appendix,
    AppendixSummary,
    AppendixContent,
    TopLevelClassExtension,
    Containment,
  ];
}