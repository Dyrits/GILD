import type { AccountBudget, BudgetLimits } from "@gild/contracts";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { BudgetEditor } from "../editors/budgets";
import { messageOf, type ServiceClient } from "../foundation/client";
import { accountBudgetTextOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { GoldButton } from "../ui/parchment";
import { Choice } from "../ui/pickers";
import { SettingsCard, SettingsRule } from "./settingsParts";

/** How an account's budget is counted: over a period, or as credits bought on a day with no period. */
const kinds = ["Day", "Week", "Month", "Credits"] as const;
type Kind = (typeof kinds)[number];

const kindLabels = {
  Credits: "Credits",
  Day: "Each day",
  Month: "Each month",
  Week: "Each week",
} as const satisfies Record<Kind, string>;

/** Today as `YYYY-MM-DD` in local time. */
const todayOf = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** The day typed as a time on that day, or null when it is not a day. */
const dayTimeOf = (text: string) => {
  const parsed = new Date(`${text.trim()}T12:00:00`).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

/** One account: what it used, its limits over a period or as credits, and Add credit. */
function AccountBudgetRow({ budget, client }: { budget: AccountBudget; client: ServiceClient }) {
  const [kind, setKind] = useState<Kind>(budget.period ?? "Credits");
  const [day, setDay] = useState(todayOf());
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = (limits: BudgetLimits) => {
    const since = kind === "Credits" ? dayTimeOf(day) : null;
    if (kind === "Credits" && since === null) return Promise.reject(new Error("Write the day as YYYY-MM-DD."));
    return client.request({
      _tag: "SetAccountBudget",
      accountId: budget.accountId,
      harness: budget.harness,
      limits,
      period: kind === "Credits" ? null : kind,
      since,
    });
  };
  const addCredit = () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return setError("Write the credit as an amount above 0.");
    return client
      .request({ _tag: "AddCredit", accountId: budget.accountId, amount: parsed, harness: budget.harness })
      .then(
        () => {
          setAmount("");
          setError(null);
        },
        (reason) => setError(messageOf(reason)),
      );
  };
  const hasCredits = budget.period === null && budget.limits.cost !== null;
  return (
    <View style={styles.section}>
      <Text style={styles.label}>
        {budget.harness === "claude" ? "Claude Code" : budget.harness === "codex" ? "Codex" : "OpenCode"} ·{" "}
        {budget.label}
      </Text>
      <Text style={styles.muted}>{accountBudgetTextOf(budget)}</Text>
      {budget.lastChange !== null && <Text style={styles.muted}>{budget.lastChange}</Text>}
      <Choice label={(value) => kindLabels[value]} onChange={setKind} options={kinds} value={kind} />
      {kind === "Credits" && (
        <TextInput
          accessibilityLabel="Day the credits were bought, as YYYY-MM-DD"
          onChangeText={setDay}
          placeholder="Bought on (YYYY-MM-DD)"
          style={styles.input}
          value={day}
        />
      )}
      <BudgetEditor
        key={`${JSON.stringify(budget.limits)}:${kind}`}
        limits={budget.limits}
        onSave={save}
        saveLabel={kind === "Credits" ? "Save credits" : "Save budget"}
      />
      {hasCredits && (
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <TextInput
            accessibilityLabel="Credit to add, in dollars"
            keyboardType="decimal-pad"
            onChangeText={setAmount}
            placeholder="Add credit ($)"
            style={[styles.input, styles.flex]}
            value={amount}
          />
          <GoldButton isPrimary={false} label="Add credit" onPress={addCredit} />
        </View>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/**
 * Each provider account's budget and credits (budget-control, Account budgets and credits): a limit over a period, or
 * credits bought on a day. Gild counts only its own turns on the account, and the card says so.
 */
export function AccountBudgetsCard({ client }: { client: ServiceClient }) {
  const { data: budgets } = useServiceQuery(client, { _tag: "ReadAccountBudgets" }, "account-budgets");
  return (
    <SettingsCard icon="gem" title="Account budgets and credits">
      <Text style={styles.muted}>
        A budget stops the quests running on an account when it is reached. Credits count what you bought, from the day
        you bought them. Gild cannot see what other tools use on the same account.
      </Text>
      {budgets?.map((budget, index) => (
        <View key={`${budget.harness}:${budget.accountId ?? ""}`} style={styles.settings}>
          {index > 0 && <SettingsRule />}
          <AccountBudgetRow budget={budget} client={client} />
        </View>
      ))}
    </SettingsCard>
  );
}
