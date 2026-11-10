import type {
  BudgetEvent,
  Handover,
  LoreChange,
  Message,
  MissionDetail,
  Question,
  Suggestion,
  ThreadSummary,
} from "@gild/contracts";

/** One entry of a thread's conversation, with the key the list keeps it by. */
export type Entry = { key: string; at: number } & (
  | { _tag: "Message"; message: Message }
  | { _tag: "Question"; question: Question }
  | { _tag: "Suggestion"; suggestion: Suggestion }
  | { _tag: "BudgetEvent"; event: BudgetEvent }
  | { _tag: "Handover"; handover: Handover }
  | { _tag: "LoreChange"; change: LoreChange }
  | { _tag: "ThreadOpened"; thread: ThreadSummary }
);

/**
 * Messages, questions, off-topic suggestions, budget lines, handovers, lore changes, and the threads opened beneath,
 * in the order they happened. An aside is left out: its suggestion line already leads to it.
 */
export const entriesOf = (detail: MissionDetail): Array<Entry> =>
  [
    ...detail.threads
      .filter((thread) => thread.parentId === detail.thread.id && !thread.isAside)
      .map((thread): Entry => ({ _tag: "ThreadOpened", at: thread.openedAt, key: `opened:${thread.id}`, thread })),
    ...detail.messages.map((message): Entry => ({ _tag: "Message", at: message.sentAt, key: message.id, message })),
    ...detail.questions.map(
      (question): Entry => ({ _tag: "Question", at: question.askedAt, key: question.id, question }),
    ),
    ...detail.suggestions.map(
      (suggestion): Entry => ({ _tag: "Suggestion", at: suggestion.askedAt, key: suggestion.id, suggestion }),
    ),
    ...detail.budgetEvents.map((event): Entry => ({ _tag: "BudgetEvent", at: event.at, event, key: event.id })),
    ...detail.handovers.map((handover): Entry => ({ _tag: "Handover", at: handover.at, handover, key: handover.id })),
    ...detail.loreChanges.map((change): Entry => ({ _tag: "LoreChange", at: change.at, change, key: change.id })),
  ].sort((a, b) => a.at - b.at);
