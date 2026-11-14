import type { AccountId, AccountStatus, HarnessInfo, HarnessList, HarnessName } from "@iskios/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { harnessLabels } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, radii, round } from "../foundation/theme";
import { ActionMenu } from "../ui/actionMenu";
import { Button } from "../ui/button";
import { ProviderMark } from "../ui/providerMarks";
import { RowIcon } from "../ui/rowIcons";
import { versionOf } from "./providerRules";

/** What a sign-in state says on an account's badge. */
const signInLabels = {
  SignedIn: "Signed in",
  SignedOut: "Signed out",
  Unknown: "Sign-in unknown",
} as const satisfies Record<AccountStatus["signIn"], string>;

/** A small pill: a dot and a word, green when the thing is fine and quiet otherwise. */
function StatusPill({ isGood, label }: { isGood: boolean; label: string }) {
  return (
    <View style={[local.pill, isGood && local.pillGood]}>
      <View style={[local.pillDot, isGood && local.pillDotGood]} />
      <Text style={[local.pillText, isGood && local.pillTextGood]}>{label}</Text>
    </View>
  );
}

function AccountRow({
  account,
  client,
  harness,
  onChanged,
  onError,
}: {
  account: AccountStatus;
  client: ServiceClient;
  harness: HarnessName;
  onChanged: (list: HarnessList) => void;
  onError: (message: string | null) => void;
}) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  // The new name while renaming; null when not. A harness's own sign-in may be left blank to take the computer's name.
  const [name, setName] = useState<string | null>(null);
  const signIn = () =>
    client.request({ _tag: "SignInAccount", accountId: account.id, harness }).then(
      () => {
        setIsSigningIn(true);
        onError(null);
      },
      (reason) => onError(messageOf(reason)),
    );
  const remove = (accountId: AccountId) =>
    client.request({ _tag: "RemoveAccount", accountId }).then(
      (list) => {
        onChanged(list);
        onError(null);
      },
      (reason) => onError(messageOf(reason)),
    );
  const rename = (label: string) =>
    client
      .request(
        account.id === null
          ? { _tag: "RenameOwnAccount", harness, label }
          : { _tag: "RenameAccount", accountId: account.id, label },
      )
      .then(
        (list) => {
          setName(null);
          onChanged(list);
          onError(null);
        },
        (reason) => onError(messageOf(reason)),
      );
  const accountId = account.id;
  const actions = [
    { label: account.signIn === "SignedIn" ? "Sign in again" : "Sign in", onPress: signIn },
    ...(accountId === null ? [] : [{ label: "Remove", onPress: () => remove(accountId) }]),
  ];
  return (
    <View style={local.account}>
      <RowIcon name="account" tint={colors.textMuted} />
      <View style={local.accountName}>
        {name === null ? (
          <Text numberOfLines={1} style={local.accountNameText}>
            {account.label}
          </Text>
        ) : (
          <TextInput
            accessibilityLabel={`Name of the ${harnessLabels[harness]} account ${account.label}`}
            autoFocus
            maxLength={80}
            onChangeText={setName}
            onSubmitEditing={() => rename(name)}
            placeholder={accountId === null ? "Blank takes the computer's name" : "Name of the account"}
            style={[styles.input, local.renameInput]}
            value={name}
          />
        )}
      </View>
      <Text style={[styles.muted, local.accountDetail]}>
        {isSigningIn
          ? "Finish signing in in the Terminal window, then press Refresh."
          : (account.detail ?? signInLabels[account.signIn])}
      </Text>
      <StatusPill isGood={account.signIn === "SignedIn"} label={signInLabels[account.signIn]} />
      {name === null ? (
        <Pressable accessibilityRole="button" onPress={() => setName(account.label)}>
          <Text style={styles.link}>Rename</Text>
        </Pressable>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            disabled={name.trim() === account.label || (accountId !== null && name.trim() === "")}
            onPress={() => rename(name)}
          >
            <Text style={styles.link}>Save</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setName(null)}>
            <Text style={styles.link}>Cancel</Text>
          </Pressable>
        </>
      )}
      <ActionMenu
        accessibilityLabel={`More for ${harnessLabels[harness]} account ${account.label}`}
        actions={actions}
      />
    </View>
  );
}

/** The foot of a harness's accounts: Add account, which opens a name field in place. */
function AddAccount({
  client,
  harness,
  onChanged,
  onError,
}: {
  client: ServiceClient;
  harness: HarnessName;
  onChanged: (list: HarnessList) => void;
  onError: (message: string | null) => void;
}) {
  // The new account's name while adding; null when not.
  const [label, setLabel] = useState<string | null>(null);
  if (label === null) {
    return (
      <View style={local.addRow}>
        <Button isPrimary={false} label="+ Add account" onPress={() => setLabel("")} />
      </View>
    );
  }
  const add = () =>
    client.request({ _tag: "AddAccount", harness, label }).then(
      (list) => {
        setLabel(null);
        onChanged(list);
        onError(null);
      },
      (reason) => onError(messageOf(reason)),
    );
  return (
    <View style={local.addRow}>
      <TextInput
        accessibilityLabel={`New ${harnessLabels[harness]} account name`}
        autoFocus
        maxLength={80}
        onChangeText={setLabel}
        onSubmitEditing={add}
        placeholder="Name of another account, such as Work"
        style={[styles.input, styles.flex, local.addInput]}
        value={label}
      />
      <Button label="Add account" onPress={add} />
      <Pressable accessibilityRole="button" onPress={() => setLabel(null)}>
        <Text style={styles.link}>Cancel</Text>
      </Pressable>
    </View>
  );
}

/** What a harness's head says beside its name: that it is ready and any update on offer, or what is wrong. */
function HarnessState({ harness, isUpdating }: { harness: HarnessInfo; isUpdating: boolean }) {
  if (isUpdating) return <Text style={styles.muted}>{harness.problem === null ? "Updating…" : "Installing…"}</Text>;
  if (harness.problem !== null) return <StatusPill isGood={false} label="Not ready" />;
  return (
    <>
      <StatusPill isGood label="Ready" />
      {harness.update !== null && <Text style={styles.muted}>Update available · {harness.update}</Text>}
    </>
  );
}

/**
 * One harness and its accounts in one card: its logo, name, version, whether it can run, and Update (or Install when it
 * is missing); then the computer's own sign-in and the accounts added here, each signed in through the harness's own
 * sign-in in a Terminal window, so Iskios never sees the credentials (provider-accounts).
 */
function HarnessCard({
  client,
  harness,
  isBusy,
  isUpdating,
  onChanged,
  onError,
  onUpdate,
}: {
  client: ServiceClient;
  harness: HarnessInfo;
  isBusy: boolean;
  isUpdating: boolean;
  onChanged: (list: HarnessList) => void;
  onError: (message: string | null) => void;
  onUpdate: () => void;
}) {
  const version = versionOf(harness);
  const hasAction = harness.problem !== null || harness.update !== null;
  return (
    <View style={local.card}>
      <View style={local.head}>
        <ProviderMark harness={harness.name} size={40} />
        <Text style={local.name}>{harnessLabels[harness.name]}</Text>
        {version !== null && (
          <View style={local.version}>
            <Text style={local.versionText}>{version}</Text>
          </View>
        )}
        <View style={local.state}>
          <HarnessState harness={harness} isUpdating={isUpdating} />
        </View>
        {hasAction && !isUpdating && (
          <Button isDisabled={isBusy} label={harness.problem === null ? "Update" : "Install"} onPress={onUpdate} />
        )}
      </View>
      {harness.problem !== null ? (
        <Text style={[styles.error, local.problem]}>{harness.problem}</Text>
      ) : (
        <View style={local.accounts}>
          {harness.accounts.map((account) => (
            <AccountRow
              account={account}
              client={client}
              harness={harness.name}
              key={account.id ?? "own"}
              onChanged={onChanged}
              onError={onError}
            />
          ))}
          <AddAccount client={client} harness={harness.name} onChanged={onChanged} onError={onError} />
        </View>
      )}
    </View>
  );
}

/**
 * The Workshop's Providers section: a card for each harness holding its version, its update, and its accounts (the
 * Harnesses and Accounts cards, merged). Refresh asks each harness again; missing harnesses offer Install, and
 * installed ones with a newer version offer Update.
 */
export function ProvidersSection({
  client,
  harnesses,
  onChanged,
  onRefresh,
}: {
  client: ServiceClient;
  harnesses: HarnessList | null;
  onChanged: (list: HarnessList) => void;
  onRefresh: () => void;
}) {
  const [updating, setUpdating] = useState<HarnessName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const update = (harness: HarnessInfo) => {
    if (updating !== null) return;
    setUpdating(harness.name);
    setError(null);
    return client
      .request({ _tag: harness.problem === null ? "UpdateHarness" : "InstallHarness", harness: harness.name })
      .then(
        (list) => {
          setUpdating(null);
          onChanged(list);
        },
        (reason: Error) => {
          setUpdating(null);
          setError(reason.message);
        },
      );
  };
  return (
    <>
      <View style={local.intro}>
        <Text style={[styles.muted, styles.flex]}>
          Each account keeps its own sign-in and conversations. Quests and side-quests use the account chosen when they
          start.
        </Text>
        <Pressable accessibilityRole="button" onPress={onRefresh}>
          <Text style={styles.link}>Refresh</Text>
        </Pressable>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {harnesses === null ? (
        <Text style={styles.muted}>Asking each harness who is signed in…</Text>
      ) : (
        harnesses.harnesses.map((harness) => (
          <HarnessCard
            client={client}
            harness={harness}
            isBusy={updating !== null}
            isUpdating={updating === harness.name}
            key={harness.name}
            onChanged={onChanged}
            onError={setError}
            onUpdate={() => update(harness)}
          />
        ))
      )}
    </>
  );
}

const local = StyleSheet.create({
  account: { alignItems: "center", flexDirection: "row", gap: 14, minHeight: 36 },
  accountDetail: { flex: 1, minWidth: 0 },
  // Every row's name takes the same width, so the details line up down a card; a long name is cut.
  accountName: { flexBasis: 140, flexShrink: 1, minWidth: 0 },
  accountNameText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "700" },
  accounts: { borderColor: colors.edge, borderTopWidth: 1, gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  addInput: { minWidth: 180 },
  addRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 4 },
  card: { ...outline, ...round, backgroundColor: colors.canvas, overflow: "hidden" },
  head: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 14, padding: 14 },
  intro: { alignItems: "flex-start", flexDirection: "row", gap: 16 },
  name: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
  pill: {
    alignItems: "center",
    backgroundColor: colors.controlActive,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillDot: { backgroundColor: colors.textMuted, borderRadius: radii.pill, height: 6, width: 6 },
  pillDotGood: { backgroundColor: colors.successText },
  pillGood: { backgroundColor: colors.successSoft },
  pillText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "600" },
  pillTextGood: { color: colors.successText },
  problem: { paddingBottom: 14, paddingHorizontal: 16 },
  renameInput: { fontWeight: "700" },
  // The state takes the room between the name and the button, so Update stays at the card's right end.
  state: { alignItems: "center", flexDirection: "row", flexGrow: 1, flexShrink: 1, gap: 12 },
  version: {
    backgroundColor: colors.controlActive,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  versionText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "600" },
});
