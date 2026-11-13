import type { AccountId, HarnessInfo, HarnessList, HarnessName, ModelOption } from "@iskios/contracts";

/** The harnesses in the order the pickers list them. */
export const harnessNames: ReadonlyArray<HarnessName> = ["claude", "codex", "opencode"];

/** The models a harness offers one account: that account's own list when the host read it, else the harness's. */
export const modelsOf = (info: HarnessInfo | undefined, accountId: AccountId | null): ReadonlyArray<ModelOption> =>
  info?.accounts.find((account) => account.id === accountId)?.models ?? info?.models ?? [];

/** The harness as one account sees it: its models are that account's. */
export const harnessOfAccount = (
  info: HarnessInfo | undefined,
  accountId: AccountId | null,
): HarnessInfo | undefined => (info === undefined ? undefined : { ...info, models: modelsOf(info, accountId) });

/** One tab of the Companion picker: a harness signed in with one account, and the models it offers there. */
export interface PickerTab {
  readonly accountId: AccountId | null;
  readonly harness: HarnessName;
  readonly label: string;
  readonly models: ReadonlyArray<ModelOption>;
  /** Why nothing can be chosen on this tab, or null. */
  readonly problem: "not installed" | "signed out" | null;
}

const removedLabel = "Removed account";

/**
 * The picker's tabs: each harness once for every account it can sign in with, so two Claude subscriptions are two
 * tabs, each with its own models. Without `isAccountShown` (the Workshop's default Companion, which always runs on the
 * computer's own sign-in) each harness has its own sign-in only. The runner's own account stays a tab when it was
 * removed, so what it runs on is still shown.
 */
export function tabsOf(
  harnesses: HarnessList | null,
  isAccountShown: boolean,
  current: { accountId: AccountId | null; harness: HarnessName },
): ReadonlyArray<PickerTab> {
  return harnessNames.flatMap((harness) => {
    const info = harnesses?.harnesses.find((candidate) => candidate.name === harness);
    const listed = info?.accounts ?? [];
    const accounts = isAccountShown ? listed : listed.filter((account) => account.id === null);
    const tabs = accounts.map((account): PickerTab => {
      const problem = info?.problem != null ? "not installed" : account.signIn === "SignedOut" ? "signed out" : null;
      return {
        accountId: account.id,
        harness,
        label: account.label,
        models: problem === "signed out" ? [] : modelsOf(info, account.id),
        problem,
      };
    });
    // The harness is listed once even when the host has not read its accounts yet.
    if (tabs.length === 0) {
      tabs.push({
        accountId: null,
        harness,
        label: "",
        models: info?.models ?? [],
        problem: info?.problem != null ? "not installed" : null,
      });
    }
    if (harness === current.harness && !tabs.some((tab) => tab.accountId === current.accountId)) {
      tabs.push({ accountId: current.accountId, harness, label: removedLabel, models: [], problem: null });
    }
    return tabs;
  });
}
