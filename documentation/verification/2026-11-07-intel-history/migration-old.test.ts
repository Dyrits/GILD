// Migration check, step 1: copy into packages/service/test/ of a copy of the starting commit (7b6ee2e): saves
// two intels, edits one, and deletes the other, with the schema before history and origins.
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { fakeHarnessLayer, serviceLayer } from "../src/index.ts";
import { call, start, tool } from "./fixtures/batch7.ts";

const directory = "/tmp/om-verify/migration15";
it.live("saves intel before history exists", () =>
  Effect.gen(function* () {
    const { threadId } = yield* start("Hello");
    yield* Effect.sleep("200 millis");
    const save = (text: string) => tool(threadId, "save_intel", { kind: "rule", scope: "mission", text });
    expect(yield* save("Saved before history.")).toContain("Saved");
    expect(yield* save("Deleted before history.")).toContain("Saved");
    const { intels } = yield* call({ _tag: "ListIntel", scope: null, state: null, threadId: null });
    const deleted = intels.find((intel) => intel.text === "Deleted before history.");
    yield* call({ _tag: "DeleteIntel", intelId: deleted?.id ?? ("" as never) });
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
