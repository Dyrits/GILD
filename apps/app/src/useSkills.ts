import type { Skill } from "@gild/contracts";
import type { ServiceClient } from "./client";
import { useServiceQuery } from "./useServiceQuery";

const none: ReadonlyArray<Skill> = [];

/** The skills a message written in a workspace (or none) can name with a slash. */
export function useSkills(client: ServiceClient, workspacePath: string | null): ReadonlyArray<Skill> {
  const { data } = useServiceQuery(client, { _tag: "ListSkills", workspacePath }, `skills:${workspacePath ?? ""}`);
  return data ?? none;
}
