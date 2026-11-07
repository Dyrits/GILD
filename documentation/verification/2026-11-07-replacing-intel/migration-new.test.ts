// Migration check, step 2: copy into packages/service/test/ of a copy of the end state, on the database from step 1.
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { fakeHarnessLayer, serviceLayer } from "../src/index.ts";
import { call } from "./fixtures/batch7.ts";

const directory = "/tmp/om-verify/migration14";
it.live("reads old intel with no origin, and approves an old global save with none", () =>
  Effect.gen(function* () {
    const before = yield* call({ _tag: "ListIntel", scope: null, state: null, threadId: null });
    expect(before.intels).toMatchObject([{ origin: null, text: "Saved before origins." }]);
    const [change] = before.awaiting;
    if (change === undefined) return expect.unreachable("the old global save no longer awaits approval");
    yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: true });
    const after = yield* call({ _tag: "ListIntel", scope: "Global", state: null, threadId: null });
    expect(after.intels).toMatchObject([{ origin: null, text: "Global before origins." }]);
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
