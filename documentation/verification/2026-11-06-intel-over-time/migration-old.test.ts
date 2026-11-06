// Migration check, step 1: copy into packages/service/test/ of a worktree of the starting commit: saves one intel with the old schema.
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { fakeHarnessLayer, serviceLayer } from "../src/index.ts";
import { start, tool } from "./fixtures/batch7.ts";

const directory = "/tmp/om-verify/migration";
it.live("saves an intel before kinds exist", () =>
  Effect.gen(function* () {
    const { threadId } = yield* start("Hello");
    yield* Effect.sleep("200 millis");
    expect(yield* tool(threadId, "save_intel", { scope: "thread", text: "Saved before kinds." })).toContain("Saved");
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
