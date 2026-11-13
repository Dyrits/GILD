import { type Settings, type Tier, TierName } from "@iskios/contracts";
import { isSameStack } from "../editors/presets";
import type { Runner } from "../editors/runners";

/** One Companion the proposal card offers: the owner's default, or a tier the owner set in the Workshop. */
export type CompanionChoice = {
  readonly label: string;
  readonly runner: Tier;
};

/**
 * The Companions Iskios's proposal card offers, in order: the default, then each tier set in the Workshop, labelled by
 * the name the tier's model has (quest coordination, CHG-0179). A tier left unset is not offered.
 */
export const companionChoicesOf = (
  settings: Pick<Settings, "backups" | "defaultEffort" | "defaultHarness" | "defaultModel" | "tiers">,
  labelOf: (runner: Runner) => string,
): ReadonlyArray<CompanionChoice> => [
  {
    label: "Default",
    runner: {
      accountId: null,
      backups: settings.backups,
      effort: settings.defaultEffort,
      harness: settings.defaultHarness,
      model: settings.defaultModel,
    },
  },
  ...TierName.literals.flatMap((name) => {
    const tier = settings.tiers[name];
    return tier === null ? [] : [{ label: `${name} · ${labelOf(tier)}`, runner: tier }];
  }),
];

/** The first choice whose complete stack matches, or none for a customized one. */
export const selectedChoiceOf = (choices: ReadonlyArray<CompanionChoice>, runner: Tier) =>
  choices.find((choice) => isSameStack(choice.runner, runner)) ?? null;

/** Whether the owner has set any tier (the default always comes first); with none, the card offers no Companion row. */
export const hasTiers = (choices: ReadonlyArray<CompanionChoice>) => choices.length > 1;
