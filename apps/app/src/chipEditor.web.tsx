import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { bulkPasteLength, insertBulkText } from "./bulkPaste";
import type { Chip, ChipEditorProps, Trigger } from "./chipEditorTypes";
import { iconPaths } from "./chips";
import { colors, fontSizes, fonts, radii } from "./theme";

// The message box's text field on the web: an editable element where a chosen skill or path is a chip inside the text, as in OpenBot.
// The message is read back as plain text, each chip as its token; the element's content is kept by hand, never by React.

const SVG = "http://www.w3.org/2000/svg";

/** The chip as it sits in the text: not editable, so the caret moves across it and Backspace removes it whole. */
const chipElementOf = (chip: Chip) => {
  const element = document.createElement("span");
  element.contentEditable = "false";
  element.dataset.token = chip.token;
  Object.assign(element.style, {
    alignItems: "center",
    background: colors.accentSoft,
    borderRadius: `${radii.sm}px`,
    color: colors.accentText,
    display: "inline-flex",
    gap: "4px",
    height: "18px",
    lineHeight: "18px",
    margin: "0 1px",
    padding: "0 5px",
    verticalAlign: "middle",
  });
  const icon = document.createElementNS(SVG, "svg");
  for (const [name, value] of Object.entries({
    fill: "none",
    height: "12",
    stroke: colors.accentText,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "stroke-width": "1.5",
    viewBox: "0 0 16 16",
    width: "12",
  })) {
    icon.setAttribute(name, value);
  }
  for (const d of iconPaths[chip.kind]) {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", d);
    icon.appendChild(path);
  }
  const label = document.createElement("span");
  label.textContent = chip.label;
  element.append(icon, label);
  return element;
};

/** The message as plain text: chips as their tokens, kept apart from the words around them by a space. */
const textOf = (root: Node, shouldKeepLastBreak = false): string => {
  let text = "";
  const add = (piece: string) => {
    text += piece;
  };
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child instanceof HTMLElement && child.dataset.token !== undefined) {
        add(`${text === "" || /\s$/.test(text) ? "" : " "}${child.dataset.token}`);
        const next = child.nextSibling?.textContent ?? "";
        if (next !== "" && !/^\s/.test(next)) add(" ");
      } else if (child instanceof HTMLBRElement) {
        // The last break of a block only holds the line open, as the browser leaves one after a deletion.
        if (child.nextSibling !== null || shouldKeepLastBreak) add("\n");
      } else if (child instanceof HTMLElement) {
        if (text !== "" && !text.endsWith("\n")) add("\n");
        walk(child);
      } else {
        add((child.textContent ?? "").replace(/ /g, " "));
      }
    }
  };
  walk(root);
  return text;
};

/** What is typed just before the caret that a list can complete: where it is, and the trigger it reads as. */
const triggerBeforeCaret = (root: HTMLElement) => {
  const selection = window.getSelection();
  const node = selection?.anchorNode;
  if (selection === null || !selection.isCollapsed || node?.nodeType !== Node.TEXT_NODE || !root.contains(node))
    return null;
  const before = (node.textContent ?? "").slice(0, selection.anchorOffset);
  const match = /(^|\s)([/@])(\S*)$/.exec(before);
  if (match === null) return null;
  const query = match[3] ?? "";
  const trigger: Trigger = { character: match[2] === "@" ? "@" : "/", query };
  return { end: selection.anchorOffset, node, start: before.length - query.length - 1, trigger };
};

/** The message field of the web app: text and chips in one editable line, reporting its trigger at the caret. */
export function ChipEditor({ onChange, onFiles, onKeyDown, onBang, placeholder, ref }: ChipEditorProps) {
  const root = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  // The trigger as last read, kept because choosing from the list takes the focus and the caret with it.
  const triggered = useRef<ReturnType<typeof triggerBeforeCaret>>(null);
  const handlers = useRef({ onChange, onFiles, onKeyDown });
  handlers.current = { onChange, onFiles, onKeyDown };

  const report = () => {
    const element = root.current;
    if (element === null) return;
    triggered.current = triggerBeforeCaret(element);
    const text = textOf(element);
    setIsEmpty(text === "" && element.querySelector("[data-token]") === null);
    handlers.current.onChange(text, triggered.current?.trigger ?? null);
  };

  useImperativeHandle(ref, () => ({
    clear: () => {
      if (root.current !== null) root.current.textContent = "";
      report();
    },
    insertChip: (chip) => {
      const element = root.current;
      const at = triggered.current;
      if (element === null || at === null || !element.contains(at.node)) return;
      const range = document.createRange();
      range.setStart(at.node, at.start);
      range.setEnd(at.node, at.end);
      range.deleteContents();
      const after = document.createTextNode(" ");
      range.insertNode(after);
      range.insertNode(chipElementOf(chip));
      element.focus();
      const caret = document.createRange();
      caret.setStart(after, 1);
      caret.collapse(true);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(caret);
      report();
    },
  }));

  // Moving the caret with the keys or the mouse changes the trigger without changing the text.
  useEffect(() => {
    const element = root.current;
    if (element === null) return;
    const follow = () => {
      if (document.activeElement === element) report();
    };
    document.addEventListener("selectionchange", follow);
    return () => document.removeEventListener("selectionchange", follow);
  });

  return (
    <div style={{ position: "relative" }}>
      {isEmpty && (
        <div
          style={{
            color: colors.placeholder,
            fontFamily: fonts.sans,
            fontSize: fontSizes.base,
            left: 8,
            lineHeight: "20px",
            pointerEvents: "none",
            position: "absolute",
            top: 6,
          }}
        >
          {placeholder}
        </div>
      )}
      {/* biome-ignore lint/a11y/useSemanticElements: a textarea cannot hold chips inside its text. */}
      <div
        aria-multiline="true"
        contentEditable
        onDragOver={(event) => {
          if (handlers.current.onFiles !== undefined && event.dataTransfer.types.includes("Files"))
            event.preventDefault();
        }}
        onDrop={(event) => {
          const files = Array.from(event.dataTransfer.files);
          if (handlers.current.onFiles === undefined || files.length === 0) return;
          event.preventDefault();
          handlers.current.onFiles(files);
        }}
        onInput={report}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (
            event.key === "!" &&
            !event.altKey &&
            !event.metaKey &&
            !event.ctrlKey &&
            onBang !== undefined &&
            root.current !== null
          ) {
            const selection = window.getSelection();
            if (
              selection !== null &&
              selection.anchorNode !== null &&
              selection.isCollapsed &&
              selection.rangeCount > 0 &&
              root.current.contains(selection.anchorNode)
            ) {
              const range = selection.getRangeAt(0).cloneRange();
              range.selectNodeContents(root.current);
              range.setEnd(selection.anchorNode, selection.anchorOffset);
              const before = textOf(range.cloneContents(), true);
              range.selectNodeContents(root.current);
              range.setStart(selection.anchorNode, selection.anchorOffset);
              const after = textOf(range.cloneContents(), true);
              if (before.split("\n").at(-1) === "" && after.split("\n")[0] === "") {
                event.preventDefault();
                onBang();
                return;
              }
            }
          }
          if (handlers.current.onKeyDown({ key: event.key, shiftKey: event.shiftKey })) {
            event.preventDefault();
          } else if (event.key === "Enter" && event.shiftKey) {
            event.preventDefault();
            document.execCommand("insertLineBreak");
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          const files = Array.from(event.clipboardData.files);
          // A copied image comes with no text; a copied table or web page comes with both, and stays text.
          if (text === "" && files.length > 0 && handlers.current.onFiles !== undefined) {
            handlers.current.onFiles(files);
          } else if (text.length > bulkPasteLength && root.current !== null) {
            insertBulkText(root.current, text);
            report();
          } else {
            document.execCommand("insertText", false, text);
          }
        }}
        ref={root}
        role="textbox"
        style={{
          boxSizing: "border-box",
          color: colors.text,
          fontFamily: fonts.sans,
          fontSize: fontSizes.base,
          lineHeight: "20px",
          maxHeight: 200,
          minHeight: 32,
          outline: "none",
          overflowWrap: "anywhere",
          overflowY: "auto",
          padding: "6px 8px",
          whiteSpace: "pre-wrap",
        }}
        suppressContentEditableWarning
        tabIndex={0}
      />
    </div>
  );
}
