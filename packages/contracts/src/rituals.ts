import { Schema } from "effect";
import { ModelChoice } from "./companions.ts";
import { Crest } from "./crest.ts";
import { EffortChoice, HarnessName } from "./harnesses.ts";
import { AccountId, MissionId, RitualId, ThreadId } from "./ids.ts";
import { RequestId } from "./records.ts";
import { RitualRunState, RitualSchedule } from "./ritualSchedules.ts";

// Rituals: an instruction run on a schedule in a quest of its own, with Companions to fall back on (rituals).

/** One Companion a Ritual runs on: a harness, its account, a model, and an effort. */
export const RitualCompanion = Schema.Struct({
  /** The provider account, or null for the harness's own sign-in on this computer. */
  accountId: Schema.NullOr(AccountId),
  effort: EffortChoice,
  harness: HarnessName,
  model: ModelChoice,
});
export type RitualCompanion = typeof RitualCompanion.Type;

/**
 * The structural actions a Ritual's reviewed scope can let its runs take without asking (CHG-0208): acting on one
 * quest, or changing one setting. Commands need no scope: inside the sandbox they run unasked.
 */
export const RitualScopeOperation = Schema.Literals(["Stop", "Done", "Archive", "Rename", "ChangeSetting"]);
export type RitualScopeOperation = typeof RitualScopeOperation.Type;

/**
 * One action a Ritual's runs may take unasked: the operation, its exact target (a quest's id or title, or a setting's
 * name), and its exact new value (the new title, or the setting's value as JSON) where the operation has one.
 */
export const RitualScopeEntry = Schema.Struct({
  operation: RitualScopeOperation,
  payload: Schema.NullOr(Schema.String.check(Schema.isMaxLength(2000))),
  target: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
});
export type RitualScopeEntry = typeof RitualScopeEntry.Type;

/** A Ritual's reviewed scope: empty by default, set and revoked by the owner in the Ritual's form. */
export const RitualScope = Schema.Array(RitualScopeEntry).check(Schema.isMaxLength(20));
export type RitualScope = typeof RitualScope.Type;

const RitualTitle = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80));
const RitualInstruction = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100_000));
/** The Companions tried in order after the primary one fails a run. */
const Fallbacks = Schema.Array(RitualCompanion).check(Schema.isMaxLength(5));

/** A Ritual with everything its form edits. */
export const Ritual = Schema.Struct({
  fallbacks: Fallbacks,
  id: RitualId,
  instruction: RitualInstruction,
  isOn: Schema.Boolean,
  /** Whether the realm it runs in is archived, which keeps it off until the realm is restored. */
  isRealmArchived: Schema.Boolean,
  lastRunAt: Schema.NullOr(Schema.Number),
  lastRunState: Schema.NullOr(RitualRunState),
  missionId: MissionId,
  nextRunAt: Schema.NullOr(Schema.Number),
  primary: RitualCompanion,
  schedule: RitualSchedule,
  /** What its runs may do unasked beyond the sandbox; empty unless the owner set it. */
  scope: RitualScope,
  /** The quest's top thread, where each run happens. */
  threadId: ThreadId,
  title: RitualTitle,
});
export type Ritual = typeof Ritual.Type;

/** Creates a Ritual and the quest its runs happen in; nothing runs until it is due or run by hand. */
export const CreateRitual = Schema.TaggedStruct("CreateRitual", {
  fallbacks: Fallbacks,
  instruction: RitualInstruction,
  primary: RitualCompanion,
  /** The name and crest for a folder that is not a realm yet, as when starting a quest. */
  realm: Schema.optionalKey(
    Schema.Struct({
      crest: Schema.NullOr(Crest),
      name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80)),
    }),
  ),
  requestId: RequestId,
  schedule: RitualSchedule,
  /** The owner's reviewed scope; left out, it is empty. */
  scope: Schema.optionalKey(RitualScope),
  title: RitualTitle,
  /** An existing folder, or null for the quest's scratch folder. */
  workspacePath: Schema.NullOr(Schema.String),
});
/** Replaces a Ritual's fields; a change applies to the next run. */
export const UpdateRitual = Schema.TaggedStruct("UpdateRitual", {
  fallbacks: Fallbacks,
  instruction: RitualInstruction,
  isOn: Schema.Boolean,
  primary: RitualCompanion,
  ritualId: RitualId,
  schedule: RitualSchedule,
  /** The owner's reviewed scope, replacing the current one; left out, it is kept; empty revokes it. */
  scope: Schema.optionalKey(RitualScope),
  title: RitualTitle,
});
/** Runs a Ritual now, whatever its schedule and switch. */
export const RunRitual = Schema.TaggedStruct("RunRitual", { ritualId: RitualId });
/** Deletes a Ritual; its quest stays, as an ordinary quest. */
export const DeleteRitual = Schema.TaggedStruct("DeleteRitual", { ritualId: RitualId });
/** Lists every Ritual, the latest first; they are not among the quests. */
export const ListRituals = Schema.TaggedStruct("ListRituals", {});
/** Reads the Ritual of a quest, or null when it is not a Ritual's. */
export const ReadRitual = Schema.TaggedStruct("ReadRitual", { missionId: MissionId });

/** A created Ritual's identifiers. */
export const CreateRitualResult = Schema.Struct({ missionId: MissionId, ritualId: RitualId, threadId: ThreadId });
export type CreateRitualResult = typeof CreateRitualResult.Type;
