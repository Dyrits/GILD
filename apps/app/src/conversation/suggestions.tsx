import type { MissionId, Suggestion, SuggestionAnswer, ThreadId } from "@iskios/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { type Runner, RunnerPickers, useHarnesses } from "../editors/runners";
import { messageOf, type ServiceClient } from "../foundation/client";
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
          <View accessibilityLabel="Realm" style={styles.details}>
            <Text style={styles.muted}>Realm</Text>
            <Pressable
              accessibilityState={{ selected: realmPath === null }}
              onPress={() => setRealmPath(null)}
              style={[styles.answer, realmPath === null && styles.answerPrimary]}
            >
              <Text style={[styles.answerText, realmPath === null && styles.answerTextPrimary]}>Borderlands</Text>
            </Pressable>
            {realms.map((realm) => (
              <Pressable
                accessibilityState={{ selected: realmPath === realm.path }}
                key={realm.id}
                onPress={() => setRealmPath(realm.path)}
                style={[styles.answer, realmPath === realm.path && styles.answerPrimary]}
              >
                <Text style={[styles.answerText, realmPath === realm.path && styles.answerTextPrimary]}>
                  {realm.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <RunnerPickers client={client} harnesses={harnesses} isCompact={false} onChange={setRunner} value={runner} />
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
