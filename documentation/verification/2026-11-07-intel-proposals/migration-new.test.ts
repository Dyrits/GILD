// Migration check, step 2: copy into packages/service/test/ of a copy of the end state, on the database from step 1.
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { fakeHarnessLayer, serviceLayer } from "../src/index.ts";
import { call } from "./fixtures/batch7.ts";

const directory = "/tmp/om-verify/migration16";
it.live("proposes widening for intel saved before 0020 and applies it, keeping the old use", () =>
  Effect.gen(function* () {
    const view = yield* call({ _tag: "ListIntel", scope: null, state: null, threadId: null });
    expect(view.proposals).toMatchObject([
      { kind: "Widen", scopeLabel: "Global", text: "Releases are tagged on main." },
    ]);
    const [proposal] = view.proposals;
    if (proposal === undefined) return expect.unreachable("no proposal");
    yield* call({ _tag: "ResolveIntelProposal", isApproved: true, proposalId: proposal.id });
    const after = yield* call({ _tag: "ListIntel", scope: null, state: null, threadId: null });
    expect(after.intels).toMatchObject([{ scope: "Global", text: "Releases are tagged on main.", uses: 1 }]);
    expect(after.proposals).toEqual([]);
  }).pipe(
    Effect.provide(
      serviceLayer({
        filename: `${directory}/store.sqlite`,
        harness: fakeHarnessLayer("10 millis"),
        homeFolder: directory,
        scratchRoot: `${directory}/missions`,
      }),
    ),
  ),
);
