import type {
  AccountBudget,
  BudgetLimits,
  Consumption,
  ContextGauge,
  ContextPartKind,
  LoreChange,
  LoreChangeStatus,
  LoreEntry,
  LoreGauge,
  LoreHistoryEntry,
  LoreHistoryKind,
  LoreOrigin,
  LoreProposal,
  PlanLimitReading,
  PlanLimitWindow,
  PriceStatus,
  ReplyUsage,
  StartingContext,
  StartingContextParts,
  SuggestionOutcome,
  ThreadPanel,
} from "@iskios/contracts";

/** A count with its noun, in the singular for one and the plural otherwise, for example "1 step" or "3 steps". */
export const countedOf = (count: number, noun: string) => `${count} ${count === 1 ? noun : `${noun}s`}`;

const sideQuestsOf = (count: number) => countedOf(count, "side-quest");

/** The mark on a thread that folds agent-opened threads beneath it, for example "+3 side-quests". */
export const foldedLabelOf = (count: number) => `+${sideQuestsOf(count)}`;

/** The one deletion confirmation: the threads beneath, and the running ones only when some run. */
export const deletionQuestionOf = (preview: {
  readonly descendantCount: number;
  readonly runningCount: number;
  readonly isMission: boolean;
}) => {
  const beneath = preview.descendantCount === 0 ? "" : ` and ${sideQuestsOf(preview.descendantCount)} beneath it`;
  const running =
    preview.runningCount === 0
      ? ""
      : preview.descendantCount === 0
        ? " (running)"
        : ` (${preview.runningCount} running)`;
  return `Delete this ${preview.isMission ? "quest" : "side-quest"}${beneath}${running}?`;
};

/** Who wrote a journal entry, as the Journal view names it. */
export const journalAuthorOf = (entry: {
  readonly authorKind: "thread" | "user";
  readonly authorTitle: string | null;
}) => (entry.authorKind === "user" ? "You" : `"${entry.authorTitle ?? ""}"`);

const countOf = (value: number) => value.toLocaleString("en-US");

/** A token count rounded, with thousands separators, for example "12,000". */
export const tokenCountOf = (tokens: number) => countOf(Math.round(tokens));

/** The briefing's estimated size against its limit, for example "About 120 of 2,000 tokens". */
export const briefingSizeOf = (tokens: number, limit: number) =>
  `About ${countOf(tokens)} of ${countOf(limit)} tokens${tokens > limit ? ": over the limit" : ""}`;

/** The warning before a thread starts with too large a starting context (thread-tree, Opening a thread). */
export const startingContextWarningOf = (context: StartingContext) =>
  `This side-quest would start with about ${tokenCountOf(context.tokens)} tokens, ${Math.round((context.tokens * 100) / context.windowTokens)}% of the model's ${countOf(context.windowTokens)}-token context window; the warning is at ${context.warningPercent}%.`;

/** Each part of a starting context with its tokens, for example "Request 100 · Journal 50 · … tokens". */
export const startingContextPartsOf = (parts: StartingContextParts) =>
  [
    `Request ${tokenCountOf(parts.request)}`,
    `Journal ${tokenCountOf(parts.journal)}`,
    `Lore ${tokenCountOf(parts.lore)}`,
    `Opener's messages ${tokenCountOf(parts.openerMessages)}`,
    `Realm ${tokenCountOf(parts.workspace)}`,
    `Instructions ${tokenCountOf(parts.instructions)}`,
    `Title and budget ${tokenCountOf(parts.position + parts.budget)} tokens`,
  ].join(" · ");

/** A dashboard row's thread count, for example "1 quest · 4 side-quests · 2 running". */
export const threadCountOf = (mission: { readonly runningCount: number; readonly threadCount: number }) =>
  `1 quest · ${sideQuestsOf(Math.max(0, mission.threadCount - 1))}${mission.runningCount === 0 ? "" : ` · ${mission.runningCount} running`}`;

/** What the dashboard asks of a mission (mission-tracking, Ending a mission). */
export const promptQuestionOf = (prompt: "MarkDone" | "Inactive", inactivityDays: number) =>
  prompt === "MarkDone"
    ? "Mark as done?"
    : `No activity for ${countedOf(inactivityDays, "day")}. Archive it or mark it as done?`;

/** What the line left behind says about where an off-topic request went (thread-tree, Off-topic requests). */
export const suggestionLabels = {
  Continued: "Continued in quest",
  KeptAsAside: "Kept as aside",
  MovedToMission: "Moved to quest",
  Withdrawn: "Off-topic suggestion withdrawn",
} as const satisfies Record<SuggestionOutcome, string>;

/** How full a budget meter is: orange from 80%, red at 100% (budget-control, Seeing budget use). */
export const meterLevelOf = (spent: number, limit: number): "normal" | "warning" | "reached" =>
  spent >= limit ? "reached" : spent >= limit * 0.8 ? "warning" : "normal";

/** How full a thread's context window is: orange from 80%, red from 95% (thread-panel, The context gauge). */
export const contextLevelOf = (tokens: number, windowTokens: number): "normal" | "warning" | "reached" =>
  tokens >= windowTokens * 0.95 ? "reached" : tokens >= windowTokens * 0.8 ? "warning" : "normal";

/** What each part of the context gauge is called. */
export const contextPartLabels = {
  Instructions: "Instructions",
  Journal: "Journal",
  Lore: "Lore",
  Messages: "Messages",
  ToolsAndResults: "Tools and results",
} as const satisfies Record<ContextPartKind, string>;

/** The gauge in words, for example "75,000 of 200,000 tokens · 37.5%". */
export const contextUseTextOf = (gauge: Pick<ContextGauge, "tokens" | "windowTokens">) =>
  `${tokenCountOf(gauge.tokens)} of ${tokenCountOf(gauge.windowTokens)} tokens · ${percentOf(gauge.tokens, gauge.windowTokens)}%`;

/** A cost marked as the owner should read it: `$1.20` as the harness reported it, `≈ $1.20` when any of it is estimated; null when nothing is priced. */
export const costTextOf = (consumption: Pick<Consumption, "estimated" | "reported">) => {
  const total = consumption.reported + consumption.estimated;
  if (total <= 0) return null;
  // A cost under half a cent would read $0.00, as if nothing was spent.
  const amount = total < 0.005 ? "< $0.01" : `$${total.toFixed(2)}`;
  return `${consumption.estimated > 0 ? "≈ " : ""}${amount}`;
};

/** How much of a cost was reported and how much estimated, and which turns have no price; empty when nothing says more. */
export const consumptionDetailsOf = (consumption: Consumption) =>
  [
    ...(consumption.reported > 0 && consumption.estimated > 0 ? [`$${consumption.reported.toFixed(2)} reported`] : []),
    ...(consumption.reported > 0 && consumption.estimated > 0
      ? [`≈ $${consumption.estimated.toFixed(2)} estimated`]
      : []),
    ...(consumption.unpricedTurns > 0 ? [`${countedOf(consumption.unpricedTurns, "turn")} without a price`] : []),
    ...(consumption.earlierTurns > 0 ? [`${countedOf(consumption.earlierTurns, "earlier turn")} not priced`] : []),
  ].join(" · ");

/** Every token a set of turns used, of every kind. */
export const totalTokensOf = (consumption: Pick<Consumption, "tokens">) =>
  consumption.tokens.input +
  consumption.tokens.output +
  consumption.tokens.cacheRead +
  consumption.tokens.cacheCreation;

/**
 * An account's budget in one line, for example "$12.50 of $50.00 · $37.50 left · counted by Iskios"; what is left of a cost
 * is marked with ≈ when some of the spending was estimated, and the line says Iskios only counts its own turns.
 */
export const accountBudgetTextOf = (
  budget: Pick<AccountBudget, "consumption" | "limits" | "period" | "remaining" | "spent">,
) => {
  const periodWords = { Day: "today", Month: "this month", Week: "this week" } as const;
  const when = budget.period === null ? "" : ` ${periodWords[budget.period]}`;
  const parts = [
    ...(budget.limits.cost === null || budget.remaining.cost === null
      ? []
      : [
          `${budgetUseTextOf("cost", budget.spent.cost, budget.limits.cost)} · ${budget.consumption.estimated > 0 ? "≈ " : ""}$${budget.remaining.cost.toFixed(2)} left${when}`,
        ]),
    ...(budget.limits.tokens === null || budget.remaining.tokens === null
      ? []
      : [
          `${budgetUseTextOf("tokens", budget.spent.tokens, budget.limits.tokens)} · ${Math.round((budget.remaining.tokens / budget.limits.tokens) * 100)}% left${when}`,
        ]),
  ];
  return `${parts.length === 0 ? "No budget" : parts.join(" · ")} · counted by Iskios`;
};

const clockTextOf = (at: number) => new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** The line under an agent reply, for example "1,240 tokens · ≈ $0.02"; the cost only when a price is known. */
export const replyUsageTextOf = (usage: ReplyUsage) => {
  const cost = costTextOf({ estimated: usage.estimated ?? 0, reported: usage.reported ?? 0 });
  const tokens = usage.tokens.input + usage.tokens.output + usage.tokens.cacheRead + usage.tokens.cacheCreation;
  return `${tokenCountOf(tokens)} tokens${cost === null ? "" : ` · ${cost}`}`;
};

/** A plan limit in words, for example "5-hour · 40% used · resets 19:30". */
export const planLimitTextOf = (window: PlanLimitWindow) =>
  `${window.label} · ${Math.round(window.usedPercent)}% used · resets ${clockTextOf(window.resetsAt)}`;

/** A plan's limits on one line, for example "5-hour 40% · Weekly 93% · as of 14:02"; none are never guessed. */
export const planLimitsSummaryOf = (reading: PlanLimitReading | null) =>
  reading === null || reading.windows.length === 0
    ? "Limits not reported"
    : `${reading.windows.map((window) => `${window.label} ${Math.round(window.usedPercent)}%`).join(" · ")} · as of ${clockTextOf(reading.readAt)}`;

/** Where the price table in use came from, for example "Prices from models.dev · fetched 10 Nov". */
export const priceStatusTextOf = (status: PriceStatus) => {
  const day = new Date(status.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return status.source === "Fetched" ? `Prices from models.dev · fetched ${day}` : `Prices from the snapshot of ${day}`;
};

/** What a set of turns used in one line, for example "12,000 tokens · ≈ $1.20"; the cost only when a turn is priced. */
export const usedTextOf = (consumption: Consumption) => {
  const cost = costTextOf(consumption);
  return `${tokenCountOf(totalTokensOf(consumption))} tokens${cost === null ? "" : ` · ${cost}`}`;
};

/** What a thread alone used, for example "3 turns · ≈ $1.50 · 12,000 tokens"; the cost and tokens are left out when there are none. */
export const threadSpendingTextOf = (panel: Pick<ThreadPanel, "consumption">) => {
  const cost = costTextOf(panel.consumption);
  const tokens = totalTokensOf(panel.consumption);
  return [
    countedOf(panel.consumption.turns, "turn"),
    ...(cost === null ? [] : [cost]),
    ...(tokens > 0 ? [`${tokenCountOf(tokens)} tokens`] : []),
  ].join(" · ");
};

/** A limit's use in short words, for example "$1.20 of $5.00" or "12,000 of 50,000 tokens". */
export const budgetUseTextOf = (unit: "cost" | "tokens", spent: number, limit: number) =>
  unit === "cost"
    ? `$${spent.toFixed(2)} of $${limit.toFixed(2)}`
    : `${tokenCountOf(spent)} of ${tokenCountOf(limit)} tokens`;

/**
 * What a limit leaves, for the rail's Reserves: the cost's remaining dollars, the tokens' remaining share, and the share
 * of the limit still left (0 to 1) for the bar. Spending past a limit leaves nothing.
 */
export const reserveOf = (unit: "cost" | "tokens", spent: number, limit: number) => {
  const left = Math.max(0, limit - spent);
  return {
    fraction: limit > 0 ? left / limit : 0,
    text: unit === "cost" ? `$${left.toFixed(2)} left` : `${Math.round((limit > 0 ? left / limit : 0) * 100)}% left`,
  };
};

/** The limits raised by a factor, for the quick raises (+25%, +50%, double); an empty limit stays empty. */
export const raisedLimitsOf = (limits: BudgetLimits, factor: number): BudgetLimits => ({
  cost: limits.cost === null ? null : Math.round(limits.cost * factor * 100) / 100,
  tokens: limits.tokens === null ? null : Math.ceil(limits.tokens * factor),
});

/** What a thread's change to lore does, for example "Save lore to Global" (scoped-intel). */
export const loreActionOf = (change: Pick<LoreChange, "kind" | "previousText" | "scopeLabel" | "text">) => {
  const scope = scopeNameOf(change.scopeLabel);
  const actions = {
    Forget: `Delete lore from ${scope}`,
    Replace: `Replace lore in ${scope}`,
    Save: `Save lore to ${scope}`,
    // An update that keeps the text only moves the lore.
    Update: change.previousText === change.text ? `Move lore to ${scope}` : `Correct lore in ${scope}`,
  } satisfies Record<LoreChange["kind"], string>;
  return actions[change.kind];
};

/** What a lore entry rests on, for the panel, for example "From journal entry 4: Chose Effect."; null when none. */
export const loreOriginLabelOf = (origin: LoreOrigin | null) => {
  if (origin === null) return null;
  if (origin.kind === "JournalEntry") return `From journal entry ${origin.entryNumber ?? ""}: ${origin.excerpt}`;
  if (origin.from === null) return `From your message: ${origin.excerpt}`;
  return `From a message by "${origin.from}": ${origin.excerpt}`;
};

const loreStatusLabels = {
  Approved: " · approved",
  Awaiting: " · awaiting your approval",
  Declined: " · declined",
  Done: "",
} as const satisfies Record<LoreChangeStatus, string>;

/** A thread's change to lore as one line in its conversation, for example "Save lore to Global · approved". */
export const loreChangeLineOf = (
  change: Pick<LoreChange, "kind" | "previousText" | "scopeLabel" | "status" | "text">,
) => `${loreActionOf(change)}${loreStatusLabels[change.status]}`;

/** A share as a short percentage, "<0.1" for a share too small to show but not nothing. */
const percentOf = (part: number, whole: number) => {
  const percent = (part * 100) / whole;
  if (percent === 0) return "0";
  if (percent < 0.1) return "<0.1";
  return percent.toFixed(1);
};

/** The lore icon's text: the count and its share of the model's context window, for example "Lore · 3 · 0.2%". */
export const loreGaugeLabelOf = (gauge: Pick<LoreGauge, "count" | "tokens" | "windowTokens">) =>
  `Lore · ${loreGaugeValueOf(gauge)}`;

/** The lore gauge without its name, for example "3 · 0.2%". */
export const loreGaugeValueOf = (gauge: Pick<LoreGauge, "count" | "tokens" | "windowTokens">) =>
  `${gauge.count} · ${percentOf(gauge.tokens, gauge.windowTokens)}%`;

/** How often threads used a lore entry, for example "used 3 times". */
const usesLabelOf = (uses: number) => {
  if (uses === 0) return "not used yet";
  if (uses === 1) return "used once";
  return `used ${uses} times`;
};

/** A lore entry's fading in the panel, for example "Preference · active · strength 82% · used 3 times · pinned". */
export const loreFadingLabelOf = (loreEntry: Pick<LoreEntry, "isPinned" | "kind" | "state" | "strength" | "uses">) =>
  [
    loreEntry.kind,
    loreEntry.state.toLowerCase(),
    `strength ${Math.round(loreEntry.strength * 100)}%`,
    usesLabelOf(loreEntry.uses),
    ...(loreEntry.isPinned ? ["pinned"] : []),
  ].join(" · ");

const loreHistoryVerbs = {
  Archived: "Became archived",
  Corrected: "Corrected",
  Deleted: "Deleted",
  Dormant: "Became dormant",
  Edited: "Edited",
  Merged: "Merged into one global lore entry",
  Narrowed: "Moved",
  Pinned: "Pinned",
  Replaced: "Replaced by a save",
  Restored: "Restored",
  Saved: "Saved",
  Undone: "Undid",
  Unpinned: "Unpinned",
  Widened: "Moved",
} as const satisfies Record<LoreHistoryKind, string>;

/** Who made a change in a lore entry's history, as its line names them. */
const loreActorLabelOf = (entry: Pick<LoreHistoryEntry, "actor" | "actorTitle">) => {
  const actors = {
    Fading: "fading",
    Owner: "you",
    Thread: `"${entry.actorTitle ?? "a quest"}"`,
  } satisfies Record<LoreHistoryEntry["actor"], string>;
  return actors[entry.actor];
};

/** What a change in a lore entry's history did and who did it, for example "Widened to Global by you". */
const loreHistoryActionOf = (
  entry: Pick<LoreHistoryEntry, "actor" | "actorTitle" | "kind" | "scopeLabel" | "undid">,
) => {
  const verb = loreHistoryVerbs[entry.kind];
  const who = loreActorLabelOf(entry);
  if (entry.kind === "Undone") return `You undid: ${loreHistoryVerbs[entry.undid ?? "Saved"].toLowerCase()}`;
  if (entry.kind === "Replaced") return `${verb} from ${who}`;
  if (entry.kind === "Widened" || entry.kind === "Narrowed")
    return `${verb} to ${scopeNameOf(entry.scopeLabel)} by ${who}`;
  return `${verb} by ${who}`;
};

/**
 * One entry of a lore entry's history as a line in the panel, for example 'Saved by "Build" · approved by you',
 * "Became dormant by fading", or "You undid: deleted" (scoped-intel, History and undo).
 */
export const loreHistoryLineOf = (
  entry: Pick<LoreHistoryEntry, "actor" | "actorTitle" | "approvedAt" | "kind" | "scopeLabel" | "undid" | "undoneAt">,
) =>
  [
    loreHistoryActionOf(entry),
    ...(entry.approvedAt === null ? [] : ["approved by you"]),
    ...(entry.undoneAt === null ? [] : ["undone"]),
  ].join(" · ");

/**
 * Why the service proposes a widening or narrowing, and what approving it does, for example "Used only in
 * Workspace alpha for 45 days, 3 times: move it there" (scoped-intel, Widening and narrowing).
 */
export const loreProposalLineOf = (
  proposal: Pick<LoreProposal, "halfLifeDays" | "kind" | "scopeLabel" | "uses"> & {
    readonly loreEntries: ReadonlyArray<unknown>;
  },
) =>
  proposal.kind === "Widen"
    ? `Saved separately in ${proposal.loreEntries.length} realms: make it one global lore entry`
    : `Used only in ${scopeNameOf(proposal.scopeLabel)} for ${proposal.halfLifeDays ?? 0} days, ${
        proposal.uses === 1 ? "once" : `${proposal.uses ?? 0} times`
      }: move it there`;

/** Renames a service-generated scope prefix while preserving the owner's title verbatim. */
export const scopeNameOf = (label: string) =>
  label.replace(
    /^(Mission|Thread|Workspace)(?= |$)/,
    (term) => ({ Mission: "Quest", Thread: "Side-quest", Workspace: "Realm" })[term] ?? term,
  );
