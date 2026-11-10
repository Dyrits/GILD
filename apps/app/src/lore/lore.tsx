import type {
  LoreChange,
  LoreEntry,
  LoreEntryId,
  LoreGauge,
  LoreProposal,
  LoreScope,
  LoreStateFilter,
  ThreadId,
  WorkspaceId,
} from "@gild/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { clockOf, timeOf } from "../foundation/formatting";
import {
  loreActionOf,
  loreChangeLineOf,
  loreFadingLabelOf,
  loreGaugeLabelOf,
  loreOriginLabelOf,
  loreProposalLineOf,
  scopeNameOf,
} from "../foundation/labels";
import { useHasSidebar } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Choice } from "../ui/pickers";
import { DeletedLoreEntryRow, LoreHistoryScreen } from "./loreHistory";

// Stored and wire names keep `intel` so existing data and agents still work: request tags (`"ListIntel"`, ...).

// Scoped lore (scoped-intel): the thread's lore icon, its changes in the conversation, and the lore panel.

/** The thread's lore icon: its count and share of the context window, red past the warning share. */
export function LoreIcon({ gauge, onPress }: { gauge: LoreGauge; onPress: () => void }) {
  return (
    <Pressable
      accessibilityHint={`${gauge.tokens} tokens of a ${gauge.windowTokens}-token context window; opens the lore panel`}
      onPress={onPress}
    >
      <Text style={[styles.link, gauge.isOverWarning && styles.error]}>{loreGaugeLabelOf(gauge)}</Text>
    </Pressable>
  );
}

/** Approve and Decline on a change or a proposal awaiting the owner. */
function Decision({ onResolve }: { onResolve: (isApproved: boolean) => Promise<unknown> }) {
  const [error, setError] = useState<string | null>(null);
  const resolve = (isApproved: boolean) =>
    onResolve(isApproved).then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
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
export function LoreChangeCard({
  change,
  client,
  shouldNameThread = false,
}: {
  change: LoreChange;
  client: ServiceClient;
  shouldNameThread?: boolean;
}) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionText}>
        {loreActionOf(change)}
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

/** A widening or narrowing proposed from evidence: why, the text it keeps, the lore entries it moves, and the decision. */
function LoreProposalCard({ client, proposal }: { client: ServiceClient; proposal: LoreProposal }) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionText}>{loreProposalLineOf(proposal)}</Text>
      <Text style={styles.body}>{proposal.text}</Text>
      {proposal.loreEntries.map((loreEntry) => (
        <Text key={loreEntry.id} style={styles.muted}>
          Now in {scopeNameOf(loreEntry.scopeLabel)}: {loreEntry.text}
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
export function LoreChangeLine({ change }: { change: LoreChange }) {
  return (
    <View style={styles.questionLine}>
      <Text style={styles.muted}>
        {loreChangeLineOf(change)} · {clockOf(change.resolvedAt ?? change.at)}
      </Text>
      <Text style={styles.muted}>{change.text}</Text>
    </View>
  );
}

/** One lore entry in the panel, with Edit, Pin or Unpin, Restore when it faded, Delete, and its History. */
function LoreEntryRow({
  client,
  loreEntry,
  onHistory,
}: {
  client: ServiceClient;
  loreEntry: LoreEntry;
  onHistory: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const origin = loreOriginLabelOf(loreEntry.origin);
  const act = (request: Promise<unknown>, after: () => void) =>
    request.then(
      () => {
        after();
        setError(null);
      },
      (reason) => setError(messageOf(reason)),
    );
  return (
    <View style={styles.section}>
      <Text style={styles.muted}>
        {scopeNameOf(loreEntry.scopeLabel)} · saved by{" "}
        {loreEntry.savedByTitle === null ? "you" : `"${loreEntry.savedByTitle}"`} · {timeOf(loreEntry.savedAt)}
        {loreEntry.updatedAt !== loreEntry.savedAt ? ` · changed ${timeOf(loreEntry.updatedAt)}` : ""} ·{" "}
        {loreEntry.tokens} tokens
      </Text>
      <Text style={styles.muted}>{loreFadingLabelOf(loreEntry)}</Text>
      {origin !== null && <Text style={styles.muted}>{origin}</Text>}
      {draft === null ? (
        <View style={styles.row}>
          <Text style={[styles.body, styles.flex]}>{loreEntry.text}</Text>
          <Pressable onPress={() => setDraft(loreEntry.text)}>
            <Text style={styles.link}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              act(
                client.request({ _tag: "PinIntel", isPinned: !loreEntry.isPinned, loreEntryId: loreEntry.id }),
                () => {},
              )
            }
          >
            <Text style={styles.link}>{loreEntry.isPinned ? "Unpin" : "Pin"}</Text>
          </Pressable>
          {loreEntry.state !== "Active" && (
            <Pressable
              onPress={() => act(client.request({ _tag: "RestoreIntel", loreEntryId: loreEntry.id }), () => {})}
            >
              <Text style={styles.link}>Restore</Text>
            </Pressable>
          )}
          <Pressable onPress={() => act(client.request({ _tag: "DeleteIntel", loreEntryId: loreEntry.id }), () => {})}>
            <Text style={styles.link}>Delete</Text>
          </Pressable>
          <Pressable onPress={onHistory}>
            <Text style={styles.link}>History</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.inlineRow}>
          <TextInput
            accessibilityLabel="Lore text"
            multiline
            onChangeText={setDraft}
            style={[styles.input, styles.flex]}
            value={draft}
          />
          <Pressable
            onPress={() =>
              act(client.request({ _tag: "EditIntel", loreEntryId: loreEntry.id, text: draft }), () => setDraft(null))
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

const scopes = [null, "Thread", "Workspace", "Global"] as const satisfies ReadonlyArray<LoreScope | null>;
const states = [
  null,
  "Active",
  "Dormant",
  "Archived",
  "Pinned",
  "Deleted",
] as const satisfies ReadonlyArray<LoreStateFilter | null>;
const scopeNames = { Global: "Global", Thread: "Quest and side-quests", Workspace: "Realm" } as const satisfies Record<
  LoreScope,
  string
>;

/**
 * The lore panel: the changes awaiting approval, then each lore entry with its scope, saver, and time, filtered by
 * scope. Opened from a thread it lists the lore in that thread's scope, most specific first; otherwise all.
 */
export function LoreScreen({
  client,
  onBack,
  threadId,
  title,
  workspaceId = null,
}: {
  client: ServiceClient;
  onBack: () => void;
  threadId: ThreadId | null;
  title: string;
  /** Only the lore of this realm's own scope, as for the realm panel's lore. */
  workspaceId?: WorkspaceId | null;
}) {
  const hasSidebar = useHasSidebar();
  const [scope, setScope] = useState<LoreScope | null>(null);
  const [state, setState] = useState<LoreStateFilter | null>(null);
  const [historyOf, setHistoryOf] = useState<LoreEntryId | null>(null);
  const { data, error } = useServiceQuery(
    client,
    { _tag: "ListIntel", scope, state, threadId, workspaceId },
    `lore:${threadId ?? "all"}:${scope ?? "all"}:${state ?? "all"}:${workspaceId ?? "any"}`,
  );
  if (historyOf !== null) {
    return <LoreHistoryScreen client={client} loreEntryId={historyOf} onBack={() => setHistoryOf(null)} />;
  }
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {/* All lore is a place of the sidebar; a thread's lore goes back to its thread. */}
        {!(hasSidebar && threadId === null && workspaceId === null) && (
          <Pressable onPress={onBack}>
            <Text style={styles.link}>← Back</Text>
          </Pressable>
        )}
        {!(hasSidebar && threadId === null && workspaceId === null) && (
          <Text numberOfLines={1} style={[styles.heading, styles.flex]}>
            {title}
          </Text>
        )}
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {data?.gauge != null && (
        <Text style={data.gauge.isOverWarning ? styles.error : styles.muted}>
          The lore in this quest or side-quest's scope takes {data.gauge.tokens} tokens of its model's{" "}
          {data.gauge.windowTokens.toLocaleString("en-US")}-token context window; the icon turns red past{" "}
          {data.gauge.warningPercent}%.
        </Text>
      )}
      {data && (
        <ScrollView style={styles.flex}>
          {data.proposals.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Proposed from how lore is used</Text>
              {data.proposals.map((proposal) => (
                <LoreProposalCard client={client} key={proposal.id} proposal={proposal} />
              ))}
            </View>
          )}
          {data.awaiting.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Waiting for your approval</Text>
              {data.awaiting.map((change) => (
                <LoreChangeCard change={change} client={client} key={change.id} shouldNameThread />
              ))}
            </View>
          )}
          <View style={[styles.filters, styles.raised]}>
            {/* A realm's lore is all of its own scope, so there is nothing to choose between. */}
            {workspaceId === null && (
              <Choice
                accessibilityLabel="Scope"
                label={(choice) => (choice === null ? "All scopes" : scopeNames[choice])}
                onChange={setScope}
                options={scopes}
                value={scope}
              />
            )}
            <Choice
              accessibilityLabel="State"
              label={(choice) => (choice === null ? "Any state" : choice)}
              onChange={setState}
              options={states}
              value={state}
            />
          </View>
          {data.loreEntries.length === 0 && data.deleted.length === 0 && (
            <Text style={styles.muted}>{state === "Deleted" ? "No deleted lore." : "No lore here yet."}</Text>
          )}
          {data.loreEntries.map((loreEntry) => (
            <LoreEntryRow
              client={client}
              key={loreEntry.id}
              loreEntry={loreEntry}
              onHistory={() => setHistoryOf(loreEntry.id)}
            />
          ))}
          {data.deleted.map((loreEntry) => (
            <DeletedLoreEntryRow
              client={client}
              key={loreEntry.id}
              loreEntry={loreEntry}
              onHistory={() => setHistoryOf(loreEntry.id)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
