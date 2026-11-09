import type { EndingPreview, MissionEnding, MissionSummary } from "@gild/contracts";
import { useState } from "react";
import type { ServiceClient } from "./client";

/**
 * Marks a mission Done or archives it; when threads are still at work, one confirmation names them first
 * (mission-tracking, Ending a mission).
 */
export function useEnding(client: ServiceClient, mission: MissionSummary) {
  const [pending, setPending] = useState<{ ending: MissionEnding; preview: EndingPreview } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const run = (work: () => Promise<unknown>) => {
    setIsBusy(true);
    work()
      .then(
        () => setError(null),
        (reason: Error) => {
          setError(reason.message);
          setPending(null);
        },
      )
      .finally(() => setIsBusy(false));
  };
  const finish = (ending: MissionEnding, preview: EndingPreview) =>
    client
      .request({ _tag: "EndMission", ending, missionId: mission.id, snapshot: preview.snapshot })
      .then(() => setPending(null));
  const start = (ending: MissionEnding) =>
    run(async () => {
      const preview = await client.request({ _tag: "PreviewEnding", ending, missionId: mission.id });
      if (preview.question === null) await finish(ending, preview);
      else setPending({ ending, preview });
    });
  const confirm = () => {
    if (pending !== null) run(() => finish(pending.ending, pending.preview));
  };
  return { cancel: () => setPending(null), confirm, error, isBusy, pending, run, start };
}
