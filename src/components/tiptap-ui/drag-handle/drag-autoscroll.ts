import type { Editor } from "@tiptap/core";

// While a block is dragged from the handle, scroll the page when the pointer
// is near the top or bottom of the editor's scroll area — faster the closer
// it gets. The browser only does this on its own for the main scrolling
// element, and the editor scrolls inside its own container.

const EDGE = 80; // px from the edge where scrolling starts
const MAX_SPEED = 22; // px per frame at the very edge

function scrollParent(el: HTMLElement): HTMLElement {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    )
      return node;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

export function startDragAutoscroll(editor: Editor): () => void {
  const scroller = scrollParent(editor.view.dom);
  let pointerY: number | null = null;
  let frame = 0;

  const onDragOver = (event: DragEvent) => {
    pointerY = event.clientY;
  };

  const tick = () => {
    if (pointerY !== null) {
      const isPage = scroller === document.scrollingElement;
      const rect = isPage
        ? { top: 0, bottom: window.innerHeight }
        : scroller.getBoundingClientRect();
      const fromTop = pointerY - rect.top;
      const fromBottom = rect.bottom - pointerY;
      let speed = 0;
      if (fromTop < EDGE)
        speed = -MAX_SPEED * (1 - Math.max(fromTop, 0) / EDGE);
      else if (fromBottom < EDGE)
        speed = MAX_SPEED * (1 - Math.max(fromBottom, 0) / EDGE);
      if (speed) scroller.scrollTop += speed;
    }
    frame = requestAnimationFrame(tick);
  };

  document.addEventListener("dragover", onDragOver);
  frame = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener("dragover", onDragOver);
  };
}
