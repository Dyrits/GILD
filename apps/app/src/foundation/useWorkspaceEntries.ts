import type { WorkspaceEntry } from "@iskios/contracts";
import { useEffect, useState } from "react";
import type { ServiceClient } from "./client";

const none: ReadonlyArray<WorkspaceEntry> = [];

/** The files and folders of a workspace that match what follows a typed `@`; none outside a workspace or with no `@`. */
export function useWorkspaceEntries(
  client: ServiceClient | undefined,
  workspacePath: string | null,
  query: string | null,
): ReadonlyArray<WorkspaceEntry> {
  const [found, setFound] = useState<{ workspacePath: string; entries: ReadonlyArray<WorkspaceEntry> } | null>(null);
  const key = client === undefined || workspacePath === null || query === null ? null : `${workspacePath}\0${query}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key identifies the request.
  useEffect(() => {
    if (client === undefined || workspacePath === null || query === null) return;
    let isCurrent = true;
    client.request({ _tag: "ListWorkspaceEntries", query, workspacePath }).then(
      (entries) => {
        if (isCurrent) setFound({ entries, workspacePath });
      },
      () => {
        if (isCurrent) setFound({ entries: none, workspacePath });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [client, key]);
  // The previous answer stays while the next loads, so the list does not flicker with each keystroke.
  return key !== null && found?.workspacePath === workspacePath ? found.entries : none;
}
