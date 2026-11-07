import type { AccountId, AccountStatus, HarnessInfo, HarnessList, HarnessName } from "@openmission/contracts";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { ServiceClient } from "./client";
import { harnessLabels } from "./formatting";
import { styles } from "./styles";

/** What a sign-in state says next to an account. */
const signInLabels = {
  SignedIn: "Signed in",
  SignedOut: "Signed out",
  Unknown: "Sign-in unknown",
} as const satisfies Record<AccountStatus["signIn"], string>;

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
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={styles.body}>{account.label}</Text>
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
    <View style={styles.settings}>
      <Text style={styles.label}>
        {harnessLabels[harness.name]}
        {harness.version === null ? "" : ` · ${harness.version}`}
      </Text>
      {harness.problem !== null ? (
        <Text style={styles.error}>{harness.problem}</Text>
      ) : (
        <>
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
              style={[styles.input, styles.flex]}
              value={label}
            />
            <Pressable accessibilityRole="button" onPress={add}>
              <Text style={styles.link}>Add account</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

/**
 * Each harness's accounts: the computer's own sign-in and those added here, each signed in through the
 * harness's own sign-in in a Terminal window; OpenMission never sees the credentials (provider-accounts).
 */
export function AccountsSection({
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
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={styles.settings}>
      <View style={styles.header}>
        <Text style={[styles.label, styles.flex]}>Harnesses and accounts</Text>
        <Pressable accessibilityRole="button" onPress={onRefresh}>
          <Text style={styles.link}>Refresh</Text>
        </Pressable>
      </View>
      <Text style={styles.muted}>
        Each account keeps its own sign-in and conversations. Threads use the account chosen when they start.
      </Text>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {harnesses === null ? (
        <Text style={styles.muted}>Asking each harness who is signed in…</Text>
      ) : (
        harnesses.harnesses.map((harness) => (
          <HarnessAccounts
            client={client}
            harness={harness}
            key={harness.name}
            onChanged={onChanged}
            onError={setError}
          />
        ))
      )}
    </View>
  );
}
