import type { MissionId, Suggestion, SuggestionAnswer, ThreadId } from "@iskios/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type Runner, RunnerPickers, useHarnesses } from "../editors/runners";
import { messageOf, type ServiceClient } from "../foundation/client";
import { companionLabelOf, harnessLabels } from "../foundation/formatting";
import { suggestionLabels } from "../foundation/labels";
import { allMissions } from "../foundation/queries";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";

/** The line a resolved suggestion leaves in its thread, opening where the request went. */
export function SuggestionLine({
  suggestion,
  onOpenMission,
  onSelectThread,
}: {
  suggestion: Suggestion;
  onOpenMission: (missionId: MissionId) => void;
  onSelectThread: (threadId: ThreadId) => void;
}) {
  if (suggestion.outcome === null) return null;
  const label = suggestion.isRitual
    ? "Created Ritual"
    : suggestion.isFromGuildmaster && suggestion.outcome === "MovedToMission"
      ? "Opened quest"
      : suggestionLabels[suggestion.outcome];
  const { targetMissionId, targetThreadId } = suggestion;
  const open =
    suggestion.outcome === "KeptAsAside"
      ? targetThreadId === null
        ? null
        : () => onSelectThread(targetThreadId)
      : targetMissionId === null
        ? null
        : () => onOpenMission(targetMissionId);
  return (
    <View style={styles.questionLine}>
      {open === null ? (
        <Text style={styles.muted}>{label}</Text>
      ) : (
        <Pressable onPress={open}>
          <Text style={styles.link}>
            {label}: {suggestion.targetTitle}
            {suggestion.isAutomatic && !suggestion.isFromGuildmaster ? " (opened without asking)" : ""}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** A labelled row of exclusive choices, shown as chips that wrap. */
function ChoiceRow({
  label,
  options,
}: {
  label: string;
  options: ReadonlyArray<{ isSelected: boolean; label: string; onPress: () => void }>;
}) {
  return (
    <View accessibilityLabel={label} style={local.choice}>
      <Text style={styles.muted}>{label}</Text>
      <View style={local.chips}>
        {options.map((option) => (
          <Pressable
            accessibilityState={{ selected: option.isSelected }}
            key={option.label}
            onPress={option.onPress}
            style={[styles.answer, local.chip, option.isSelected && styles.answerPrimary]}
          >
            <Text style={[styles.answerText, option.isSelected && styles.answerTextPrimary]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  chip: { alignSelf: "flex-start" },
  chips: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { gap: 6 },
});

/** An open suggestion: where the owner sends a message the thread found off topic. */
export function SuggestionCard({ client, suggestion }: { client: ServiceClient; suggestion: Suggestion }) {
  const { data: harnesses } = useHarnesses(client);
  const [runner, setRunner] = useState<Runner>({
    accountId: suggestion.accountId,
    effort: suggestion.effort,
    harness: suggestion.harness,
    model: suggestion.model,
  });
  const [error, setError] = useState<string | null>(null);
  // Iskios's cards choose a Companion by the tiers the owner set in the Workshop; the pickers stay behind "Customize".
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const [isCustomizing, setIsCustomizing] = useState(false);
  const tiers = (["Light", "Balanced", "Heavy"] as const).flatMap((name) => {
    const tier = settings?.tiers[name];
    return tier === undefined || tier === null ? [] : [{ name, runner: tier as Runner }];
  });
  const defaultRunner: Runner | null =
    settings === null || settings === undefined
      ? null
      : {
          accountId: null,
          effort: settings.defaultEffort,
          harness: settings.defaultHarness,
          model: settings.defaultModel,
        };
  const isSame = (a: Runner, b: Runner | null) =>
    b !== null &&
    a.harness === b.harness &&
    a.model === b.model &&
    a.effort === b.effort &&
    (a.accountId ?? null) === (b.accountId ?? null);
  // The realm for a new quest from Iskios: the proposed one until the owner picks another, or the Borderlands.
  const [realmPath, setRealmPath] = useState<string | null>(suggestion.realmPath);
  const { data: known } = useServiceQuery(client, allMissions.request, allMissions.key);
  const realms = (known?.workspaces ?? [])
    .filter((realm) => realm.path !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
  const send = (answer: SuggestionAnswer) =>
    client.request({ _tag: "AnswerSuggestion", answer, suggestionId: suggestion.id }).then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
    );
  return (
    <View style={styles.question}>
      <Text style={styles.questionText}>
        {suggestion.isFromGuildmaster
          ? suggestion.matches.length === 0
            ? "Iskios proposes a new quest. Pick its realm, then open it."
            : "A quest may already cover this. Continue it, or open a new quest?"
          : "This message seems off this quest's topic. Where should it go?"}
      </Text>
      <Text style={styles.body}>{suggestion.text}</Text>
      {suggestion.matches.map((match) => (
        <Pressable
          key={match.missionId}
          onPress={() => send({ _tag: "Continue", missionId: match.missionId })}
          style={styles.answer}
        >
          <Text style={styles.answerText}>
            Continue in "{match.title}" · {match.state}
          </Text>
        </Pressable>
      ))}
      <View style={styles.details}>
        <Pressable
          onPress={() =>
            send({ _tag: "NewMission", ...runner, ...(suggestion.isFromGuildmaster ? { realmPath } : {}) })
          }
          style={[styles.answer, styles.answerPrimary]}
        >
          <Text style={[styles.answerText, styles.answerTextPrimary]}>
            {suggestion.isFromGuildmaster
              ? suggestion.matches.length === 0
                ? "Open the new quest"
                : "Open a new quest anyway"
              : "Open as new quest"}{" "}
            "{suggestion.title}"
          </Text>
        </Pressable>
        {suggestion.isFromGuildmaster && (
          <ChoiceRow
            label="Realm"
            options={[
              { isSelected: realmPath === null, label: "Borderlands", onPress: () => setRealmPath(null) },
              ...realms.map((realm) => ({
                isSelected: realmPath === realm.path,
                label: realm.name,
                onPress: () => setRealmPath(realm.path),
              })),
            ]}
          />
        )}
        {suggestion.isFromGuildmaster ? (
          <>
            {tiers.length > 0 ? (
              <ChoiceRow
                label="Companion"
                options={[
                  ...(defaultRunner === null
                    ? []
                    : [
                        {
                          isSelected: isSame(runner, defaultRunner),
                          label: "Default",
                          onPress: () => setRunner(defaultRunner),
                        },
                      ]),
                  ...tiers.map((tier) => ({
                    isSelected: isSame(runner, tier.runner),
                    label: `${tier.name} · ${companionLabelOf(tier.runner.harness, null, tier.runner.model)}`,
                    onPress: () => setRunner(tier.runner),
                  })),
                ]}
              />
            ) : (
              <Text style={styles.muted}>
                Starts on {harnessLabels[runner.harness]} · {companionLabelOf(runner.harness, null, runner.model)}, the
                default Companion. Set Light, Balanced, and Heavy in the Workshop to choose by tier.
              </Text>
            )}
            <Pressable onPress={() => setIsCustomizing(!isCustomizing)}>
              <Text style={styles.link}>
                {isCustomizing ? "Hide the Companion settings" : "Customize the Companion"}
              </Text>
            </Pressable>
            {isCustomizing && (
              <RunnerPickers
                client={client}
                harnesses={harnesses}
                isCompact={false}
                onChange={setRunner}
                value={runner}
              />
            )}
          </>
        ) : (
          <RunnerPickers client={client} harnesses={harnesses} isCompact={false} onChange={setRunner} value={runner} />
        )}
      </View>
      {!suggestion.isFromGuildmaster && (
        <Pressable onPress={() => send({ _tag: "Aside" })} style={styles.answer}>
          <Text style={styles.answerText}>Keep as aside</Text>
        </Pressable>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
