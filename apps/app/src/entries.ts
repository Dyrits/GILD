import type {
  BudgetEvent,
  Handover,
  LoreChange,
  Message,
  MissionDetail,
  MissionId,
  Question,
  Suggestion,
  ThreadSummary,
} from "@gild/contracts";
import { suggestionLabels } from "./labels";

/** A quest or Ritual the Guildmaster opened, created, or continued, which the conversation draws as a card of its own. */
export type QuestLink = { key: string; label: string; missionId: MissionId; sentAt: number; title: string };

/** One entry of a thread's conversation, with the key the list keeps it by. */
export type Entry = { key: string; at: number } & (
  | { _tag: "Message"; message: Message; fromQuest: MissionId | null }
  /** The intermediate replies of one turn gathered as its steps, which the conversation folds under one line. */
  | { _tag: "Steps"; isCurrent: boolean; seconds: number; steps: ReadonlyArray<Step> }
  | { _tag: "Question"; question: Question }
  | { _tag: "Suggestion"; suggestion: Suggestion }
  | { _tag: "BudgetEvent"; event: BudgetEvent }
  | { _tag: "Handover"; handover: Handover }
  | { _tag: "LoreChange"; change: LoreChange }
  | { _tag: "ThreadOpened"; thread: ThreadSummary }
  | ({ _tag: "QuestLink" } & Omit<QuestLink, "key">)
);

/** A line sits just after the reply that answers what it belongs to. */
const afterReply = 0.5;

/** What the Guildmaster did with a request it settled. */
const settledLabelOf = (suggestion: Suggestion) =>
  suggestion.isRitual
    ? "Created Ritual"
    : suggestion.outcome === "MovedToMission"
      ? "Opened quest"
      : suggestionLabels[suggestion.outcome ?? "Continued"];

/** One step of a turn: a reply written on the way, or an action the thread ran or was allowed to run. */
export type Step =
  | { _tag: "Reply"; at: number; id: string; text: string }
  | { _tag: "Action"; at: number; id: string; question: Question };

/** The outcomes that settle an action with no word from the owner worth a line of its own. */
const isFoldedAction = (question: Question) =>
  question.outcome !== null && !["Denied", "Discarded", "Withdrawn"].includes(question.outcome);

/**
 * What a turn did on the way, gathered: the agent replies that are not its answer (within each run of agent replies,
 * all but the last, and all of the trailing run while the thread works, since its answer is not written yet) and the
 * actions it ran, which fall into the run they happened in. Each group carries the seconds from what began the run to
 * its last step, and whether it is the turn still working.
 */
const stepGroupsOf = (messages: ReadonlyArray<Message>, questions: ReadonlyArray<Question>, isWorking: boolean) => {
  const groups: Array<{ isCurrent: boolean; seconds: number; steps: Array<Step> }> = [];
  const actions = questions
    .filter(isFoldedAction)
    .map((question): Step => ({ _tag: "Action", at: question.askedAt, id: question.id, question }))
    .sort((a, b) => a.at - b.at);
  let run: Array<Message> = [];
  let before: Message | undefined;
  const close = (isTrailing: boolean, until: number) => {
    const replies = run.slice(0, isWorking && isTrailing ? run.length : -1);
    const from = before?.sentAt ?? Number.NEGATIVE_INFINITY;
    const steps: Array<Step> = [
      ...replies.map((reply): Step => ({ _tag: "Reply", at: reply.sentAt, id: reply.id, text: reply.text })),
      ...actions.filter((action) => action.at >= from && action.at < until),
    ].sort((a, b) => a.at - b.at);
    const first = steps[0];
    const last = steps.at(-1);
    if (first !== undefined && last !== undefined)
      groups.push({
        isCurrent: isWorking && isTrailing,
        seconds: Math.max(0, Math.round((last.at - (before?.sentAt ?? first.at)) / 1000)),
        steps,
      });
    run = [];
  };
  for (const message of [...messages].sort((a, b) => a.sequence - b.sequence)) {
    if (message.sender === "agent") run.push(message);
    else {
      close(false, message.sentAt);
      before = message;
    }
  }
  close(true, Number.POSITIVE_INFINITY);
  return groups;
};

/** The words for a working thread's current step: the latest step of the turn still going, else a plain word. */
export const workingLabelOf = (entries: ReadonlyArray<Entry>) => {
  const current = entries.findLast((entry) => entry._tag === "Steps" && entry.isCurrent);
  const latest = current?._tag === "Steps" ? current.steps.at(-1) : undefined;
  if (latest === undefined) return "Working…";
  const text = latest._tag === "Reply" ? latest.text : latest.question.summary;
  return text.trim().split("\n")[0]?.replace(/\.$/, "") ?? "Working…";
};

/**
 * Messages, questions, off-topic suggestions, budget lines, handovers, lore changes, and the threads opened beneath, in the order they happened.
 * An aside is left out: its suggestion line already leads to it.
 * In the Guildmaster's conversation what it opened, created, or continued, becomes a card standing just after its confirmation. A report from a quest carries its own small button.
 */
export const entriesOf = (detail: MissionDetail, isWorking = false): Array<Entry> => {
  const replies = detail.messages.filter((message) => message.sender === "agent");
  /** The first reply written at or after the time. */
  const replyFrom = (time: number) => replies.find((reply) => reply.sentAt >= time);
  const isSettledByGuildmaster = (suggestion: Suggestion) =>
    suggestion.isFromGuildmaster && suggestion.outcome !== null && suggestion.outcome !== "Withdrawn";
  /** Each quest the Guildmaster settled, as a card that stands just after the reply confirming it. */
  const questLinks = detail.suggestions.flatMap((suggestion): Array<Entry> => {
    if (!isSettledByGuildmaster(suggestion) || suggestion.targetMissionId === null) return [];
    const at = suggestion.resolvedAt ?? suggestion.askedAt;
    return [
      {
        _tag: "QuestLink",
        at: (replyFrom(at)?.sentAt ?? at) + afterReply,
        key: suggestion.id,
        label: settledLabelOf(suggestion),
        missionId: suggestion.targetMissionId,
        sentAt: at,
        title: suggestion.targetTitle ?? "",
      },
    ];
  });
  const stepGroups = stepGroupsOf(detail.messages, detail.questions, isWorking);
  const stepIds = new Set(stepGroups.flatMap((group) => group.steps.map((step) => step.id)));
  return [
    ...stepGroups.map(
      (group): Entry => ({
        _tag: "Steps",
        at: group.steps[0]?.at ?? 0,
        isCurrent: group.isCurrent,
        key: `steps:${group.steps[0]?.id}`,
        seconds: group.seconds,
        steps: group.steps,
      }),
    ),
    ...detail.threads
      .filter((thread) => thread.parentId === detail.thread.id && !thread.isAside)
      .map((thread): Entry => ({ _tag: "ThreadOpened", at: thread.openedAt, key: `opened:${thread.id}`, thread })),
    ...detail.messages
      .filter((message) => !stepIds.has(message.id))
      .map(
        (message): Entry => ({
          _tag: "Message",
          at: message.sentAt,
          fromQuest:
            message.sender === "thread" && message.fromMissionId !== detail.mission.id ? message.fromMissionId : null,
          key: message.id,
          message,
        }),
      ),
    ...questLinks,
    ...detail.questions
      .filter((question) => !stepIds.has(question.id))
      .map((question): Entry => ({ _tag: "Question", at: question.askedAt, key: question.id, question })),
    ...detail.suggestions
      .filter((suggestion) => !(isSettledByGuildmaster(suggestion) && suggestion.targetMissionId !== null))
      .map(
        (suggestion): Entry => ({
          _tag: "Suggestion",
          // What the Guildmaster settled with nowhere to lead shows after its confirmation; the rest where it was asked.
          at: isSettledByGuildmaster(suggestion)
            ? (replyFrom(suggestion.resolvedAt ?? suggestion.askedAt)?.sentAt ??
                suggestion.resolvedAt ??
                suggestion.askedAt) + afterReply
            : suggestion.askedAt,
          key: suggestion.id,
          suggestion,
        }),
      ),
    ...detail.budgetEvents.map((event): Entry => ({ _tag: "BudgetEvent", at: event.at, event, key: event.id })),
    ...detail.handovers.map((handover): Entry => ({ _tag: "Handover", at: handover.at, handover, key: handover.id })),
    ...detail.loreChanges.map((change): Entry => ({ _tag: "LoreChange", at: change.at, change, key: change.id })),
  ].sort((a, b) => a.at - b.at);
};
