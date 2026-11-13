import { Effect, Schema } from "effect";
import { EffortChoice, HarnessName } from "./harnesses.ts";
import { AccountId } from "./ids.ts";

/**
 * The model a thread runs with, by the identifier its harness takes, such as "claude-opus-5-5" for Claude Code or
 * "gpt-6.1-sol" for Codex; "default" is the harness's own, kept for threads that began before models were always
 * chosen and no longer offered (provider-accounts, Models).
 */
export const ModelChoice = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200));
export type ModelChoice = typeof ModelChoice.Type;

/** One backup Companion a thread falls back to: a harness, its account, a model, and an effort (thread-panel, Backups). */
export const BackupCompanion = Schema.Struct({
  /** The provider account, or null for the harness's own sign-in on this computer. */
  accountId: Schema.NullOr(AccountId),
  effort: EffortChoice,
  harness: HarnessName,
  model: ModelChoice,
});
export type BackupCompanion = typeof BackupCompanion.Type;

/** The most backup Companions a thread, a preset, or the Workshop may hold. */
export const maxBackups = 5;

/** A thread's, a preset's, or the Workshop's backup Companions, in the order a failed turn falls back through them. */
export const BackupCompanions = Schema.Array(BackupCompanion).check(Schema.isMaxLength(maxBackups));

/**
 * A Companion preset, the Workshop's tier that Iskios picks by how demanding a request is: a Companion (harness, account, model, and effort) and the backup Companions that go with it (companion-presets, quest coordination).
 */
export const Tier = Schema.Struct({
  accountId: Schema.NullOr(AccountId),
  backups: BackupCompanions,
  effort: EffortChoice,
  harness: HarnessName,
  model: ModelChoice,
});
export type Tier = typeof Tier.Type;

/** A preset as stored, where one saved before presets had backups reads with none; requests stay strict, so an older client that sends none is refused. */
export const SavedTier = Tier.mapFields((fields) => ({
  ...fields,
  backups: BackupCompanions.pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
}));

/** The three tiers the Guildmaster picks from by how complex a request is; each is optional. */
export const TierName = Schema.Literals(["Light", "Balanced", "Heavy"]);
export type TierName = typeof TierName.Type;
