import type { ThreadId } from "@iskios/contracts";
import { actWith } from "../foundation/acting";
import type { ServiceClient } from "../foundation/client";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { type PresetChoice, presetChangeOf, presetsOf } from "./presets";

/** What a thread's Companion picker needs to offer the presets: the thread's current backups, the presets set in the Workshop, and what choosing one asks of the service, with a failure shown through `setError`. */
export function useThreadPresets(
  client: ServiceClient,
  threadId: ThreadId,
  setError: (error: string | null) => void,
): PresetChoice | null {
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const { data: panel } = useServiceQuery(client, { _tag: "ReadThreadPanel", threadId }, `companion:${threadId}`);
  if (settings === null) return null;
  return {
    backups: panel?.backups ?? null,
    onPreset: (preset) =>
      actWith(setError)(client.request({ _tag: "ChangeThreadRunner", ...presetChangeOf(preset), threadId })),
    presets: presetsOf(settings.tiers),
  };
}
