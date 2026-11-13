import { useCallback, useState } from "react";
import { type PanelContent, type PanelState, panelAt } from "./panelState";

/** One owner for the column's visibility, selected tab, and selected Companion. */
export function useRightPanel(hostId: string | null, destination: object) {
  const scope = JSON.stringify(destination);
  const [stored, setStored] = useState<PanelState>(() => panelAt(null, scope, hostId));
  const current = panelAt(stored, scope, hostId);
  // Reset during render so the new page never draws the old page's open column, even for one frame.
  if (current !== stored) setStored(current);
  const show = useCallback((content: PanelContent | null) => setStored({ content, hostId, scope }), [hostId, scope]);
  return { content: current.content, show };
}

/** The column control shared by the app's explicit details actions and the shell's Companion buttons. */
export type RightPanel = ReturnType<typeof useRightPanel>;
