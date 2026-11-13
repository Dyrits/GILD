import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { call, fixture, open, read, start } from "./fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const live = () => {
  const value = fixture();
  fixtures.push(value);
  return value.layer;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("reading a mission's thread tree", () => {
  it.live("returns the same threads as reading the mission, and refuses an unknown mission", () =>
    Effect.gen(function* () {
      const started = yield* start();
      yield* open(started.threadId);
      const tree = yield* call({ _tag: "ReadThreadTree", missionId: started.missionId });
      expect(tree).toHaveLength(2);
      // The threads' states and times move while their turns run, so only their place in the tree is compared.
      const placeOf = (threads: typeof tree) => threads.map(({ depth, id, parentId }) => ({ depth, id, parentId }));
      expect(placeOf(tree)).toEqual(placeOf((yield* read(started.missionId)).threads));
      const failure = yield* Effect.flip(
        call({ _tag: "ReadThreadTree", missionId: "00000000-0000-0000-0000-000000000000" as typeof started.missionId }),
      );
      expect(failure).toBeDefined();
    }).pipe(Effect.provide(live())),
  );
});
