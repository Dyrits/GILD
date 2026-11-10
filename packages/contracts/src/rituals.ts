import { Schema } from "effect";
import { Crest } from "./crest.ts";
import { HarnessName } from "./harnesses.ts";
import { AccountId, MissionId, RitualId, ThreadId } from "./ids.ts";
import { EffortChoice, ModelChoice, RequestId } from "./records.ts";
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
  lastRunAt: Schema.NullOr(Schema.Number),
  lastRunState: Schema.NullOr(RitualRunState),
  missionId: MissionId,
  nextRunAt: Schema.NullOr(Schema.Number),
  primary: RitualCompanion,
  schedule: RitualSchedule,
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
