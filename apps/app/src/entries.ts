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

/** A quest or Ritual a reply leads to, which the conversation draws as a button beside that reply. */
export type QuestLink = { key: string; label: string; missionId: MissionId; title: string };

/** One entry of a thread's conversation, with the key the list keeps it by. */
export type Entry = { key: string; at: number } & (
  | { _tag: "Message"; message: Message; links: ReadonlyArray<QuestLink>; fromQuest: MissionId | null }
  /** The intermediate replies of one turn gathered as its steps, which the conversation folds under one line. */
  | { _tag: "Steps"; steps: ReadonlyArray<Message>; seconds: number }
  | { _tag: "Question"; question: Question }
  | { _tag: "Suggestion"; suggestion: Suggestion }
  | { _tag: "BudgetEvent"; event: BudgetEvent }
  | { _tag: "Handover"; handover: Handover }
  | { _tag: "LoreChange"; change: LoreChange }
  | { _tag: "ThreadOpened"; thread: ThreadSummary }
  /** A link whose reply is not written yet, which stands on its own until it is. */
  | { _tag: "QuestLink"; label: string; missionId: MissionId; title: string }
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

/**
 * The agent replies that are steps, not answers: within each run of agent replies, all but the last, and all of the
 * trailing run while the thread works, since its answer is not written yet. A reply with a link is an answer.
 * Each group carries the seconds from what began the run to its last step.
 */
const stepGroupsOf = (messages: ReadonlyArray<Message>, isWorking: boolean, hasLink: (message: Message) => boolean) => {
  const groups: Array<{ seconds: number; steps: Array<Message> }> = [];
  let run: Array<Message> = [];
  let before: Message | undefined;
  const close = (isTrailing: boolean) => {
    const steps = run.slice(0, isWorking && isTrailing ? run.length : -1).filter((reply) => !hasLink(reply));
    const first = steps[0];
    const last = steps.at(-1);
    if (first !== undefined && last !== undefined)
      groups.push({ seconds: Math.max(0, Math.round((last.sentAt - (before ?? first).sentAt) / 1000)), steps });
    run = [];
  };
  for (const message of [...messages].sort((a, b) => a.sequence - b.sequence)) {
    if (message.sender === "agent") run.push(message);
    else {
      close(false);
      before = message;
    }
  }
  close(true);
  return groups;
};

/** The agent replies written since the last message of anyone else: while a thread works, the steps so far. */
export const trailingReplies = (messages: ReadonlyArray<Message>) => {
  const sorted = [...messages].sort((a, b) => a.sequence - b.sequence);
  const lastOther = sorted.findLastIndex((message) => message.sender !== "agent");
  return sorted.slice(lastOther + 1);
};

/**
 * Messages, questions, off-topic suggestions, budget lines, handovers, lore changes, and the threads opened beneath, in the order they happened.
 * An aside is left out: its suggestion line already leads to it.
 * In the Guildmaster's conversation what it opened, created, or continued, becomes a link carried by the Guildmaster's own reply to it, so its confirmation comes first and the link stands beside it. A report from a quest carries its own small button.
 */
export const entriesOf = (detail: MissionDetail, isWorking = false): Array<Entry> => {
  const replies = detail.messages.filter((message) => message.sender === "agent");
  /** The first reply written at or after the time. */
  const replyFrom = (time: number) => replies.find((reply) => reply.sentAt >= time);
  const isSettledByGuildmaster = (suggestion: Suggestion) =>
    suggestion.isFromGuildmaster && suggestion.outcome !== null && suggestion.outcome !== "Withdrawn";
  const links: Array<QuestLink & { at: number }> = [
    ...detail.suggestions.flatMap((suggestion) =>
      isSettledByGuildmaster(suggestion) && suggestion.targetMissionId !== null
        ? [
            {
              at: suggestion.resolvedAt ?? suggestion.askedAt,
              key: suggestion.id,
              label: settledLabelOf(suggestion),
              missionId: suggestion.targetMissionId,
              title: suggestion.targetTitle ?? "",
            },
          ]
        : [],
    ),
  ].sort((a, b) => a.at - b.at);
  const linksByReply = new Map<string, Array<QuestLink>>();
  const waitingLinks: Array<Entry> = [];
  for (const { at, ...link } of links) {
    const reply = replyFrom(at);
    if (reply === undefined) waitingLinks.push({ _tag: "QuestLink", at: at + afterReply, ...link });
    else linksByReply.set(reply.id, [...(linksByReply.get(reply.id) ?? []), link]);
  }
  const stepGroups = stepGroupsOf(detail.messages, isWorking, (message) => linksByReply.has(message.id));
  const stepIds = new Set(stepGroups.flatMap((group) => group.steps.map((step) => step.id)));
  return [
    ...stepGroups.map(
      (group): Entry => ({
        _tag: "Steps",
        at: group.steps[0]?.sentAt ?? 0,
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
          links: linksByReply.get(message.id) ?? [],
          message,
        }),
      ),
    ...waitingLinks,
    ...detail.questions.map(
      (question): Entry => ({ _tag: "Question", at: question.askedAt, key: question.id, question }),
    ),
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
