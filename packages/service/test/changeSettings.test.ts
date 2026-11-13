import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { call, fixture } from "./fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const live = () => {
  const value = fixture();
  fixtures.push(value);
  return value.layer;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("changing some settings", () => {
  it.live("merges into the saved settings, so a change made meanwhile is kept", () =>
    Effect.gen(function* () {
      const first = yield* call({ _tag: "ChangeSettings", change: { shouldShowAgentThreads: false } });
      expect(first.shouldShowAgentThreads).toBe(false);
      // A second change from a screen that has not seen the first.
      const second = yield* call({ _tag: "ChangeSettings", change: { chatterThreshold: 7 } });
      expect(second.shouldShowAgentThreads).toBe(false);
      expect(second.chatterThreshold).toBe(7);
      expect(yield* call({ _tag: "ReadSettings" })).toEqual(second);
    }).pipe(Effect.provide(live())),
  );
  it.live("refuses an invalid value and leaves the saved settings alone", () =>
    Effect.gen(function* () {
      const before = yield* call({ _tag: "ReadSettings" });
      const failure = yield* Effect.flip(call({ _tag: "ChangeSettings", change: { chatterThreshold: 1 } }));
      expect(failure).toBeDefined();
      expect(yield* call({ _tag: "ReadSettings" })).toEqual(before);
    }).pipe(Effect.provide(live())),
  );
});
