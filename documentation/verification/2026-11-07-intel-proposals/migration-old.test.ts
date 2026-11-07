// Migration check, step 1: copy into packages/service/test/ of a copy of the starting commit (schema at 0019).
import { mkdirSync } from "node:fs";
import { expect, it } from "@effect/vitest";
import type { ThreadId } from "@openmission/contracts";
import { Effect } from "effect";
import { fakeHarnessLayer, serviceLayer } from "../src/index.ts";
import { call, start, tool } from "./fixtures/batch7.ts";

const directory = "/tmp/om-verify/migration16";
const workspace = (name: string) => {
  mkdirSync(`${directory}/${name}`, { recursive: true });
  return `${directory}/${name}`;
};
const idle = (path: string) =>
  Effect.gen(function* () {
    const { threadId } = yield* start("Hello", path);
    yield* Effect.sleep("300 millis");
    return threadId as ThreadId;
  });
it.live("saves the same workspace intel in two workspaces before uses had workspaces", () =>
  Effect.gen(function* () {
    const alpha = yield* idle(workspace("alpha"));
    const beta = yield* idle(workspace("beta"));
    yield* tool(alpha, "save_intel", { kind: "fact", scope: "workspace", text: "Releases are tagged on main." });
    yield* tool(beta, "save_intel", { kind: "fact", scope: "workspace", text: "Releases are tagged on main." });
    yield* tool(alpha, "search_intel", { query: "releases" });
    const { intels } = yield* call({ _tag: "ListIntel", scope: null, state: null, threadId: null });
    expect(intels).toHaveLength(2);
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
