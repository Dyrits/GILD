import type { Mentionable } from "@iskios/contracts";
import { useEffect, useState } from "react";
import type { ServiceClient } from "./client";

// The quests, side-quests, and realms a typed `@` can name (CHG-0181), loaded once per client for every message box and
// every message that shows one as a chip, and loaded again after each committed change while any of them is shown.

interface Shared {
  readonly listeners: Set<() => void>;
  mentionables: ReadonlyArray<Mentionable> | null;
  unsubscribe: (() => void) | null;
}

const shared = new WeakMap<ServiceClient, Shared>();

const sharedOf = (client: ServiceClient) => {
  const known = shared.get(client);
  if (known !== undefined) return known;
  const made: Shared = { listeners: new Set(), mentionables: null, unsubscribe: null };
  shared.set(client, made);
  return made;
};

const load = (client: ServiceClient, state: Shared) =>
  client.request({ _tag: "ListMentionables" }).then(
    (mentionables) => {
      state.mentionables = mentionables;
      for (const listener of state.listeners) listener();
    },
    // A failed read keeps the last list; the next change reads again.
    () => void 0,
  );

/** The quests, side-quests, and realms to offer or to show as chips; null until first loaded, or while not needed. */
export function useMentionables(client: ServiceClient | undefined, isNeeded: boolean) {
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (client === undefined || !isNeeded) return;
    const state = sharedOf(client);
    const listener = () => setVersion((version) => version + 1);
    state.listeners.add(listener);
    if (state.unsubscribe === null) {
      void load(client, state);
      state.unsubscribe = client.subscribe(() => void load(client, state));
    }
    return () => {
      state.listeners.delete(listener);
      if (state.listeners.size === 0) {
        state.unsubscribe?.();
        state.unsubscribe = null;
      }
    };
  }, [client, isNeeded]);
  return client === undefined || !isNeeded ? null : (shared.get(client)?.mentionables ?? null);
}
