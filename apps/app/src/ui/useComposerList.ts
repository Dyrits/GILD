import type { Skill } from "@iskios/contracts";
import { useState } from "react";
import type { ServiceClient } from "../foundation/client";
import { useMentionables } from "../foundation/useMentionables";
import { useWorkspaceEntries } from "../foundation/useWorkspaceEntries";
import type { Chip, Trigger } from "./chipEditorTypes";
import {
  composerListOf,
  initialListState,
  type ListState,
  listAfterChoosing,
  listAfterKey,
  listAfterTyping,
} from "./composerList";
import type { MenuRow } from "./mentionMenu";

/**
 * The list above a message box: what to show, the line the owner is on, and what typing and keys do to it. The box
 * draws `rows`, tells the list what was typed and which key was pressed, and puts the `chip` a choice returns in its text.
 */
export function useComposerList(
  skills: ReadonlyArray<Skill>,
  mentions: { readonly client: ServiceClient; readonly workspacePath: string | null } | undefined,
) {
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [state, setState] = useState<ListState>(initialListState);
  const mentioned = mentions === undefined || trigger?.character !== "@" ? null : trigger.query;
  const entries = useWorkspaceEntries(mentions?.client, mentions?.workspacePath ?? null, mentioned);
  const mentionables = useMentionables(mentions?.client, mentioned !== null);
  const list = composerListOf(
    {
      entries,
      mentionables: mentionables ?? [],
      mentions: mentions === undefined ? null : { hasFolder: (mentions.workspacePath ?? null) !== null },
      skills,
      trigger,
    },
    state,
  );
  return {
    /** Chooses a line the owner pressed: a category opens, and an item returns the chip to put in the message. */
    choose: (row: MenuRow): Chip | null => {
      const after = listAfterChoosing(state, row);
      setState(after.state);
      return after.chip;
    },
    highlighted: list.highlighted,
    /** Hears a key before the field does; `handled` says the field must not see it. */
    onKey: (key: { readonly key: string; readonly shiftKey: boolean }): { handled: boolean; chip: Chip | null } => {
      const after = listAfterKey(state, list, key);
      setState(after.state);
      return { chip: after.chip, handled: after.handled };
    },
    /** Hears a new text from the field with the trigger at its caret. */
    onTyped: (typed: Trigger | null) => {
      setTrigger(typed);
      setState((previous) => listAfterTyping(previous, typed));
    },
    rows: list.rows,
  };
}
