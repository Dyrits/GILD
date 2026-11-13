import type { BackupCompanion, EffortChoice, HarnessName, ModelChoice, Settings, TierName } from "@iskios/contracts";
import { type Runner, runnerOf } from "../harness/index.ts";

/**
 * The Companion a quest or Ritual the Guildmaster makes starts on: the chosen tier's when the owner set it, else the Settings default (never the Guildmaster's own cheap one), with anything the Guildmaster named itself on top.
 */
export const companionOf = (
  settings: Settings,
  tier: TierName | undefined,
  choice: Parameters<typeof runnerOf>[1],
): Runner => {
  const base: Runner = {
    accountId: null,
    effort: settings.defaultEffort,
    harness: settings.defaultHarness,
    model: settings.defaultModel,
  };
  return runnerOf(tierPresetOf(settings, tier) ?? base, choice);
};

/** The preset a tier names, null when none is named or the owner left it unset. */
export const tierPresetOf = (settings: Settings, tier: TierName | undefined) =>
  tier === undefined ? null : settings.tiers[tier];

/** The backup Companions a quest or Ritual on a tier starts with: the tier's own, none when the owner set none. */
export const backupsOf = (settings: Settings, tier: TierName | undefined): ReadonlyArray<BackupCompanion> =>
  tierPresetOf(settings, tier)?.backups ?? [];

/** What a Ritual Iskios creates starts with: its Companion, and its tier's backups as fallbacks unless Iskios named a Companion of its own. */
export const ritualStartOf = (
  settings: Settings,
  choice: {
    effort?: EffortChoice | undefined;
    harness?: HarnessName | undefined;
    model?: ModelChoice | undefined;
    tier?: TierName | undefined;
  },
) => ({
  companion: companionOf(settings, choice.tier, {
    effort: choice.effort,
    harness: choice.harness,
    model: choice.model,
  }),
  fallbacks:
    choice.effort === undefined && choice.harness === undefined && choice.model === undefined
      ? backupsOf(settings, choice.tier)
      : [],
});

/** The Companion as the Guildmaster tells the owner: the tier when one was chosen, the harness, model, and effort. */
export const companionLineOf = (tier: TierName | undefined, runner: Runner) =>
  `${tier === undefined ? "" : `${tier}: `}${runner.harness}, model ${runner.model}, effort ${runner.effort}`;

/** The note an approval question adds when a Ritual on a tier brings fallback Companions, empty when it brings none. */
export const fallbackNoteOf = (fallbacks: ReadonlyArray<BackupCompanion>, tier: TierName | undefined) =>
  fallbacks.length === 0 ? "" : `, with ${fallbacks.length} fallback${fallbacks.length === 1 ? "" : "s"} from ${tier}`;
