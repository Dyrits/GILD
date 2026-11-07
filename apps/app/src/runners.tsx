import {
  type AccountId,
  type EffortChoice,
  EffortChoice as EffortChoices,
  type HarnessInfo,
  type HarnessList,
  type HarnessName,
  type ModelChoice,
} from "@canopy/contracts";
import { useCallback, useEffect, useState } from "react";
import type { ServiceClient } from "./client";
import { Choice, Menu } from "./controls";
import { effortLabel, harnessLabels, modelLabelOf } from "./formatting";

/** What a thread runs on: its harness, provider account (null for the computer's own sign-in), model, and effort. */
export interface Runner {
  readonly accountId: AccountId | null;
  readonly effort: EffortChoice;
  readonly harness: HarnessName;
  readonly model: ModelChoice;
}

/**
 * The harnesses with their accounts and models, read once when shown and again on `refresh`: reading them
 * asks each harness's own tool, too slow to repeat on every change.
 */
export function useHarnesses(client: ServiceClient) {
  const [data, setData] = useState<HarnessList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(
    () =>
      client.request({ _tag: "ListHarnesses" }).then(
        (value) => {
          setData(value);
          setError(null);
        },
        (reason: Error) => setError(reason.message),
      ),
    [client],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { data, error, refresh, setData };
}

const harnessNames: ReadonlyArray<HarnessName> = ["claude", "codex", "opencode"];

/** A harness's model list, with the chosen model kept in it when the harness no longer lists it. */
const modelIdsOf = (harness: HarnessInfo | undefined, model: ModelChoice) => {
  const ids = harness?.models.map((option) => option.id) ?? ["default"];
  return ids.includes(model) ? ids : [...ids, model];
};

/**
 * Pickers for a runner: harness, account when the harness has more than one, model, and effort. Choosing
 * another harness takes its own sign-in and default model, as the service does when they are left out.
 */
export function RunnerPickers({
  harnesses,
  isAccountShown = true,
  isCompact,
  onChange,
  value,
}: {
  harnesses: HarnessList | null;
  /** Whether the account can be chosen; Settings' defaults have none. */
  isAccountShown?: boolean;
  /** Compact pills, as in a composer; chips otherwise. */
  isCompact: boolean;
  onChange: (runner: Runner) => void;
  value: Runner;
}) {
  const harness = harnesses?.harnesses.find((candidate) => candidate.name === value.harness);
  const models = harness?.models ?? [];
  const accounts = harness?.accounts ?? [];
  const accountIds = accounts.map((account) => account.id);
  const Picker = isCompact ? Menu : Choice;
  const ModelPicker = isCompact || modelIdsOf(harness, value.model).length > 8 ? Menu : Choice;
  return (
    <>
      <Picker
        accessibilityLabel="Harness"
        label={(name: HarnessName) => {
          const problem = harnesses?.harnesses.find((candidate) => candidate.name === name)?.problem ?? null;
          return problem === null ? harnessLabels[name] : `${harnessLabels[name]} (not installed)`;
        }}
        onChange={(harnessName: HarnessName) =>
          onChange(
            harnessName === value.harness
              ? value
              : { accountId: null, effort: value.effort, harness: harnessName, model: "default" },
          )
        }
        options={harnessNames}
        value={value.harness}
      />
      {isAccountShown && accountIds.length > 1 && (
        <Picker
          accessibilityLabel="Account"
          label={(id: AccountId | null) => {
            const account = accounts.find((candidate) => candidate.id === id);
            return account === undefined
              ? "Removed account"
              : account.signIn === "SignedOut"
                ? `${account.label} (signed out)`
                : account.label;
          }}
          onChange={(accountId: AccountId | null) => onChange({ ...value, accountId })}
          options={accountIds.includes(value.accountId) ? accountIds : [...accountIds, value.accountId]}
          value={value.accountId}
        />
      )}
      {/* Past a few models, such as OpenCode's, chips would fill the form: a menu lists them. */}
      <ModelPicker
        accessibilityLabel="Model"
        label={(id: ModelChoice) => modelLabelOf(id, models)}
        onChange={(model: ModelChoice) => onChange({ ...value, model })}
        options={modelIdsOf(harness, value.model)}
        value={value.model}
      />
      <Picker
        accessibilityLabel="Effort"
        label={effortLabel}
        onChange={(effort: EffortChoice) => onChange({ ...value, effort })}
        options={EffortChoices.literals}
        value={value.effort}
      />
    </>
  );
}
