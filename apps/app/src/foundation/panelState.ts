/** What the right-hand column was explicitly opened to show. */
export type PanelContent = { tab: "quest" } | { tab: "companion"; id: string; isIskios: boolean };

/** A column selection belongs to one destination, except for Iskios's Companion. */
export type PanelState = { hostId: string | null; scope: string; content: PanelContent | null };

/** Starts each destination closed, carrying only an explicitly selected Iskios picker. */
export const panelAt = (state: PanelState | null, scope: string, hostId: string | null = null): PanelState => {
  if (state?.scope === scope && state.hostId === hostId) return state;
  const content =
    state?.hostId === hostId && state.content?.tab === "companion" && state.content.isIskios ? state.content : null;
  return { content, hostId, scope };
};
