import type { IntelProposal, IntelProposalId, ProposedIntel } from "@gild/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "./errors.ts";
import { type IntelRow, scopeLabelOf, selectIntels } from "./intel.ts";
import { isSameOf } from "./intelDuplicates.ts";
import { type Fading, halfLifeDaysOf, readFading, stateOfIntel } from "./intelFading.ts";
import { owner } from "./intelHistory.ts";
import { mergeIntels, moveIntel } from "./intelStore.ts";
import { dayMillis } from "./settings.ts";

// Widening and narrowing proposed from evidence (scoped-intel): the same intel saved in several workspaces
// becomes one global intel, and a global intel used in one workspace only moves there, each once the owner
// approves. Provisional (work-in-progress, Batch 16): proposals are worked out from evidence when read, as
// fading is; only the owner's decisions are stored, so a declined proposal does not come back.

/** A proposal with what applying it needs. */
interface Evidence {
  readonly proposal: IntelProposal;
  /** The intels it moves or merges, the one kept first. */
  readonly rows: ReadonlyArray<IntelRow>;
  /** For a narrowing, the workspace it moves the intel to; null for a widening. */
  readonly workspaceId: string | null;
}

const proposedOf = (row: IntelRow): ProposedIntel => ({
  id: row.id as ProposedIntel["id"],
  scopeLabel: scopeLabelOf(row),
  text: row.text,
});

/** Groups intels that say the same thing, each pair joined through any intel the two say the same as. */
const groupsOf = (rows: ReadonlyArray<IntelRow>) => {
  const groupOf = new Map(rows.map((row) => [row.id, row.id]));
  const rootOf = (id: string): string => {
    const parent = groupOf.get(id) ?? id;
    return parent === id ? id : rootOf(parent);
  };
  for (const [index, row] of rows.entries()) {
    for (const other of rows.slice(index + 1)) {
      if (isSameOf(row.text, other.text)) groupOf.set(rootOf(other.id), rootOf(row.id));
    }
  }
  const groups = new Map<string, Array<IntelRow>>();
  for (const row of rows) groups.set(rootOf(row.id), [...(groups.get(rootOf(row.id)) ?? []), row]);
  return [...groups.values()];
};

/**
 * Widenings: workspace intels in two or more workspaces that say the same thing, as one global intel with
 * the newest text and kind. None when a global intel already says it.
 */
const widenings = (rows: ReadonlyArray<IntelRow>): ReadonlyArray<Evidence> => {
  const globals = rows.filter((row) => row.scope === "Global");
  return groupsOf(rows.filter((row) => row.scope === "Workspace"))
    .filter((group) => new Set(group.map((row) => row.workspaceId)).size >= 2)
    .map((group) => group.toSorted((a, b) => b.updatedAt - a.updatedAt || b.savedAt - a.savedAt))
    .flatMap((group) => {
      const [newest] = group;
      if (newest === undefined || globals.some((row) => isSameOf(row.text, newest.text))) return [];
      return [
        {
          proposal: {
            halfLifeDays: null,
            id: `Widen:${group
              .map((row) => row.id)
              .toSorted()
              .join(",")}` as IntelProposalId,
            intelKind: newest.kind,
            intels: group.map(proposedOf),
            kind: "Widen",
            scopeLabel: "Global",
            text: newest.text,
            uses: null,
          },
          rows: group,
          workspaceId: null,
        } satisfies Evidence,
      ];
    });
};

/**
 * Narrowings: a global intel saved at least its kind's half-life ago whose every use over the last half-life
 * came from one workspace, with at least one use. A rule has no half-life, so it is never narrowed.
 */
const narrowings = (rows: ReadonlyArray<IntelRow>, fading: Fading) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const found: Array<Evidence> = [];
    for (const row of rows.filter((candidate) => candidate.scope === "Global")) {
      const halfLifeDays = halfLifeDaysOf(row.kind, fading.halfLives);
      if (halfLifeDays === null) continue;
      const since = fading.now - halfLifeDays * dayMillis;
      if (row.savedAt > since) continue;
      const uses = yield* sql<{ count: number; workspaceId: string | null; workspaceName: string | null }>`
        SELECT COUNT(*) AS count, u.workspace_id AS workspaceId, w.name AS workspaceName
        FROM intel_uses u LEFT JOIN workspaces w ON w.id = u.workspace_id
        WHERE u.intel_id = ${row.id} AND u.at > ${since} GROUP BY u.workspace_id`;
      const [only, ...others] = uses;
      if (only === undefined || others.length > 0 || only.workspaceId === null || only.workspaceName === null) {
        continue;
      }
      found.push({
        proposal: {
          halfLifeDays,
          id: `Narrow:${row.id}:${only.workspaceId}` as IntelProposalId,
          intelKind: row.kind,
          intels: [proposedOf(row)],
          kind: "Narrow",
          scopeLabel: scopeLabelOf({ ...row, scope: "Workspace", workspaceName: only.workspaceName }),
          text: row.text,
          uses: only.count,
        },
        rows: [row],
        workspaceId: only.workspaceId,
      });
    }
    return found;
  });

/** Every proposal the evidence backs now and the owner has not decided, widenings first. */
const readEvidence = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const fading = yield* readFading;
  // Archived intel is out of search, so it is out of proposals too.
  const rows = (yield* sql<IntelRow>`${selectIntels(sql)}
    WHERE i.scope IN ('Workspace', 'Global') ORDER BY i.saved_at, i.rowid`).filter(
    (row) => stateOfIntel(row, fading) !== "Archived",
  );
  const all = [...widenings(rows), ...(yield* narrowings(rows, fading))];
  if (all.length === 0) return [];
  const decided = yield* sql<{ id: string }>`SELECT id FROM intel_proposal_decisions
    WHERE id IN ${sql.in(all.map((evidence) => evidence.proposal.id))}`;
  return all.filter((evidence) => !decided.some((row) => row.id === evidence.proposal.id));
});

/** The proposals awaiting the owner in the intel panel. */
export const listIntelProposals = readEvidence.pipe(Effect.map((found) => found.map((evidence) => evidence.proposal)));

/**
 * The owner approves or declines a proposal; either way it is not proposed again. A proposal the evidence no
 * longer backs is refused. Callers run it in a transaction.
 */
export const resolveIntelProposal = (proposalId: string, isApproved: boolean) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const evidence = (yield* readEvidence).find((found) => found.proposal.id === proposalId);
    if (evidence === undefined) {
      return yield* invalid("This proposal no longer holds: it was decided, or its intels changed.");
    }
    const now = yield* Clock.currentTimeMillis;
    yield* sql`INSERT INTO intel_proposal_decisions (id, status, at)
      VALUES (${proposalId}, ${isApproved ? "Approved" : "Declined"}, ${now})`;
    if (!isApproved) return null;
    const [row] = evidence.rows;
    // A widening makes the newest intel global and merges the others into it; a narrowing moves the intel to
    // the one workspace that used it.
    if (evidence.workspaceId === null && row !== undefined) {
      yield* mergeIntels(
        row.id,
        evidence.rows.slice(1).map((merged) => merged.id),
      );
    } else if (evidence.workspaceId !== null && row !== undefined) {
      const placement = { scope: "Workspace", threadId: null, workspaceId: evidence.workspaceId } as const;
      yield* moveIntel(row.id, placement, null, "Narrowed", owner);
    }
    return null;
  });
