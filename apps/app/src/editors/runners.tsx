import type { AccountId, EffortChoice, HarnessInfo, HarnessList, HarnessName, ModelChoice } from "@iskios/contracts";
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { effortLabel, harnessLabels, modelLabelOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { Choice, Menu, Steps } from "../ui/pickers";

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
        (reason) => setError(messageOf(reason)),
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
  const ids = harness?.models.map((option) => option.id) ?? [];
  return ids.includes(model) ? ids : [...ids, model];
};

/** The effort levels a harness's model list gives for a model; undefined when the list does not say (OpenCode). */
const listedEffortsOf = (harness: HarnessInfo | undefined, model: ModelChoice) =>
  harness?.models.find((option) => option.id === model)?.efforts;

/**
 * The effort levels of the chosen model: from the harness's model list, or, when the list does not say (OpenCode),
 * asked of the provider each time a model is picked. Empty while unknown or without a client to ask.
 */
function useModelEfforts(client: ServiceClient | undefined, harness: HarnessInfo | undefined, value: Runner) {
  const listed = listedEffortsOf(harness, value.model);
  const [asked, setAsked] = useState<{ key: string; levels: ReadonlyArray<EffortChoice> } | null>(null);
  const key = `${value.harness}:${value.accountId ?? ""}:${value.model}`;
  const shouldAsk = client !== undefined && harness !== undefined && listed === undefined;
  useEffect(() => {
    if (!shouldAsk) return;
    let isCurrent = true;
    client
      .request({ _tag: "ListModelEfforts", accountId: value.accountId, harness: value.harness, model: value.model })
      .then(
        (levels) => {
          if (isCurrent) setAsked({ key, levels });
        },
        () => {
          if (isCurrent) setAsked({ key, levels: [] });
        },
      );
    return () => {
      isCurrent = false;
    };
  }, [client, key, shouldAsk, value.accountId, value.harness, value.model]);
  return listed ?? (asked?.key === key ? asked.levels : []);
}

/**
 * The efforts offered: the model's own default, then the levels its provider gives. The chosen effort stays in the
 * list when the model no longer offers it, so the picker says it.
 */
const effortsOf = (levels: ReadonlyArray<EffortChoice>, effort: EffortChoice): ReadonlyArray<EffortChoice> => {
  const offered = ["default", ...levels];
  return offered.includes(effort) ? offered : [...offered, effort];
};

/**
 * The effort kept when the model changes: the same when the new model's list offers it, else the model's own
 * default, also when its levels are only known once asked (OpenCode).
 */
const effortFor = (harness: HarnessInfo | undefined, model: ModelChoice, effort: EffortChoice): EffortChoice =>
  listedEffortsOf(harness, model)?.includes(effort) === true ? effort : "default";

/**
 * Pickers for a runner: harness, account when the harness has more than one, model, and effort. Choosing
 * another harness takes its own sign-in and default model, as the service does when they are left out.
 */
export function RunnerPickers({
  client,
  harnesses,
  isAccountShown = true,
  isCompact,
  onChange,
  value,
}: {
  /** Asks the provider for a model's effort levels when its model list does not give them (OpenCode); without it, none are offered there. */
  client?: ServiceClient;
  harnesses: HarnessList | null;
  /** Whether the account can be chosen; Settings' defaults have none. */
  isAccountShown?: boolean;
  /** Compact underlined words, as in a composer; named fields otherwise. */
  isCompact: boolean;
  onChange: (runner: Runner) => void;
  value: Runner;
}) {
  const harness = harnesses?.harnesses.find((candidate) => candidate.name === value.harness);
  const models = harness?.models ?? [];
  const accounts = harness?.accounts ?? [];
  const accountIds = accounts.map((account) => account.id);
  const harnessLabel = (name: HarnessName) => {
    const problem = harnesses?.harnesses.find((candidate) => candidate.name === name)?.problem ?? null;
    return problem === null ? harnessLabels[name] : `${harnessLabels[name]} (not installed)`;
  };
  const chooseHarness = (harnessName: HarnessName) => {
    if (harnessName === value.harness) return onChange(value);
    const next = harnesses?.harnesses.find((candidate) => candidate.name === harnessName);
    // The harness's first listed model; "default" only while its list is not read yet.
    const model = next?.models[0]?.id ?? "default";
    onChange({ accountId: null, effort: effortFor(next, model, value.effort), harness: harnessName, model });
  };
  const chooseModel = (model: ModelChoice) =>
    onChange({ ...value, effort: effortFor(harness, model, value.effort), model });
  const effortOptions = effortsOf(useModelEfforts(client, harness, value), value.effort);
  // A model that offers no level of effort has nothing to choose.
  const isEffortChosen = effortOptions.length > 1;
  const accountLabel = (id: AccountId | null) => {
    const account = accounts.find((candidate) => candidate.id === id);
    return account === undefined
      ? "Removed account"
      : account.signIn === "SignedOut"
        ? `${account.label} (signed out)`
        : account.label;
  };
  const accountOptions = accountIds.includes(value.accountId) ? accountIds : [...accountIds, value.accountId];
  const isAccountChosen = isAccountShown && accountIds.length > 1;
  const modelOptions = modelIdsOf(harness, value.model);
  if (isCompact) {
    // In a composer, each picker is one underlined word that opens its list.
    return (
      <>
        <Menu
          accessibilityLabel="Harness"
          label={harnessLabel}
          onChange={chooseHarness}
          options={harnessNames}
          value={value.harness}
        />
        {isAccountChosen && (
          <Menu
            accessibilityLabel="Account"
            label={accountLabel}
            onChange={(accountId: AccountId | null) => onChange({ ...value, accountId })}
            options={accountOptions}
            value={value.accountId}
          />
        )}
        <Menu
          accessibilityLabel="Companion (model)"
          label={(id: ModelChoice) => modelLabelOf(id, models)}
          onChange={chooseModel}
          options={modelOptions}
          value={value.model}
        />
        {isEffortChosen && (
          <Menu
            accessibilityLabel="Effort"
            label={effortLabel}
            onChange={(effort: EffortChoice) => onChange({ ...value, effort })}
            options={effortOptions}
            value={value.effort}
          />
        )}
      </>
    );
  }
  // In a form, each picker is a named field; effort is an ordered scale, so it is a line of stops.
  return (
    <View style={styles.fields}>
      <View style={styles.field}>
        <Text style={styles.fieldName}>Harness</Text>
        <Choice
          accessibilityLabel="Harness"
          label={harnessLabel}
          onChange={chooseHarness}
          options={harnessNames}
          value={value.harness}
        />
      </View>
      {isAccountChosen && (
        <View style={styles.field}>
          <Text style={styles.fieldName}>Account</Text>
          <Menu
            accessibilityLabel="Account"
            isField
            label={accountLabel}
            onChange={(accountId: AccountId | null) => onChange({ ...value, accountId })}
            options={accountOptions}
            value={value.accountId}
          />
        </View>
      )}
      <View style={[styles.field, styles.raised]}>
        <Text style={styles.fieldName}>Companion (model)</Text>
        <Menu
          accessibilityLabel="Companion (model)"
          isField
          label={(id: ModelChoice) => modelLabelOf(id, models)}
          onChange={chooseModel}
          options={modelOptions}
          value={value.model}
        />
      </View>
      {isEffortChosen && (
        <View style={styles.field}>
          <Text style={styles.fieldName}>Effort</Text>
          <Steps
            accessibilityLabel="Effort"
            label={(effort: EffortChoice) => (effort === "default" ? "default" : effort)}
            onChange={(effort: EffortChoice) => onChange({ ...value, effort })}
            options={effortOptions}
            value={value.effort}
          />
        </View>
      )}
    </View>
  );
}
