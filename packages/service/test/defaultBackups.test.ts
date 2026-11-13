import { describe, expect, it } from "@effect/vitest";
import type { BackupCompanion } from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { call, fixture, open, settle, start } from "./fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});
const withService = <A, E, R>(body: Effect.Effect<A, E, R>) => {
  const value = fixture();
  fixtures.push(value);
  return body.pipe(Effect.provide(value.layer));
};

const codex: BackupCompanion = { accountId: null, effort: "default", harness: "codex", model: "gpt-5" };
const opencode: BackupCompanion = { accountId: null, effort: "default", harness: "opencode", model: "default" };

describe("the Charter's default backup Companions", () => {
  it.live("are empty at first and saved with the settings", () =>
    withService(
      Effect.gen(function* () {
        const settings = yield* call({ _tag: "ReadSettings" });
        expect(settings.backups).toEqual([]);
        yield* call({ _tag: "UpdateSettings", settings: { ...settings, backups: [codex] } });
        expect((yield* call({ _tag: "ReadSettings" })).backups).toEqual([codex]);
      }),
    ),
  );

  it.live("are refused beyond five", () =>
    withService(
      Effect.gen(function* () {
        const settings = yield* call({ _tag: "ReadSettings" });
        const refusal = yield* call({
          _tag: "UpdateSettings",
          settings: { ...settings, backups: Array.from({ length: 6 }, () => codex) },
        }).pipe(Effect.flip);
        expect(String(refusal)).toContain("Invalid settings");
      }),
    ),
  );

  it.live("start a new quest's thread, and a side-quest takes its parent's, not a later change", () =>
    withService(
      Effect.gen(function* () {
        const settings = yield* call({ _tag: "ReadSettings" });
        yield* call({ _tag: "UpdateSettings", settings: { ...settings, backups: [codex] } });
        const { missionId, threadId } = yield* start("Hello");
        yield* settle(missionId, (d) => d.thread.state === "Idle");
        expect((yield* call({ _tag: "ReadThreadPanel", threadId })).backups).toEqual([codex]);
        // A later change to the Charter leaves a quest that began already as it was.
        yield* call({ _tag: "UpdateSettings", settings: { ...settings, backups: [opencode] } });
        expect((yield* call({ _tag: "ReadThreadPanel", threadId })).backups).toEqual([codex]);
        const opened = yield* open(threadId, "wait 2000");
        expect((yield* call({ _tag: "ReadThreadPanel", threadId: opened.threadId })).backups).toEqual([codex]);
      }),
    ),
  );
});

describe("settings saved before the Guild Hall became always shown", () => {
  it.live("keep their other choices and drop the retired one", () =>
    withService(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const settings = yield* call({ _tag: "ReadSettings" });
        yield* sql`INSERT INTO settings (key, value) VALUES ('settings', ${JSON.stringify({ ...settings, inactivityDays: 30, shouldShowGuildmaster: false })})
          ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
        const read = yield* call({ _tag: "ReadSettings" });
        expect(read.inactivityDays).toBe(30);
        expect(read).not.toHaveProperty("shouldShowGuildmaster");
        yield* call({ _tag: "ChangeSettings", change: { inactivityDays: 31 } });
        const [row] = yield* sql<{ value: string }>`SELECT value FROM settings WHERE key = 'settings'`;
        expect(JSON.parse(row?.value ?? "{}")).not.toHaveProperty("shouldShowGuildmaster");
      }),
    ),
  );
});
