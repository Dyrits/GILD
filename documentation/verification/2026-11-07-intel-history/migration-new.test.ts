// Migration check, step 2: copy into packages/service/test/ of a copy of the end state, on the database from step 1.
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { fakeHarnessLayer, serviceLayer } from "../src/index.ts";
import { call } from "./fixtures/batch7.ts";

const directory = "/tmp/om-verify/migration15";
it.live("starts old intel's history with its save, which can be undone", () =>
  Effect.gen(function* () {
    const { intels } = yield* call({ _tag: "ListIntel", scope: null, state: null, threadId: null });
    expect(intels.map((intel) => intel.text)).toEqual(["Saved before history."]);
    const [intel] = intels;
    if (intel === undefined) return expect.unreachable("the old intel is gone");
    const history = yield* call({ _tag: "ReadIntelHistory", intelId: intel.id });
    expect(history.entries).toMatchObject([
      { actor: "Thread", canUndo: true, kind: "Saved", previousText: null, text: "Saved before history." },
    ]);
    expect(history.entries[0]?.actorTitle).not.toBeNull();
    // An intel deleted before history has none, so it is not offered for Undo deletion.
    expect((yield* call({ _tag: "ListIntel", scope: null, state: "Deleted", threadId: null })).deleted).toEqual([]);
    yield* call({ _tag: "UndoIntelChange", entryId: history.entries[0]?.id ?? ("" as never) });
    const after = yield* call({ _tag: "ListIntel", scope: null, state: "Deleted", threadId: null });
    expect(after.deleted).toMatchObject([{ id: intel.id, kind: "Rule", text: "Saved before history." }]);
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
