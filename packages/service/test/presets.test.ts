import { describe, expect, it } from "@effect/vitest";
import { type BackupCompanion, ChangeSettings, type Tier } from "@iskios/contracts";
import { Effect, Exit, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { call, withService } from "./fixtures/service.ts";

const codex: BackupCompanion = { accountId: null, effort: "default", harness: "codex", model: "gpt-5" };
const heavy: Tier = { accountId: null, backups: [codex], effort: "high", harness: "claude", model: "opus" };

describe("saving presets", () => {
  it.live("saves a preset with its backups", () =>
    withService(
      Effect.gen(function* () {
        const settings = yield* call({ _tag: "ReadSettings" });
        const saved = yield* call({
          _tag: "ChangeSettings",
          change: { tiers: { ...settings.tiers, Heavy: heavy } },
        });
        expect(saved.tiers.Heavy).toEqual(heavy);
      }),
    ),
  );

  it.live("refuses a preset with more than five backups", () =>
    withService(
      Effect.gen(function* () {
        const settings = yield* call({ _tag: "ReadSettings" });
        const tooMany = { ...heavy, backups: Array.from({ length: 6 }, () => codex) };
        const failure = yield* Effect.flip(
          call({ _tag: "ChangeSettings", change: { tiers: { ...settings.tiers, Heavy: tooMany } } }),
        );
        expect(failure.kind).toBe("InvalidInput");
        expect((yield* call({ _tag: "ReadSettings" })).tiers.Heavy).toBeNull();
      }),
    ),
  );

  it.live("keeps a tier another change set when a change names only one tier", () =>
    withService(
      Effect.gen(function* () {
        const light: Tier = { accountId: null, backups: [], effort: "low", harness: "claude", model: "haiku" };
        yield* call({ _tag: "ChangeSettings", change: { tiers: { Balanced: null, Heavy: heavy, Light: null } } });
        yield* call({ _tag: "ChangeSettings", change: { tiers: { Light: light } } });
        const { tiers } = yield* call({ _tag: "ReadSettings" });
        expect(tiers).toEqual({ Balanced: null, Heavy: heavy, Light: light });
        yield* call({ _tag: "ChangeSettings", change: { tiers: { Heavy: null } } });
        expect((yield* call({ _tag: "ReadSettings" })).tiers).toEqual({ Balanced: null, Heavy: null, Light: light });
      }),
    ),
  );

  it("refuses a settings change that names a preset without its backups, so an older client cannot wipe them", () => {
    const withoutBackups = { accountId: null, effort: "high", harness: "claude", model: "opus" };
    const decoded = Schema.decodeUnknownExit(ChangeSettings)({
      _tag: "ChangeSettings",
      change: { tiers: { Heavy: withoutBackups } },
    });
    expect(Exit.isFailure(decoded)).toBe(true);
  });

  it.live("reads a preset saved before presets had backups with none, and keeps the owner's other choices", () =>
    withService(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const settings = yield* call({ _tag: "ReadSettings" });
        const legacy = { accountId: null, effort: "high", harness: "claude", model: "opus" };
        yield* sql`INSERT INTO settings (key, value) VALUES ('settings', ${JSON.stringify({ ...settings, inactivityDays: 30, tiers: { Balanced: null, Heavy: legacy, Light: null } })})
          ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
        const read = yield* call({ _tag: "ReadSettings" });
        expect(read.inactivityDays).toBe(30);
        expect(read.tiers.Heavy).toEqual({ ...legacy, backups: [] });
      }),
    ),
  );
});
