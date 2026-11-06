import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { call, fixture, open, read, settle, start, tool } from "./fixtures/batch7.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const live = () => {
  const value = fixture();
  fixtures.push(value);
  return value.layer;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("folding threads opened by agents", () => {
  it.live("shows agent-opened threads by default and saves the owner's folding choice", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      expect(settings.shouldShowAgentThreads).toBe(true);
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, shouldShowAgentThreads: false } });
      expect((yield* call({ _tag: "ReadSettings" })).shouldShowAgentThreads).toBe(false);
    }).pipe(Effect.provide(live())),
  );
  it.live("reads the folding default from settings saved before the field existed", () =>
    Effect.gen(function* () {
      const value = fixture();
      fixtures.push(value);
      yield* call({ _tag: "ReadSettings" }).pipe(Effect.provide(value.layer));
      const database = new DatabaseSync(join(value.directory, "store.sqlite"));
      database
        .prepare("INSERT INTO settings (key, value) VALUES ('settings', ?)")
        .run(JSON.stringify({ defaultModel: "haiku", shouldStreamReplies: false }));
      database.close();
      const settings = yield* call({ _tag: "ReadSettings" }).pipe(Effect.provide(value.layer));
      expect(settings.shouldShowAgentThreads).toBe(true);
      expect(settings.defaultModel).toBe("haiku");
      expect(settings.shouldStreamReplies).toBe(false);
    }),
  );

  it.live("exposes opener, parentage, depth and Attention while folding leaves threads running and reachable", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 5000");
      yield* tool(started.threadId, "open_thread", { request: "wait 5000", title: "Agent opened" });
      const detail = yield* settle(started.missionId, (d) => d.threads.length === 2);
      const agent = detail.threads.find((t) => t.parentId === started.threadId);
      if (agent === undefined) return yield* Effect.die("Missing thread");
      const owner = yield* open(agent.id, 'ask {"action":"Push","command":"git push"}');
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, shouldShowAgentThreads: false } });
      const folded = yield* settle(started.missionId, (d) =>
        d.threads.some((t) => t.id === owner.threadId && t.state === "Attention"),
      );
      expect(folded.threads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            depth: 1,
            id: agent.id,
            isOpenedByAgent: true,
            parentId: started.threadId,
            state: "Running",
          }),
          expect.objectContaining({
            depth: 2,
            id: owner.threadId,
            isOpenedByAgent: false,
            parentId: agent.id,
            state: "Attention",
          }),
        ]),
      );
      yield* tool(started.threadId, "send_thread_message", { text: "Still reachable", to: agent.id });
      expect((yield* read(started.missionId, agent.id)).messages.some((m) => m.text === "Still reachable")).toBe(true);
    }).pipe(Effect.provide(live())),
  );
});
