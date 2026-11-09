import type { MissionList, MissionState, WorkspaceId } from "@gild/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { listViewSummaries } from "./missions.ts";

// The dashboard's list of missions: filters, search, and order (mission-tracking, Dashboard).

/** Missions in these states come first: they need the owner. */
const statesNeedingOwner: ReadonlyArray<MissionState> = ["Attention", "Failed"];

/** The dashboard's filters: the Archived view or not, a state, a workspace, and a search text. */
export interface MissionFilters {
  readonly isArchived: boolean;
  readonly search: string | null;
  readonly state: MissionState | null;
  readonly workspaceId: string | null;
}

/** The ids of the missions whose title or briefing contains the search text, ignoring case. */
const listSearchMatches = (search: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // instr, not LIKE, so % and _ in the search are plain text.
    const rows = yield* sql<{ id: string }>`
      SELECT m.id FROM missions m LEFT JOIN journals j ON j.mission_id = m.id
      WHERE instr(lower(m.title), ${search}) > 0 OR instr(lower(COALESCE(j.briefing, '')), ${search}) > 0`;
    return new Set(rows.map((row) => row.id));
  });

/**
 * The view's missions that match the filters, those needing the owner first and then by latest activity,
 * with the workspaces among all the view's missions.
 */
export const listMissions = (filters: MissionFilters) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const summaries = yield* listViewSummaries(filters.isArchived);
    const ids = new Set(summaries.flatMap((summary) => (summary.workspaceId === null ? [] : [summary.workspaceId])));
    const known = yield* sql<{ id: WorkspaceId; name: string; path: string }>`SELECT id, name, path FROM workspaces`;
    const workspaces = known.filter((workspace) => ids.has(workspace.id));
    const search = filters.search?.trim().toLowerCase() ?? "";
    const matching = search === "" ? null : yield* listSearchMatches(search);
    const missions = summaries.filter(
      (mission) =>
        (matching === null || matching.has(mission.id)) &&
        (filters.workspaceId === null || mission.workspaceId === filters.workspaceId) &&
        (filters.state === null || mission.state === filters.state),
    );
    const first = missions.filter((mission) => statesNeedingOwner.includes(mission.state));
    return {
      missions: [...first, ...missions.filter((mission) => !statesNeedingOwner.includes(mission.state))],
      workspaces: workspaces.map(({ id, name, path }) => ({ id, name, path })),
    } satisfies MissionList;
  });
