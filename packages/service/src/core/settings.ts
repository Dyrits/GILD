import { Settings, StartChoices, startingModel } from "@iskios/contracts";
import { Effect, Exit, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "./errors.ts";

// Stored and wire names keep `intel` so existing data and agents still work: settings keys (`intelHalfLives`, `intelWarningPercent`).

/** A day in milliseconds, the unit of the Settings durations. */
export const dayMillis = 24 * 60 * 60 * 1000;

/** The settings before the owner changes any. */
export const defaultSettings: Settings = {
  approvalLevel: "RiskyOnly",
  autoArchiveDays: 30,
  backups: [],
  briefingLimit: 2000,
  chatterThreshold: 20,
  defaultDelivery: "Steer",
  defaultEffort: "default",
  defaultHarness: "claude",
  defaultMissionBudget: { cost: null, tokens: null },
  defaultModel: startingModel,
  globalBudget: { cost: null, tokens: null },
  globalBudgetPeriod: "Month",
  inactivityDays: 14,
  intelHalfLives: { decision: 45, fact: 45, preference: 90, temporary: 3 },
  intelWarningPercent: 10,
  shouldAutoArchive: false,
  shouldFetchPrices: true,
  shouldOpenOffTopicMissions: false,
  shouldShowAgentThreads: true,
  shouldShowFinishedQuests: false,
  shouldStreamReplies: true,
  tiers: { Balanced: null, Heavy: null, Light: null },
};

const decode = Schema.decodeUnknownSync(Settings);

/** Reads the owner's settings, or the defaults when none are stored or they no longer decode. */
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

/** Stores the owner's settings, refusing any that do not decode. */
export const writeSettings = (settings: Settings) =>
  Effect.gen(function* () {
    const parsed = yield* Schema.decodeUnknownEffect(Settings)(settings).pipe(
      Effect.catch(() =>
        invalid(
          "Invalid settings: the chatter threshold must be a whole number of at least 2; the briefing limit, the inactivity and auto-archive days, and the lore half-lives at least 1; budget limits above 0, tokens in whole numbers.",
        ),
      ),
    );
    const sql = yield* SqlClient.SqlClient;
    yield* sql`INSERT INTO settings (key, value) VALUES ('settings', ${JSON.stringify(parsed)})
      ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
    return settings;
  });

const decodeChoices = Schema.decodeUnknownExit(StartChoices);

/** Saved choices as JSON, with the harness fields older saves lack: Claude Code on the computer's own sign-in. */
const choicesOf = (text: string) => {
  try {
    return decodeChoices({ accountId: null, harness: "claude", ...JSON.parse(text) });
  } catch {
    return null;
  }
};

/**
 * A new mission's choices: always the Workshop's default Companion (harness, model, and effort, on the computer's own
 * sign-in), with the folder of the last mission started, or none before any (mission-tracking).
 */
export const readStartChoices = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ value: string }>`SELECT value FROM settings WHERE key = 'start_choices'`;
  // A value no longer valid leaves no folder.
  const decoded = row === undefined ? null : choicesOf(row.value);
  const workspacePath = decoded !== null && Exit.isSuccess(decoded) ? decoded.value.workspacePath : null;
  const settings = yield* readSettings;
  return {
    accountId: null,
    effort: settings.defaultEffort,
    harness: settings.defaultHarness,
    model: settings.defaultModel,
    workspacePath,
  } satisfies StartChoices;
});

/** Remembers a started mission's choices; the next mission takes its folder. Callers run it in a transaction. */
export const saveStartChoices = (choices: StartChoices) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`INSERT INTO settings (key, value) VALUES ('start_choices', ${JSON.stringify(choices)})
      ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
  });
