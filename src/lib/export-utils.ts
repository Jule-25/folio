import type { Editor } from "@tiptap/react";
import type { Paragraph, TextRun, Table } from "docx";
import { revealAllRecords } from "src/features/database/utils/record-visibility";

// ---------------------------------------------------------------------------
// PDF export — the browser's print dialog ("Save as PDF").
// The page's content is copied into a hidden frame with the app's styles,
// minus the editing UI (handles, toolbars, resizers, placeholders), and
// that frame is printed. No pop-up window, so no pop-up blocker.
// ---------------------------------------------------------------------------

/** Editing UI that has no place on paper. */
const PRINT_HIDDEN = [
  ".drag-handle",
  ".column-drag-handle",
  ".column-resizer",
  ".column-drop-zone",
  ".code-block-toolbar",
  ".folio-button__settings",
  ".folio-button__resize",
  ".folio-container__resize",
  ".tiptap-toolbar",
  ".thread-sidebar",
  ".toc-sidebar",
  ".ProseMirror-gapcursor",
  "[data-print-hidden]",
].join(",\n    ");

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );

export function exportToPdf(editor: Editor, title = "document"): void {
  // Database rows far from the screen are empty placeholders until scrolled
  // to (record-visibility.ts). Render them all, then copy the page two
  // frames later, once React has filled them in.
  revealAllRecords();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => printEditorCopy(editor, title)),
  );
}

function printEditorCopy(editor: Editor, title: string): void {
  const editorEl =
    (editor.view?.dom as HTMLElement | undefined) ??
    document.querySelector<HTMLElement>(".tiptap.ProseMirror");
  if (!editorEl) {
    console.error("exportToPdf: could not find editor element");
    return;
  }

  // The app's styles, so the copy looks like the page.
  const styles = Array.from(
    document.querySelectorAll<HTMLElement>('link[rel="stylesheet"], style'),
  )
    .map((el) => el.outerHTML)
    .join("\n");

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    visibility: "hidden",
  });
  document.body.appendChild(frame);

  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  if (!win || !doc) {
    frame.remove();
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  ${styles}
  <style>
    @page { margin: 18mm 16mm; }
    html, body { background: #fff !important; }
    body {
      margin: 0;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-page { max-width: 760px; margin: 0 auto; }
    ${PRINT_HIDDEN} { display: none !important; }
    /* Empty-line placeholders ("Type / for blocks") */
    .is-empty::before, [data-placeholder]::before { content: none !important; }
    img, pre, table, blockquote, .folio-container { break-inside: avoid; }
    h1, h2, h3, h4 { break-after: avoid; }
  </style>
</head>
<body>
  <div class="print-page">
    <div class="tiptap ProseMirror">${editorEl.innerHTML}</div>
  </div>
</body>
</html>`);
  doc.close();

  const cleanup = () => setTimeout(() => frame.remove(), 500);

  const print = async () => {
    // Wait for fonts and images, or the PDF has holes.
    try {
      await doc.fonts?.ready;
    } catch {
      // ignore
    }
    await Promise.all(
      Array.from(doc.images).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = img.onerror = () => resolve();
              setTimeout(resolve, 4000);
            }),
      ),
    );
    win.addEventListener("afterprint", cleanup, { once: true });
    win.focus();
    win.print();
    // Some browsers never fire afterprint for a frame.
    setTimeout(() => frame.isConnected && frame.remove(), 60_000);
  };

  if (doc.readyState === "complete") void print();
  else win.addEventListener("load", () => void print(), { once: true });
}

// ---------------------------------------------------------------------------
// Markdown export — the page as a .md file.
// ---------------------------------------------------------------------------

/** "My page: notes" → "My page notes" (safe on Windows too). */
export function safeFileName(name: string, fallback = "document"): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

export function downloadFile(content: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportToMarkdown(
  editor: Editor,
  title = "document",
): Promise<void> {
  // Loaded on demand: only people who export pay for the serializer.
  const { contentToMarkdown } = await import(
    "src/lib/markdown/content-to-markdown"
  );
  const markdown = contentToMarkdown(editor.getJSON());
  downloadFile(markdown, `${safeFileName(title)}.md`, "text/markdown;charset=utf-8");
}

// ---------------------------------------------------------------------------
// Word export — converts Tiptap JSON to a .docx file via the `docx` npm lib.
// Install once: npm install docx  (or yarn add docx)
// ---------------------------------------------------------------------------

type JSONContent = {
  type?: string;
  text?: string;
  content?: JSONContent[];
  marks?: { type: string; attrs?: Record<string, string> }[];
  attrs?: Record<string, unknown>;
};

export async function exportToWord(
  editor: Editor,
  filename = "document",
): Promise<void> {
  // Dynamically import `docx` so it is only bundled when needed.
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    LevelFormat,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    ShadingType,
    PageNumber,
    Header,
    Footer,
  } = await import("docx");

  const json = editor.getJSON();

  // ── numbering config for bullet and ordered lists ──────────────────────
  const numberingConfig = [
    {
      reference: "bullets",
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: "•",
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: { indent: { left: 720, hanging: 360 } },
          },
        },
        {
          level: 1,
          format: LevelFormat.BULLET,
          text: "◦",
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: { indent: { left: 1440, hanging: 360 } },
          },
        },
      ],
    },
    {
      reference: "ordered",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: { indent: { left: 720, hanging: 360 } },
          },
        },
      ],
    },
  ];

  // ── helpers ─────────────────────────────────────────────────────────────

  /**
   * Resolves a color value to a 6-digit hex string for docx.
   * Handles: "#RRGGBB", "#RGB", "rgb(...)", CSS variables ("var(--...)").
   * Falls back to "000000" (black) if the value cannot be resolved.
   */
  function resolveColor(raw: string): string {
    if (!raw) return "000000";
    const value = raw.trim();

    // CSS variable — read the computed value from the document root
    if (value.startsWith("var(")) {
      const varName = value.match(/var\(\s*(--[\w-]+)/)?.[1];
      if (varName) {
        const computed = getComputedStyle(document.documentElement)
          .getPropertyValue(varName)
          .trim();
        if (computed) return resolveColor(computed);
      }
      return "000000";
    }

    // #RRGGBB or #RGB
    if (value.startsWith("#")) {
      const hex = value.slice(1);
      if (hex.length === 6) return hex.toUpperCase();
      if (hex.length === 3) {
        return hex
          .split("")
          .map((c) => c + c)
          .join("")
          .toUpperCase();
      }
      return "000000";
    }

    // rgb(r, g, b) or rgba(r, g, b, a)
    const rgb = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgb) {
      return [rgb[1], rgb[2], rgb[3]]
        .map((n) => parseInt(n).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    }

    return "000000";
  }

  function marksToRunProps(
    marks: JSONContent["marks"] = [],
  ): Record<string, unknown> {
    const props: Record<string, unknown> = {};
    for (const mark of marks) {
      if (mark.type === "bold") props["bold"] = true;
      if (mark.type === "italic") props["italics"] = true;
      if (mark.type === "underline") props["underline"] = {};
      if (mark.type === "strike") props["strike"] = true;
      if (mark.type === "code") {
        props["font"] = "Courier New";
        props["size"] = 20;
        props["shading"] = { type: ShadingType.CLEAR, fill: "F0F0F0" };
      }
      if (mark.type === "highlight") props["highlight"] = "yellow";
      if (mark.type === "superscript") props["superScript"] = true;
      if (mark.type === "subscript") props["subScript"] = true;
      if (mark.type === "textStyle" && mark.attrs?.color) {
        props["color"] = resolveColor(mark.attrs.color as string);
      }
    }
    return props;
  }

  function inlineNodes(nodes: JSONContent[] = []): TextRun[] {
    const runs: TextRun[] = [];
    for (const node of nodes) {
      if (node.type === "text") {
        runs.push(
          new TextRun({
            text: node.text ?? "",
            ...marksToRunProps(node.marks),
          }),
        );
      } else if (node.type === "hardBreak") {
        runs.push(new TextRun({ break: 1 }));
      }
    }
    return runs;
  }

  function headingLevel(level: number) {
    const map: Record<
      number,
      (typeof HeadingLevel)[keyof typeof HeadingLevel]
    > = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
      5: HeadingLevel.HEADING_5,
      6: HeadingLevel.HEADING_6,
    };
    return map[level] ?? HeadingLevel.HEADING_1;
  }

  function blockquoteParagraphs(node: JSONContent): Paragraph[] {
    return (node.content ?? []).flatMap((child) =>
      convertNode(child, { isBlockquote: true }),
    );
  }

  function listItems(
    items: JSONContent[],
    ref: string,
    level = 0,
  ): Paragraph[] {
    const out: Paragraph[] = [];
    for (const item of items) {
      // bullet/ordered list item — first paragraph gets the bullet, rest are indented
      let first = true;
      for (const child of item.content ?? []) {
        if (child.type === "paragraph") {
          out.push(
            new Paragraph({
              children: inlineNodes(child.content),
              ...(first
                ? { numbering: { reference: ref, level } }
                : {
                    indent: { left: 720 + level * 720 },
                  }),
            }),
          );
          first = false;
        } else if (child.type === "bulletList") {
          out.push(...listItems(child.content ?? [], "bullets", level + 1));
        } else if (child.type === "orderedList") {
          out.push(...listItems(child.content ?? [], "ordered", level + 1));
        }
      }
    }
    return out;
  }

  function tableNode(node: JSONContent): Table {
    const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
    const borders = {
      top: border,
      bottom: border,
      left: border,
      right: border,
    };

    const rows = (node.content ?? []).flatMap((rowGroup) =>
      (rowGroup.content ?? []).map(
        (row) =>
          new TableRow({
            children: (row.content ?? []).map(
              (cell) =>
                new TableCell({
                  borders,
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  shading:
                    row.type === "tableHeader"
                      ? { type: ShadingType.CLEAR, fill: "E8EDF2" }
                      : undefined,
                  children: (cell.content ?? []).flatMap((c) => convertNode(c)),
                }),
            ),
          }),
      ),
    );

    return new Table({
      width: { size: 9360, type: WidthType.DXA },
      rows,
    });
  }

  function convertNode(
    node: JSONContent,
    ctx: { isBlockquote?: boolean } = {},
  ): Paragraph[] {
    const { isBlockquote = false } = ctx;

    switch (node.type) {
      case "paragraph":
        return [
          new Paragraph({
            children: inlineNodes(node.content),
            indent: isBlockquote ? { left: 720 } : undefined,
            border: isBlockquote
              ? {
                  left: {
                    style: BorderStyle.SINGLE,
                    size: 12,
                    color: "AAAAAA",
                    space: 10,
                  },
                }
              : undefined,
          }),
        ];

      case "heading":
        return [
          new Paragraph({
            heading: headingLevel((node.attrs?.level as number) ?? 1),
            children: inlineNodes(node.content),
          }),
        ];

      case "bulletList":
        return listItems(node.content ?? [], "bullets");

      case "orderedList":
        return listItems(node.content ?? [], "ordered");

      case "taskList":
        // Render task items as bullet paragraphs with ☐/☑ prefix
        return (node.content ?? []).flatMap((item) => {
          const checked = item.attrs?.checked as boolean | undefined;
          const prefix = checked ? "☑ " : "☐ ";
          return (item.content ?? []).flatMap((child) => {
            if (child.type === "paragraph") {
              return [
                new Paragraph({
                  children: [
                    new TextRun({ text: prefix }),
                    ...inlineNodes(child.content),
                  ],
                  indent: { left: 360 },
                }),
              ];
            }
            return [];
          });
        });

      case "blockquote":
        return blockquoteParagraphs(node);

      case "codeBlock":
        return [
          new Paragraph({
            children: [
              new TextRun({
                text: (node.content ?? []).map((n) => n.text ?? "").join("\n"),
                font: "Courier New",
                size: 18,
              }),
            ],
            shading: { type: ShadingType.CLEAR, fill: "F5F5F5" },
            border: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
            },
            indent: { left: 360, right: 360 },
          }),
        ];

      case "horizontalRule":
        return [
          new Paragraph({
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: "CCCCCC",
                space: 1,
              },
            },
            children: [],
          }),
        ];

      case "table":
        // Tables are block-level but docx uses a different class; handled below
        return [];

      default:
        // Fallback: try to extract inline text
        if (node.content?.length) {
          return node.content.flatMap((c) => convertNode(c));
        }
        return [];
    }
  }

  // ── walk the top-level doc ───────────────────────────────────────────────

  type DocChild = Paragraph | Table;

  const children: DocChild[] = [];

  for (const node of json.content ?? []) {
    if (node.type === "table") {
      children.push(tableNode(node));
    } else {
      children.push(...convertNode(node));
    }
  }

  // ── assemble document ────────────────────────────────────────────────────

  const doc = new Document({
    numbering: { config: numberingConfig },
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 24 } }, // 12pt
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 36, bold: true, font: "Calibri", color: "1F3864" },
          paragraph: {
            spacing: { before: 300, after: 120 },
            outlineLevel: 0,
          },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 28, bold: true, font: "Calibri", color: "2E4A6B" },
          paragraph: {
            spacing: { before: 240, after: 80 },
            outlineLevel: 1,
          },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 24, bold: true, font: "Calibri", color: "365F91" },
          paragraph: {
            spacing: { before: 180, after: 60 },
            outlineLevel: 2,
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // US Letter
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun({ text: filename, color: "888888" })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    color: "888888",
                  }),
                  new TextRun({ text: " / ", color: "888888" }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    color: "888888",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  // ── download ─────────────────────────────────────────────────────────────

  const buffer = await Packer.toBlob(doc);
  const url = URL.createObjectURL(buffer);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFileName(filename)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
