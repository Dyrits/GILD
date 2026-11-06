import { Settings } from "@openmission/contracts";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";

export const defaultSettings: Settings = {
  approvalLevel: "RiskyOnly",
  defaultDelivery: "Steer",
  defaultEffort: "default",
  defaultModel: "default",
  shouldStreamReplies: true,
};

const decode = Schema.decodeUnknownSync(Settings);

export const readSettings = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ value: string }>`SELECT value FROM settings WHERE key = 'settings'`;
  if (row === undefined) return defaultSettings;
  // A setting added after the owner last saved takes its default; the saved choices stay.
  try {
    return decode({ ...defaultSettings, ...JSON.parse(row.value) });
  } catch {
    return defaultSettings;
  }
});

export const writeSettings = (settings: Settings) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`INSERT INTO settings (key, value) VALUES ('settings', ${JSON.stringify(settings)})
      ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
    return settings;
  });
