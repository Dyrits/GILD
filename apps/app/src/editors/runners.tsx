import type { AccountId, EffortChoice, HarnessList, HarnessName, ModelChoice } from "@iskios/contracts";
import { type ComponentProps, type ReactElement, useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { harnessLabels, modelLabelOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { Choice, Menu, Steps } from "../ui/pickers";
import { harnessNames, harnessOfAccount } from "./accountModels";
import { CompanionBody } from "./companionBody";
import { CompanionPicker } from "./companionPicker";
import type { PresetChoice } from "./presets";
import { effortFor, effortsOf, useModelEfforts } from "./useModelEfforts";

/** What a thread runs on: its harness, provider account (null for the computer's own sign-in), model, and effort. */
export interface Runner {
  readonly accountId: AccountId | null;
  readonly effort: EffortChoice;
  readonly harness: HarnessName;
  readonly model: ModelChoice;
}

/** What every screen of one host connection shows of the harnesses: one list, so a change made anywhere reaches all. */
interface HarnessStore {
  data: HarnessList | null;
  error: string | null;
  /** Counts the lists a request returned, so a read that began before one cannot put an older list back. */
  generation: number;
  /** The read being waited on, shared by every screen that asks while it runs. */
  inflight: Promise<void> | null;
  readonly listeners: Set<() => void>;
}

const harnessStores = new WeakMap<ServiceClient, HarnessStore>();

const storeOf = (client: ServiceClient) => {
  const existing = harnessStores.get(client);
  if (existing !== undefined) return existing;
  const made: HarnessStore = { data: null, error: null, generation: 0, inflight: null, listeners: new Set() };
  harnessStores.set(client, made);
  return made;
};

const publish = (store: HarnessStore, change: Partial<Pick<HarnessStore, "data" | "error">>) => {
  Object.assign(store, change);
  for (const listener of store.listeners) listener();
};

/**
 * The harnesses with their accounts and models, read when a screen shows them and again on `refresh`: reading them
 * asks each harness's own tool, too slow to repeat on every change. The list is shared by every screen of the host
 * connection, so renaming or adding an account in Settings shows in the pickers at once, and `setData` publishes a
 * list a request returned.
 */
export function useHarnesses(client: ServiceClient) {
  const store = storeOf(client);
  const [, setVersion] = useState(0);
  const refresh = useCallback(() => {
    const current = storeOf(client);
    if (current.inflight !== null) return current.inflight;
    const generation = current.generation;
    const read = client.request({ _tag: "ListHarnesses" }).then(
      (value) => {
        if (generation === current.generation) publish(current, { data: value, error: null });
      },
      (reason) => publish(current, { error: messageOf(reason) }),
    );
    current.inflight = read.finally(() => {
      current.inflight = null;
    });
    return current.inflight;
  }, [client]);
  const setData = useCallback(
    (value: HarnessList) => {
      const current = storeOf(client);
      current.generation += 1;
      publish(current, { data: value, error: null });
    },
    [client],
  );
  useEffect(() => {
    const current = storeOf(client);
    const listener = () => setVersion((version) => version + 1);
    current.listeners.add(listener);
    // Each screen asks again when it shows, as before; what is already known shows meanwhile.
    refresh();
    return () => void current.listeners.delete(listener);
  }, [client, refresh]);
  return { data: store.data, error: store.error, refresh, setData };
}

/** The model list of a harness's account, with the chosen model kept in it when the list no longer holds it. */
const modelIdsOf = (models: ReadonlyArray<{ id: string }>, model: ModelChoice) => {
  const ids = models.map((option) => option.id);
  return ids.includes(model) ? ids : [...ids, model];
};

/**
 * Pickers for a runner: harness, account when the harness has more than one, model, and effort. Choosing
 * another harness takes its own sign-in and default model, as the service does when they are left out.
 */
export function RunnerPickers({
  client,
  dockRank,
  extra,
  harnesses,
  isAccountShown = true,
  isCompact,
  isIskios = false,
  isPanel = false,
  onChange,
  panel,
  presetChoice,
  trigger,
  value,
}: {
  /** Asks the provider for a model's effort levels when its model list does not give them (OpenCode); without it, none are offered there. */
  client?: ServiceClient;
  /** Which Companion button the window's Companion tab shows when none was pressed: the lowest rank, else the latest. */
  dockRank?: number;
  /** The Companions tab's fold for what belongs to the thread alone; see `CompanionPickerProps`. */
  extra?: ReactElement;
  harnesses: HarnessList | null;
  /** Whether the account can be chosen; Settings' defaults have none. */
  isAccountShown?: boolean;
  /** Compact underlined words, as in a composer; named fields otherwise. */
  isCompact: boolean;
  /** Iskios's own Companion: the Companions tab marks it with ✦. */
  isIskios?: boolean;
  /** The picker's own content, as drawn in a fold of the Companions tab; `isCompact` is then ignored. */
  isPanel?: boolean;
  onChange: (runner: Runner) => void;
  /** The Companions tab's own content in place of its folds; see `CompanionPickerProps`. */
  panel?: ReactElement;
  /** The presets the Companions tab offers in a card above the Companion; see `CompanionPickerProps`. */
  presetChoice?: PresetChoice | null;
  /** Another control in place of a composer's runner button; see `CompanionPicker`. */
  trigger?: ComponentProps<typeof CompanionPicker>["trigger"];
  value: Runner;
}) {
  const harnessInfo = harnesses?.harnesses.find((candidate) => candidate.name === value.harness);
  // The harness as the chosen account sees it: its models are that account's own.
  const harness = harnessOfAccount(harnessInfo, value.accountId);
  const models = harness?.models ?? [];
  const accounts = harnessInfo?.accounts ?? [];
  const accountIds = accounts.map((account) => account.id);
  const harnessLabel = (name: HarnessName) => {
    const problem = harnesses?.harnesses.find((candidate) => candidate.name === name)?.problem ?? null;
    return problem === null ? harnessLabels[name] : `${harnessLabels[name]} (not installed)`;
  };
  const infoOf = (name: HarnessName, accountId: AccountId | null) =>
    harnessOfAccount(
      harnesses?.harnesses.find((candidate) => candidate.name === name),
      accountId,
    );
  const chooseHarness = (harnessName: HarnessName) => {
    if (harnessName === value.harness) return onChange(value);
    const next = infoOf(harnessName, null);
    // The harness's first listed model; "default" only while its list is not read yet.
    const model = next?.models[0]?.id ?? "default";
    onChange({ accountId: null, effort: effortFor(next, model, value.effort), harness: harnessName, model });
  };
  // A model of an account's tab, which may be another harness or account: that harness with that sign-in, the chosen model, and the effort kept when the model offers it.
  const chooseCompanion = (harnessName: HarnessName, accountId: AccountId | null, model: ModelChoice) =>
    onChange({
      accountId,
      effort: effortFor(infoOf(harnessName, accountId), model, value.effort),
      harness: harnessName,
      model,
    });
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
  const modelOptions = modelIdsOf(models, value.model);
  if (isCompact || isPanel) {
    const picker = {
      accountId: value.accountId,
      effort: value.effort,
      effortOptions,
      harness: value.harness,
      harnesses,
      isAccountShown,
      model: value.model,
      onEffort: (effort: EffortChoice) => onChange({ ...value, effort }),
      onModel: chooseCompanion,
      // A preset must never fall back to a primary-only change.
      ...(presetChoice == null ? {} : { presetChoice }),
    };
    // In a fold of the Companions tab, the picker's own content; in a composer, one button for the whole runner,
    // which opens that tab with harness tabs, a model search, and effort.
    if (isPanel) return <CompanionBody {...picker} />;
    return (
      <CompanionPicker
        {...(dockRank === undefined ? {} : { rank: dockRank })}
        {...(extra === undefined ? {} : { extra })}
        {...(panel === undefined ? {} : { panel })}
        {...(isIskios ? { isIskios } : {})}
        {...(trigger === undefined ? {} : { trigger })}
        {...picker}
      />
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
