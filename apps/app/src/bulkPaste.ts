/**
 * Above this many characters a paste goes in as one text node instead of through `execCommand("insertText")`, whose cost grows with the square of the
 * text: 4,000 lines took three seconds and 17,000 froze the window for over a minute. The price is that the browser's undo does not take the paste back in one step.
 */
export const bulkPasteLength = 20_000;

/** Puts text where the caret is inside the field, replacing a selection, as one text node, and leaves the caret after it. */
export const insertBulkText = (root: HTMLElement, text: string) => {
  const selection = window.getSelection();
  const selected = selection !== null && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  const range =
    selected !== null && root.contains(selected.commonAncestorContainer) ? selected : document.createRange();
  if (range !== selected) {
    range.selectNodeContents(root);
    range.collapse(false);
  }
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  const caret = document.createRange();
  caret.setStartAfter(node);
  caret.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(caret);
};
