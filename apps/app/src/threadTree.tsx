import {
  type EffortChoice,
  EffortChoice as EffortChoices,
  type ModelChoice,
  ModelChoice as ModelChoices,
  type ThreadId,
  type ThreadSummary,
  type ThreadView,
} from "@openmission/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { newRequestId, type ServiceClient } from "./client";
import { Choice, Composer, StateBadge } from "./controls";
import { foldThreads } from "./folding";
import { effortLabel, modelLabels } from "./formatting";
import { foldedLabelOf } from "./labels";
import { styles } from "./styles";

/** A mission's threads as an indented tree with their states; selecting one shows its conversation. */
export function ThreadTree({
  onSelect,
  selectedId,
  shouldShowAgentThreads,
  threads,
}: {
  onSelect: (threadId: ThreadId) => void;
  selectedId: ThreadId;
  shouldShowAgentThreads: boolean;
  threads: ReadonlyArray<ThreadSummary>;
}) {
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set());
  return (
    <ScrollView contentContainerStyle={styles.treeList} style={styles.tree}>
      {foldThreads(threads, shouldShowAgentThreads, unfolded).map(({ thread, depth, foldedCount }) => (
        <Pressable
          key={thread.id}
          onPress={() => {
            if (foldedCount > 0) setUnfolded((current) => new Set([...current, thread.id]));
            onSelect(thread.id);
          }}
          style={[styles.treeRow, { paddingLeft: 8 + depth * 16 }, thread.id === selectedId && styles.treeRowSelected]}
        >
          <View style={styles.treeTitleRow}>
            <Text numberOfLines={1} style={[styles.treeTitle, thread.id === selectedId && styles.treeTitleSelected]}>
              {thread.title}
            </Text>
            <StateBadge state={thread.state} />
          </View>
          {thread.isAside && <Text style={styles.treeNote}>Aside</Text>}
          {foldedCount > 0 && <Text style={styles.treeNote}>{foldedLabelOf(foldedCount)}</Text>}
          {thread.waitingCount > 0 && thread.state !== "Running" && (
            <Text style={styles.treeNote}>
              {thread.waitingCount === 1 ? "1 message waiting" : `${thread.waitingCount} messages waiting`}
            </Text>
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}

/**
 * Opens a thread beneath the selected one: its model and effort start as the parent's and can be changed
 * until the first message is sent (thread-tree, Opening a thread).
 */
export function OpenThreadForm({
  client,
  onCancel,
  onOpened,
  parent,
}: {
  client: ServiceClient;
  onCancel: () => void;
  onOpened: (threadId: ThreadId) => void;
  parent: ThreadView;
}) {
  const [model, setModel] = useState<ModelChoice>(parent.model);
  const [effort, setEffort] = useState<EffortChoice>(parent.effort);
  return (
    <View style={styles.openForm}>
      <View style={styles.header}>
        <Text numberOfLines={1} style={[styles.label, styles.flex]}>
          New thread beneath "{parent.title}"
        </Text>
        <Pressable onPress={onCancel}>
          <Text style={styles.link}>Cancel</Text>
        </Pressable>
      </View>
      <Choice
        label={(choice) => modelLabels[choice]}
        onChange={setModel}
        options={ModelChoices.literals}
        value={model}
      />
      <Choice label={effortLabel} onChange={setEffort} options={EffortChoices.literals} value={effort} />
      <Composer
        onSend={async (text) => {
          const opened = await client.request({
            _tag: "OpenThread",
            effort,
            model,
            parentThreadId: parent.id,
            requestId: newRequestId(),
            text,
          });
          onOpened(opened.threadId);
        }}
        placeholder="The new thread's first message…"
      />
    </View>
  );
}
