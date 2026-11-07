import type {
  Intel,
  IntelChange,
  IntelGauge,
  IntelId,
  IntelProposal,
  IntelScope,
  IntelStateFilter,
  ThreadId,
} from "@openmission/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { ServiceClient } from "./client";
import { timeOf } from "./formatting";
import { DeletedIntelRow, IntelHistoryScreen } from "./intelHistory";
import {
  intelActionOf,
  intelChangeLineOf,
  intelFadingLabelOf,
  intelGaugeLabelOf,
  intelOriginLabelOf,
  intelProposalLineOf,
} from "./labels";
import { useHasSidebar } from "./sidebar";
import { styles } from "./styles";
import { useServiceQuery } from "./useServiceQuery";

// Scoped intel (scoped-intel): the thread's intel icon, its changes in the conversation, and the intel panel.

const clock = (millis: number) => new Date(millis).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** The thread's intel icon: its count and share of the context window, red past the warning share. */
export function IntelIcon({ gauge, onPress }: { gauge: IntelGauge; onPress: () => void }) {
  return (
    <Pressable
      accessibilityHint={`${gauge.tokens} tokens of a ${gauge.windowTokens}-token context window; opens the intel panel`}
      onPress={onPress}
    >
      <Text style={[styles.link, gauge.isOverWarning && styles.error]}>{intelGaugeLabelOf(gauge)}</Text>
    </Pressable>
  );
}

/** Approve and Decline on a change or a proposal awaiting the owner. */
function Decision({ onResolve }: { onResolve: (isApproved: boolean) => Promise<unknown> }) {
  const [error, setError] = useState<string | null>(null);
  const resolve = (isApproved: boolean) =>
    onResolve(isApproved).then(
      () => setError(null),
      (reason: Error) => setError(reason.message),
    );
  return (
    <View style={styles.section}>
      <View style={styles.inlineRow}>
        <Pressable onPress={() => resolve(true)} style={[styles.answer, styles.answerPrimary]}>
          <Text style={[styles.answerText, styles.answerTextPrimary]}>Approve</Text>
        </Pressable>
        <Pressable onPress={() => resolve(false)} style={styles.answer}>
          <Text style={styles.answerText}>Decline</Text>
        </Pressable>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** A change awaiting approval as a card: what the thread asks, the text, and the decision. */
export function IntelChangeCard({
  change,
  client,
  shouldNameThread = false,
}: {
  change: IntelChange;
  client: ServiceClient;
  shouldNameThread?: boolean;
}) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionText}>
        {intelActionOf(change)}
        {shouldNameThread ? ` · asked by "${change.threadTitle}"` : ""}
      </Text>
      {(change.kind === "Update" || change.kind === "Replace") && change.previousText !== change.text && (
        <Text style={styles.muted}>Was: {change.previousText}</Text>
      )}
      <Text style={styles.body}>{change.text}</Text>
      <Decision
        onResolve={(isApproved) => client.request({ _tag: "ResolveIntelChange", changeId: change.id, isApproved })}
      />
    </View>
  );
}

/** A widening or narrowing proposed from evidence: why, the text it keeps, the intels it moves, and the decision. */
function IntelProposalCard({ client, proposal }: { client: ServiceClient; proposal: IntelProposal }) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionText}>{intelProposalLineOf(proposal)}</Text>
      <Text style={styles.body}>{proposal.text}</Text>
      {proposal.intels.map((intel) => (
        <Text key={intel.id} style={styles.muted}>
          Now in {intel.scopeLabel}: {intel.text}
        </Text>
      ))}
      <Decision
        onResolve={(isApproved) =>
          client.request({ _tag: "ResolveIntelProposal", isApproved, proposalId: proposal.id })
        }
      />
    </View>
  );
}

/** A change made or decided, as a short line in its thread. */
export function IntelChangeLine({ change }: { change: IntelChange }) {
  return (
    <View style={styles.questionLine}>
      <Text style={styles.muted}>
        {intelChangeLineOf(change)} · {clock(change.resolvedAt ?? change.at)}
      </Text>
      <Text style={styles.muted}>{change.text}</Text>
    </View>
  );
}

/** One intel in the panel, with Edit, Pin or Unpin, Restore when it faded, Delete, and its History. */
function IntelRow({ client, intel, onHistory }: { client: ServiceClient; intel: Intel; onHistory: () => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const origin = intelOriginLabelOf(intel.origin);
  const act = (request: Promise<unknown>, after: () => void) =>
    request.then(
      () => {
        after();
        setError(null);
      },
      (reason: Error) => setError(reason.message),
    );
  return (
    <View style={styles.section}>
      <Text style={styles.muted}>
        {intel.scopeLabel} · saved by {intel.savedByTitle === null ? "you" : `"${intel.savedByTitle}"`} ·{" "}
        {timeOf(intel.savedAt)}
        {intel.updatedAt !== intel.savedAt ? ` · changed ${timeOf(intel.updatedAt)}` : ""} · {intel.tokens} tokens
      </Text>
      <Text style={styles.muted}>{intelFadingLabelOf(intel)}</Text>
      {origin !== null && <Text style={styles.muted}>{origin}</Text>}
      {draft === null ? (
        <View style={styles.row}>
          <Text style={[styles.body, styles.flex]}>{intel.text}</Text>
          <Pressable onPress={() => setDraft(intel.text)}>
            <Text style={styles.link}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              act(client.request({ _tag: "PinIntel", intelId: intel.id, isPinned: !intel.isPinned }), () => {})
            }
          >
            <Text style={styles.link}>{intel.isPinned ? "Unpin" : "Pin"}</Text>
          </Pressable>
          {intel.state !== "Active" && (
            <Pressable onPress={() => act(client.request({ _tag: "RestoreIntel", intelId: intel.id }), () => {})}>
              <Text style={styles.link}>Restore</Text>
            </Pressable>
          )}
          <Pressable onPress={() => act(client.request({ _tag: "DeleteIntel", intelId: intel.id }), () => {})}>
            <Text style={styles.link}>Delete</Text>
          </Pressable>
          <Pressable onPress={onHistory}>
            <Text style={styles.link}>History</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.inlineRow}>
          <TextInput
            accessibilityLabel="Intel text"
            multiline
            onChangeText={setDraft}
            style={[styles.input, styles.flex]}
            value={draft}
          />
          <Pressable
            onPress={() =>
              act(client.request({ _tag: "EditIntel", intelId: intel.id, text: draft }), () => setDraft(null))
            }
          >
            <Text style={styles.link}>Save</Text>
          </Pressable>
          <Pressable onPress={() => setDraft(null)}>
            <Text style={styles.link}>Cancel</Text>
          </Pressable>
        </View>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const scopes = [null, "Thread", "Workspace", "Global"] as const satisfies ReadonlyArray<IntelScope | null>;
const states = [
  null,
  "Active",
  "Dormant",
  "Archived",
  "Pinned",
  "Deleted",
] as const satisfies ReadonlyArray<IntelStateFilter | null>;
const scopeNames = { Global: "Global", Thread: "Thread and mission", Workspace: "Workspace" } as const satisfies Record<
  IntelScope,
  string
>;

/**
 * The intel panel: the changes awaiting approval, then each intel with its scope, saver, and time, filtered by
 * scope. Opened from a thread it lists the intel in that thread's scope, most specific first; otherwise all.
 */
export function IntelScreen({
  client,
  onBack,
  threadId,
  title,
}: {
  client: ServiceClient;
  onBack: () => void;
  threadId: ThreadId | null;
  title: string;
}) {
  const hasSidebar = useHasSidebar();
  const [scope, setScope] = useState<IntelScope | null>(null);
  const [state, setState] = useState<IntelStateFilter | null>(null);
  const [historyOf, setHistoryOf] = useState<IntelId | null>(null);
  const { data, error } = useServiceQuery(
    client,
    { _tag: "ListIntel", scope, state, threadId },
    `intel:${threadId ?? "all"}:${scope ?? "all"}:${state ?? "all"}`,
  );
  if (historyOf !== null) {
    return <IntelHistoryScreen client={client} intelId={historyOf} onBack={() => setHistoryOf(null)} />;
  }
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {/* All intel is a place of the sidebar; a thread's intel goes back to its thread. */}
        {!(hasSidebar && threadId === null) && (
          <Pressable onPress={onBack}>
            <Text style={styles.link}>← Back</Text>
          </Pressable>
        )}
        <Text numberOfLines={1} style={[styles.heading, styles.flex]}>
          {title}
        </Text>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {data?.gauge != null && (
        <Text style={data.gauge.isOverWarning ? styles.error : styles.muted}>
          The intel in this thread's scope takes {data.gauge.tokens} tokens of its model's{" "}
          {data.gauge.windowTokens.toLocaleString("en-US")}-token context window; the icon turns red past{" "}
          {data.gauge.warningPercent}%.
        </Text>
      )}
      {data && (
        <ScrollView style={styles.flex}>
          {data.proposals.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Proposed from how intel is used</Text>
              {data.proposals.map((proposal) => (
                <IntelProposalCard client={client} key={proposal.id} proposal={proposal} />
              ))}
            </View>
          )}
          {data.awaiting.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Waiting for your approval</Text>
              {data.awaiting.map((change) => (
                <IntelChangeCard change={change} client={client} key={change.id} shouldNameThread />
              ))}
            </View>
          )}
          <View style={[styles.chips, { marginVertical: 12 }]}>
            {scopes.map((choice) => (
              <Pressable
                key={choice ?? "all"}
                onPress={() => setScope(choice)}
                style={[styles.chip, scope === choice && styles.chipSelected]}
              >
                <Text style={[styles.chipText, scope === choice && styles.chipTextSelected]}>
                  {choice === null ? "All" : scopeNames[choice]}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.chips, { marginBottom: 12 }]}>
            {states.map((choice) => (
              <Pressable
                key={choice ?? "all"}
                onPress={() => setState(choice)}
                style={[styles.chip, state === choice && styles.chipSelected]}
              >
                <Text style={[styles.chipText, state === choice && styles.chipTextSelected]}>
                  {choice === null ? "Any state" : choice}
                </Text>
              </Pressable>
            ))}
          </View>
          {data.intels.length === 0 && data.deleted.length === 0 && (
            <Text style={styles.muted}>{state === "Deleted" ? "No deleted intel." : "No intel here yet."}</Text>
          )}
          {data.intels.map((intel) => (
            <IntelRow client={client} intel={intel} key={intel.id} onHistory={() => setHistoryOf(intel.id)} />
          ))}
          {data.deleted.map((intel) => (
            <DeletedIntelRow client={client} intel={intel} key={intel.id} onHistory={() => setHistoryOf(intel.id)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
