import { Settings, StartChoices } from "@openmission/contracts";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "./errors.ts";

export const defaultSettings: Settings = {
  approvalLevel: "RiskyOnly",
  autoArchiveDays: 30,
  briefingLimit: 2000,
  chatterThreshold: 20,
  defaultDelivery: "Steer",
  defaultEffort: "default",
  defaultMissionBudget: { cost: null, tokens: null },
  defaultModel: "default",
  globalBudget: { cost: null, tokens: null },
  globalBudgetPeriod: "Month",
  inactivityDays: 14,
  shouldAutoArchive: false,
  shouldOpenOffTopicMissions: false,
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
          "Invalid settings: the chatter threshold must be a whole number of at least 2; the briefing limit and the inactivity and auto-archive days at least 1; budget limits above 0, tokens in whole numbers.",
        ),
      ),
    );
    const sql = yield* SqlClient.SqlClient;
    yield* sql`INSERT INTO settings (key, value) VALUES ('settings', ${JSON.stringify(parsed)})
      ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
    return settings;
  });

const decodeChoices = Schema.decodeUnknownSync(StartChoices);

/** The last mission's choices, or the Settings defaults with no workspace before any (mission-tracking). */
export const readStartChoices = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ value: string }>`SELECT value FROM settings WHERE key = 'start_choices'`;
  if (row !== undefined) {
    try {
      return decodeChoices(JSON.parse(row.value));
    } catch {
      // A value no longer valid falls back to the defaults below.
    }
  }
  const settings = yield* readSettings;
  return { effort: settings.defaultEffort, model: settings.defaultModel, workspacePath: null } satisfies StartChoices;
});

/** Remembers a started mission's choices for the next one. Callers run it in a transaction. */
export const saveStartChoices = (choices: StartChoices) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`INSERT INTO settings (key, value) VALUES ('start_choices', ${JSON.stringify(choices)})
      ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
  });
