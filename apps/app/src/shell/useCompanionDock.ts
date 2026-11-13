import { useEffect, useMemo, useReducer, useRef } from "react";
import type { CompanionPickerProps } from "../editors/companionPicker";
import { isSamePicker } from "../editors/pickerState";
import type { CompanionDock } from "../foundation/shellContext";
import type { RightPanel } from "../foundation/useRightPanel";
import { isCompanionOffered } from "./companionScope";

type Entry = { picker: CompanionPickerProps | null; rank: number; seq: number };

/** Registers mounted pickers, but never substitutes another owner for an open page-owned picker. */
export function useCompanionDock(panel: RightPanel, isIskiosFull: boolean, isIskiosOpen: boolean) {
  const pills = useRef(new Map<string, Entry>());
  const sequence = useRef(0);
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  const offered = [...pills.current].filter(
    ([, entry]) =>
      entry.picker !== null && isCompanionOffered(entry.picker.isIskios === true, isIskiosFull, isIskiosOpen),
  );
  offered.sort((current, next) => current[1].rank - next[1].rank || next[1].seq - current[1].seq);
  const content = panel.content;
  const selected = content?.tab === "companion" ? content : null;
  const pillId =
    selected === null
      ? (offered[0]?.[0] ?? null)
      : (offered.find(([id]) => id === selected.id)?.[0] ??
        // Expanding/restoring Iskios remounts its conversation and therefore its button.
        (selected.isIskios ? offered.find(([, entry]) => entry.picker?.isIskios === true)?.[0] : null) ??
        null);
  const companionPicker = pillId === null ? null : (pills.current.get(pillId)?.picker ?? null);
  const otherPillId =
    offered.find(([, entry]) => (entry.picker?.isIskios === true) !== (companionPicker?.isIskios === true))?.[0] ??
    null;
  const isCompanionShown = selected !== null && companionPicker !== null;
  const latest = useRef({ isCompanionShown, panel, pillId });
  latest.current = { isCompanionShown, panel, pillId };
  const dock = useMemo(() => {
    const choose = (id: string) => {
      const picker = pills.current.get(id)?.picker;
      if (picker == null) return;
      latest.current.panel.show({ id, isIskios: picker.isIskios === true, tab: "companion" });
    };
    return {
      choose,
      open: (id: string) => {
        if (latest.current.isCompanionShown && latest.current.pillId === id) latest.current.panel.show(null);
        else choose(id);
      },
      publish: (id: string, picker: CompanionPickerProps, rank: number) => {
        const entry = pills.current.get(id);
        if (entry === undefined) return;
        const before = entry.picker;
        entry.picker = picker;
        entry.rank = rank;
        if (
          before === null ||
          (latest.current.isCompanionShown && latest.current.pillId === id && !isSamePicker(before, picker))
        )
          redraw();
      },
      register: (id: string) => {
        sequence.current += 1;
        pills.current.set(id, { picker: null, rank: 0, seq: sequence.current });
      },
      unregister: (id: string) => {
        pills.current.delete(id);
        const selection = latest.current.panel.content;
        if (selection?.tab === "companion" && selection.id === id && !selection.isIskios)
          latest.current.panel.show(null);
        redraw();
      },
    } satisfies CompanionDock & { choose: (id: string) => void };
  }, []);
  useEffect(() => {
    if (!isIskiosOpen && selected?.isIskios) panel.show(null);
  }, [isIskiosOpen, selected, panel.show]);
  return { companionPicker, dock, hasCompanion: offered.length > 0, isCompanionShown, otherPillId, pillId, pills };
}
