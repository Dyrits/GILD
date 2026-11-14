import { type RefObject, useEffect, useRef, useState } from "react";
import type { ChipEditorHandle } from "./chipEditorTypes";
import { isSentText, listenForSentText, unsentTextOf } from "./unsentText";

/**
 * A message box's unsent text (CHG-0269): what it left when it last closed, read once as it opens, and the text now in
 * it, which differs from the box's state in a step that started before the last keystroke. A box reopened while its
 * earlier send was pending empties once that send succeeds, unless the owner typed on since. A box without a name keeps
 * no text.
 */
export const useDraftText = (draftKey: string | undefined, editor: RefObject<ChipEditorHandle | null>) => {
  const [left] = useState(() => (draftKey === undefined ? "" : unsentTextOf(draftKey)));
  const latestText = useRef(left);
  useEffect(() => {
    if (draftKey === undefined) return;
    return listenForSentText(draftKey, (sent) => {
      if (isSentText(latestText.current, sent)) editor.current?.clear();
    });
  }, [draftKey, editor]);
  return { latestText, left };
};
