import { describe, expect, it } from "vitest";
import { creationStepOf, initialRecoveryFlowOf, transitionRecovery } from "../../src/realms/realmRecoveryFlow";

describe("confirming realm recovery", () => {
  it("defaults Restore to old values and Start afresh to proposed values", () => {
    const initial = initialRecoveryFlowOf(true);
    expect(
      transitionRecovery(initial, { _tag: "Choose", hasDifferences: true, shouldStartAfresh: false }),
    ).toMatchObject({
      picks: { crest: "old", name: "old" },
      step: "comparison",
    });
    expect(
      transitionRecovery(initial, { _tag: "Choose", hasDifferences: true, shouldStartAfresh: true }),
    ).toMatchObject({
      picks: { crest: "proposed", name: "proposed" },
      step: "comparison",
    });
  });
  it("skips equal comparisons but still requires the wipe confirmation", () => {
    const initial = initialRecoveryFlowOf(true);
    const restore = transitionRecovery(initial, { _tag: "Choose", hasDifferences: false, shouldStartAfresh: false });
    const fresh = transitionRecovery(initial, { _tag: "Choose", hasDifferences: false, shouldStartAfresh: true });
    expect(restore.step).toBe("review");
    expect(transitionRecovery(restore, { _tag: "Review", hasNameCollision: false, isWipeConfirmed: false }).step).toBe(
      "save",
    );
    expect(transitionRecovery(fresh, { _tag: "Review", hasNameCollision: false, isWipeConfirmed: false }).step).toBe(
      "wipe",
    );
  });
  it("puts duplicate-name acknowledgement before the final wipe", () => {
    const fresh = transitionRecovery(initialRecoveryFlowOf(true), {
      _tag: "Choose",
      hasDifferences: false,
      shouldStartAfresh: true,
    });
    const duplicate = transitionRecovery(fresh, { _tag: "Review", hasNameCollision: true, isWipeConfirmed: false });
    expect(duplicate.step).toBe("duplicate");
    const confirmed = transitionRecovery(duplicate, { _tag: "ConfirmName" });
    const wipe = transitionRecovery(confirmed, { _tag: "Review", hasNameCollision: true, isWipeConfirmed: false });
    expect(wipe.step).toBe("wipe");
    expect(transitionRecovery(wipe, { _tag: "Review", hasNameCollision: true, isWipeConfirmed: true }).step).toBe(
      "save",
    );
  });
  it("keeps independent field picks and clears name acknowledgement on a new choice", () => {
    const selected = transitionRecovery(initialRecoveryFlowOf(true), {
      _tag: "Pick",
      field: "name",
      value: "proposed",
    });
    expect(selected.picks).toEqual({ crest: "old", name: "proposed" });
    expect(selected.hasConfirmedName).toBe(false);
  });
  it("cannot reach a save after cancellation", () => {
    const cancelled = transitionRecovery(initialRecoveryFlowOf(true), { _tag: "Cancel" });
    expect(transitionRecovery(cancelled, { _tag: "Review", hasNameCollision: false, isWipeConfirmed: true }).step).toBe(
      "cancelled",
    );
  });
  it("restarts a stale preview without carrying a prior wipe or name confirmation", () => {
    const old = transitionRecovery(initialRecoveryFlowOf(true), { _tag: "ConfirmName" });
    expect(transitionRecovery(old, { _tag: "Retry", hasProposal: true })).toEqual(initialRecoveryFlowOf(true));
    expect(initialRecoveryFlowOf(false).step).toBe("restore");
  });
});

describe("choosing a realm creation path", () => {
  it("offers recovery before duplicate-name handling, and never creates the same folder twice", () => {
    expect(creationStepOf({ hasArchivedRealm: true, hasDuplicateName: true, shouldAllowDuplicateName: false })).toBe(
      "recover",
    );
    expect(creationStepOf({ hasArchivedRealm: false, hasDuplicateName: true, shouldAllowDuplicateName: false })).toBe(
      "duplicate",
    );
    expect(creationStepOf({ hasArchivedRealm: false, hasDuplicateName: true, shouldAllowDuplicateName: true })).toBe(
      "create",
    );
  });
});
