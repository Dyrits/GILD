// Migration check, step 1: copy into packages/service/test/ of a copy of the starting commit (7b6ee2e): saves one
// intel and one global save awaiting approval with the schema before origins.
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { fakeHarnessLayer, serviceLayer } from "../src/index.ts";
import { start, tool } from "./fixtures/batch7.ts";

const directory = "/tmp/om-verify/migration14";
it.live("saves intel before origins exist", () =>
  Effect.gen(function* () {
    const { threadId } = yield* start("Hello");
    yield* Effect.sleep("200 millis");
    const save = (text: string, scope: string) => tool(threadId, "save_intel", { kind: "fact", scope, text });
    expect(yield* save("Saved before origins.", "thread")).toContain("Saved");
    expect(yield* save("Global before origins.", "global")).toContain("Awaiting");
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
