import type { ModelChoice, ThreadId, ThreadSummary, ThreadView } from "@canopy/contracts";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { newRequestId, type ServiceClient } from "./client";
import { Composer, StateBadge } from "./controls";
import { foldThreads } from "./folding";
import { modelLabelOf } from "./formatting";
import { IntelScreen } from "./intel";
import { foldedLabelOf, startingContextPartsOf, startingContextWarningOf } from "./labels";
import { type Runner, RunnerPickers, useHarnesses } from "./runners";
import { styles } from "./styles";
import { useServiceQuery } from "./useServiceQuery";

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
 * until the first message is sent (thread-tree, Opening a thread). Past a quarter of the model's context
 * window it warns, with a larger model, trimming intel, or starting anyway.
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
  const { data: harnesses } = useHarnesses(client);
  const [runner, setRunner] = useState<Runner>({
    accountId: parent.accountId,
    effort: parent.effort,
    harness: parent.harness,
    model: parent.model,
  });
  const { model } = runner;
  const setModel = (chosen: ModelChoice) => setRunner({ ...runner, model: chosen });
  const [isTrimming, setIsTrimming] = useState(false);
  const request = useSettledText();
  const { data: context } = useServiceQuery(
    client,
    { _tag: "PreviewStartingContext", model, parentThreadId: parent.id, text: request.settled },
    `starting:${parent.id}:${model}:${request.settled}`,
  );
  const openWith = (shouldStartAnyway: boolean) => async (text: string) => {
    const opened = await client.request({
      _tag: "OpenThread",
      accountId: runner.accountId,
      effort: runner.effort,
      harness: runner.harness,
      model,
      parentThreadId: parent.id,
      requestId: newRequestId(),
      shouldStartAnyway,
      text,
    });
    onOpened(opened.threadId);
  };
  const isOverWarning = context?.isOverWarning === true;
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
      <RunnerPickers harnesses={harnesses} isCompact={false} onChange={setRunner} value={runner} />
      {context != null && isOverWarning && (
        <View style={styles.failure}>
          <Text style={styles.error}>{startingContextWarningOf(context)}</Text>
          <Text style={styles.muted}>{startingContextPartsOf(context.parts)}</Text>
          <View style={styles.inlineRow}>
            {context.largerModels.length === 0 ? (
              <Text style={styles.muted}>No model has a larger context window.</Text>
            ) : (
              context.largerModels.map((larger) => (
                <Pressable key={larger} onPress={() => setModel(larger)} style={styles.answer}>
                  <Text style={styles.answerText}>Use {modelLabelOf(larger)}</Text>
                </Pressable>
              ))
            )}
            <Pressable onPress={() => setIsTrimming(true)} style={styles.answer}>
              <Text style={styles.answerText}>Trim intel</Text>
            </Pressable>
          </View>
        </View>
      )}
      {isTrimming && (
        // The panel opens inside the form, so the request typed so far stays.
        <View style={styles.trimPanel}>
          <IntelScreen
            client={client}
            onBack={() => setIsTrimming(false)}
            threadId={parent.id}
            title={`Trim intel · ${parent.title}`}
          />
        </View>
      )}
      <Composer
        {...(isOverWarning ? { alternative: { label: "Start anyway", onSend: openWith(true) } } : {})}
        onChangeText={request.change}
        onSend={openWith(false)}
        placeholder="The new thread's first message…"
      />
    </View>
  );
}

/** Text as typed, and the same text once typing pauses, so a preview is not asked for at every key. */
function useSettledText() {
  const [text, setText] = useState("");
  const [settled, setSettled] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSettled(text), 300);
    return () => clearTimeout(timer);
  }, [text]);
  return { change: setText, settled };
}
