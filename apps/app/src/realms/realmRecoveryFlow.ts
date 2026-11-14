import type { RecoveryPicks } from "./realmRecovery";

/** The recoverable flow state; only the save step permits a mutation. */
export type RecoveryFlow = {
  step: "choice" | "comparison" | "review" | "duplicate" | "wipe" | "restore" | "save" | "cancelled";
  picks: RecoveryPicks;
  shouldStartAfresh: boolean;
  hasConfirmedName: boolean;
};

/** Events at the confirmation boundary, independent of rendering and network timing. */
export type RecoveryEvent =
  | { _tag: "Choose"; fresh: boolean; hasDifferences: boolean }
  | { _tag: "Pick"; field: keyof RecoveryPicks; value: RecoveryPicks["name"] }
  | { _tag: "Continue" }
  | { _tag: "Review"; hasNameCollision: boolean; isWipeConfirmed: boolean }
  | { _tag: "ConfirmName" }
  | { _tag: "Retry"; hasProposal: boolean }
  | { _tag: "Cancel" };

/** Direct Archive restoration has no proposed appearance; folder reuse first asks which recovery the owner wants. */
export const initialRecoveryFlowOf = (hasProposal: boolean): RecoveryFlow => ({
  hasConfirmedName: false,
  picks: { crest: "old", name: "old" },
  shouldStartAfresh: false,
  step: hasProposal ? "choice" : "restore",
});

/** Keeps comparison, duplicate-name acknowledgement, and the final wipe in their agreed order. */
export const transitionRecovery = (state: RecoveryFlow, event: RecoveryEvent): RecoveryFlow => {
  if (state.step === "cancelled") return state;
  if (event._tag === "Retry") return initialRecoveryFlowOf(event.hasProposal);
  if (event._tag === "Cancel") return { ...state, step: "cancelled" };
  if (event._tag === "Choose")
    return {
      hasConfirmedName: false,
      picks: { crest: event.fresh ? "proposed" : "old", name: event.fresh ? "proposed" : "old" },
      shouldStartAfresh: event.fresh,
      step: event.hasDifferences ? "comparison" : "review",
    };
  if (event._tag === "Pick")
    return {
      ...state,
      hasConfirmedName: false,
      picks: { ...state.picks, [event.field]: event.value },
    };
  if (event._tag === "Continue") return { ...state, step: "review" };
  if (event._tag === "ConfirmName") return { ...state, hasConfirmedName: true, step: "review" };
  return {
    ...state,
    step:
      event.hasNameCollision && !state.hasConfirmedName
        ? "duplicate"
        : state.shouldStartAfresh && !event.isWipeConfirmed
          ? "wipe"
          : "save",
  };
};

/** Recovery takes precedence over name acknowledgement; a matching archived folder is never a new realm. */
export const creationStepOf = (checks: {
  hasArchivedRealm: boolean;
  hasDuplicateName: boolean;
  allowDuplicateName: boolean;
}): "recover" | "duplicate" | "create" =>
  checks.hasArchivedRealm ? "recover" : checks.hasDuplicateName && !checks.allowDuplicateName ? "duplicate" : "create";
