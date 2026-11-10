import type { AccountId, AccountStatus, HarnessInfo, HarnessList, HarnessName } from "@gild/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ServiceClient } from "./client";
import { harnessLabels } from "./formatting";
import { GoldButton } from "./parchment";
import { ProviderMark } from "./providerMarks";
import { SettingsCard, SettingsRule } from "./settingsParts";
import { styles } from "./styles";
import { colors, fontSizes, fonts } from "./theme";

/** What a sign-in state says next to an account. */
const signInLabels = {
  SignedIn: "Signed in",
  SignedOut: "Signed out",
  Unknown: "Sign-in unknown",
} as const satisfies Record<AccountStatus["signIn"], string>;

/** A harness as its provider's logo and its name with the installed version, as titles and rows both show it. */
function HarnessTitle({ harness }: { harness: HarnessInfo }) {
  return (
    <View style={local.name}>
      <ProviderMark harness={harness.name} size={40} />
      <Text style={local.nameText}>
        {harnessLabels[harness.name]}
        {harness.version === null ? "" : ` · ${harness.version}`}
      </Text>
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
  const status = [signInLabels[account.signIn], account.detail].filter((part) => part !== null).join(" · ");
  const signIn = () =>
    client.request({ _tag: "SignInAccount", accountId: account.id, harness }).then(
      () => {
        setIsSigningIn(true);
        onError(null);
      },
      (reason: Error) => onError(reason.message),
    );
  const remove = (accountId: AccountId) =>
    client.request({ _tag: "RemoveAccount", accountId }).then(
      (list) => {
        onChanged(list);
        onError(null);
      },
      (reason: Error) => onError(reason.message),
    );
  return (
    <View style={local.account}>
      <View style={styles.flex}>
        <Text style={local.accountName}>{account.label}</Text>
        <Text style={styles.muted}>
          {isSigningIn ? "Finish signing in in the Terminal window, then press Refresh." : status}
        </Text>
      </View>
      <Pressable accessibilityRole="button" onPress={signIn}>
        <Text style={styles.link}>{account.signIn === "SignedIn" ? "Sign in again" : "Sign in"}</Text>
      </Pressable>
      {account.id !== null && (
        <Pressable accessibilityRole="button" onPress={() => account.id !== null && remove(account.id)}>
          <Text style={styles.link}>Remove</Text>
        </Pressable>
      )}
    </View>
  );
}

function HarnessAccounts({
  client,
  harness,
  onChanged,
  onError,
}: {
  client: ServiceClient;
  harness: HarnessInfo;
  onChanged: (list: HarnessList) => void;
  onError: (message: string | null) => void;
}) {
  const [label, setLabel] = useState("");
  const add = () =>
    client.request({ _tag: "AddAccount", harness: harness.name, label }).then(
      (list) => {
        setLabel("");
        onChanged(list);
        onError(null);
      },
      (reason: Error) => onError(reason.message),
    );
  return (
    <View style={local.block}>
      <HarnessTitle harness={harness} />
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
        <View style={styles.inlineRow}>
          <TextInput
            accessibilityLabel={`New ${harnessLabels[harness.name]} account name`}
            onChangeText={setLabel}
            onSubmitEditing={add}
            placeholder="Name of another account, such as Work"
            style={[styles.input, styles.flex, local.addInput]}
            value={label}
          />
          <GoldButton label="Add account" onPress={add} />
        </View>
      </View>
    </View>
  );
}

/** What a harness row says beside its name: its problem, an update on offer, or that it is ready. */
function HarnessState({
  harness,
  isUpdating,
  onUpdate,
}: {
  harness: HarnessInfo;
  isUpdating: boolean;
  onUpdate: () => void;
}) {
  if (harness.problem !== null) return <Text style={[styles.error, styles.flex]}>{harness.problem}</Text>;
  if (isUpdating) return <Text style={styles.muted}>Updating…</Text>;
  if (harness.update === null) return <Text style={styles.muted}>Ready</Text>;
  return (
    <>
      <Text style={styles.muted}>Ready · {harness.update} is available</Text>
      <GoldButton label="Update" onPress={onUpdate} />
    </>
  );
}

/**
 * The installed harnesses, each with its logo, version, and whether it can run; Refresh asks each one again.
 * A harness with a newer version on offer has Update, which runs the harness's own update command.
 */
export function HarnessesCard({
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
  const update = (harness: HarnessName) => {
    setUpdating(harness);
    setError(null);
    return client.request({ _tag: "UpdateHarness", harness }).then(
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
    <SettingsCard
      icon="code"
      title="Harnesses"
      trailing={
        <Pressable accessibilityRole="button" onPress={onRefresh}>
          <Text style={styles.link}>Refresh</Text>
        </Pressable>
      }
    >
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {harnesses === null ? (
        <Text style={styles.muted}>Asking each harness who is signed in…</Text>
      ) : (
        harnesses.harnesses.map((harness, index) => (
          <View key={harness.name} style={styles.settings}>
            {index > 0 && <SettingsRule />}
            <View style={local.harness}>
              <HarnessTitle harness={harness} />
              <HarnessState
                harness={harness}
                isUpdating={updating === harness.name}
                onUpdate={() => update(harness.name)}
              />
            </View>
          </View>
        ))
      )}
    </SettingsCard>
  );
}

/**
 * Each harness's accounts: the computer's own sign-in and those added here, each signed in through the
 * harness's own sign-in in a Terminal window; Gild never sees the credentials (provider-accounts).
 */
export function AccountsCard({
  client,
  harnesses,
  onChanged,
}: {
  client: ServiceClient;
  harnesses: HarnessList | null;
  onChanged: (list: HarnessList) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const ready = harnesses?.harnesses.filter((harness) => harness.problem === null) ?? [];
  return (
    <SettingsCard icon="people" title="Accounts">
      <Text style={styles.muted}>
        Each account keeps its own sign-in and conversations. Quests and side-quests use the account chosen when they
        start.
      </Text>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {harnesses !== null && ready.length === 0 && <Text style={styles.muted}>No harness is ready to sign in.</Text>}
      {ready.map((harness, index) => (
        <View key={harness.name} style={styles.settings}>
          {index > 0 && <SettingsRule />}
          <HarnessAccounts client={client} harness={harness} onChanged={onChanged} onError={setError} />
        </View>
      ))}
    </SettingsCard>
  );
}

const local = StyleSheet.create({
  account: { alignItems: "center", flexDirection: "row", gap: 16 },
  accountName: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "700" },
  accounts: { flex: 1, gap: 10, minWidth: 260 },
  addInput: { minWidth: 180 },
  block: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 16 },
  harness: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 16 },
  name: { alignItems: "center", flexDirection: "row", gap: 14, minWidth: 220 },
  nameText: {
    color: colors.text,
    fontFamily: fonts.hand,
    fontSize: fontSizes.lg,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
