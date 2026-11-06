import { Settings } from "@openmission/contracts";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "./errors.ts";

export const defaultSettings: Settings = {
  approvalLevel: "RiskyOnly",
  briefingLimit: 2000,
  chatterThreshold: 20,
  defaultDelivery: "Steer",
  defaultEffort: "default",
  defaultModel: "default",
  shouldShowAgentThreads: true,
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
    const parsed = yield* Schema.decodeUnknownEffect(Settings)(settings).pipe(
      Effect.catch(() =>
        invalid(
          "Invalid settings: the chatter threshold must be a whole number of at least 2, and the briefing limit at least 1.",
        ),
      ),
    );
    const sql = yield* SqlClient.SqlClient;
    yield* sql`INSERT INTO settings (key, value) VALUES ('settings', ${JSON.stringify(parsed)})
      ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
    return settings;
  });
