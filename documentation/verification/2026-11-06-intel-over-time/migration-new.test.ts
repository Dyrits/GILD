// Migration check, step 2: copy into packages/service/test/ of a worktree of the end state on the database from step 1.
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { fakeHarnessLayer, serviceLayer } from "../src/index.ts";
import { call } from "./fixtures/batch7.ts";

const directory = "/tmp/om-verify/migration";
it.live("reads an old intel as an active fact, never used, last used when saved", () =>
  Effect.gen(function* () {
    const [intel] = (yield* call({ _tag: "ListIntel", scope: null, state: null, threadId: null })).intels;
    expect(intel).toMatchObject({
      isPinned: false,
      kind: "Fact",
      state: "Active",
      text: "Saved before kinds.",
      uses: 0,
    });
    expect(intel?.lastUsedAt).toBe(intel?.savedAt);
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
