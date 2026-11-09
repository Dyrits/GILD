import type { ApprovalLevel, EffortChoice, HarnessName, ModelChoice, TokenUsage } from "@gild/contracts";
import { Context, Effect, Schema } from "effect";

/** What a harness reports while a turn runs. */
export type HarnessEvent =
  /** A complete assistant message, to be saved. */
  | {
      readonly _tag: "Reply";
      /** The model that wrote it as the harness names it (such as `claude-sonnet-5-5`), when it reports one. */
      readonly model?: string | null;
      readonly text: string;
    }
  /** The assistant message written so far, never saved. */
  | { readonly _tag: "Draft"; readonly text: string }
  /** A message steered into the running turn was taken in by it (CHG-0039). */
  | { readonly _tag: "Delivered"; readonly messageId: string };

/** A message to steer into a thread's running turn, by its identifier. */
export interface SteeredMessage {
  readonly id: string;
  readonly text: string;
}

/** What a thread may use in a turn, and how its actions are approved (CHG-0031). */
export interface ThreadAccess {
  readonly approvalLevel: ApprovalLevel;
  /** Whether the thread works in a workspace, whose sandbox may fetch dependencies (CHG-0034). */
  readonly isInWorkspace: boolean;
  /** The thread's own MCP endpoint serving the thread tools, and Claude Code's permission prompt tool (ADR 0005). */
  readonly mcpUrl: string;
  /** The sentences of the standing permissions that apply to the thread. */
  readonly permissions: ReadonlyArray<string>;
}

/** One action a harness asks permission for, named as Claude Code names its tools (`Bash`, `Edit`, …). */
export interface HarnessPrompt {
  readonly input: unknown;
  readonly toolName: string;
}

/** The owner's answer to a harness prompt: whether the action may run, and what to tell the harness otherwise. */
export interface PromptAnswer {
  readonly isAllowed: boolean;
  readonly text: string;
}

/** Everything one turn of a thread needs from Gild. */
export interface TurnRequest {
  readonly access: ThreadAccess;
  /**
   * Asks the owner, through Approvals, about one action the harness wants to run, waiting with no time limit
   * (action-approval). A failure to answer ends the turn.
   */
  readonly askOwner: (prompt: HarnessPrompt) => Effect.Effect<PromptAnswer, HarnessFailure>;
  /**
   * The provider account's own folder, where the harness keeps its sign-in and sessions, or null for the
   * harness's own sign-in on this computer (provider-accounts).
   */
  readonly configDirectory: string | null;
  /** The starting context: the thread's workspace, or its scratch folder, with the folder's own instructions. */
  readonly context: string;
  readonly cwd: string;
  readonly effort: EffortChoice;
  readonly harness: HarnessName;
  readonly model: ModelChoice;
  /**
   * What changes from turn to turn, such as the budget line, given with the turn's message rather than
   * in the starting context, so a change does not restart the harness; null when there is none.
   */
  readonly note: string | null;
  readonly onEvent: (event: HarnessEvent) => Effect.Effect<void>;
  /** The harness session to continue, or null for the thread's first turn. */
  readonly sessionId: string | null;
  readonly text: string;
  readonly threadId: string;
}

/** How a turn ended, with what it cost. */
export interface TurnOutcome {
  /**
   * What the thread's context held after the turn's latest model call (input, cached input, and output
   * tokens), for the context gauge (thread-panel); absent or null when the harness did not report it.
   */
  readonly context?: number | null;
  /**
   * The turn's API-key cost when the harness reports one; null counts the turn's tokens as subscription
   * spending (budget-control, Budgets; provisional, work-in-progress Batch 11).
   */
  readonly cost: number | null;
  /** Whether the turn ended because it was interrupted (thread-messaging, Interruptions). */
  readonly isInterrupted: boolean;
  readonly sessionId: string;
  /** Null when the harness reported no usage; shown as unknown, never guessed. */
  readonly usage: TokenUsage | null;
}

/** How long a harness has to end an interrupted turn before its process is closed (CHG-0039, provisional). */
export const interruptGraceMillis = 10_000;

/** The outcome of an interrupted turn: its usage when the harness reported any, and never a cost. */
export const interruptedOutcomeOf = (sessionId: string, usage: TokenUsage | null = null): TurnOutcome => ({
  cost: null,
  isInterrupted: true,
  sessionId,
  usage,
});

/** A turn the harness could not run, with the reason the owner reads. */
export class HarnessFailure extends Schema.TaggedError<HarnessFailure>()("HarnessFailure", { reason: Schema.String }) {}

/** What one harness adapter offers: one turn of a thread at a time, which can be steered and interrupted. */
export interface HarnessAdapter {
  /** Ends the thread's running turn, whose `runTurn` then returns as interrupted; false when none runs. */
  readonly interrupt: (threadId: string) => Effect.Effect<boolean>;
  readonly runTurn: (request: TurnRequest) => Effect.Effect<TurnOutcome, HarnessFailure>;
  /**
   * Writes a message into the thread's running turn; false when no turn runs or the harness cannot take one
   * mid-turn. Its `Delivered` event follows once the turn takes it in; one not taken in by the turn's end is
   * left for the next turn.
   */
  readonly steer: (threadId: string, message: SteeredMessage) => Effect.Effect<boolean>;
}

/** The harness seam: runs one turn of a thread, reports its events, and lets it be steered and interrupted. */
export class Harness extends Context.Service<Harness, HarnessAdapter>()("gild/Harness") {}

/**
 * Sends each turn to the adapter of its thread's harness, and steering and interrupts to the adapter running
 * that thread's turn (provider-accounts).
 */
export const routeHarnesses = (adapters: Record<HarnessName, HarnessAdapter>): HarnessAdapter => {
  const running = new Map<string, HarnessAdapter>();
  return {
    interrupt: (threadId) => running.get(threadId)?.interrupt(threadId) ?? Effect.succeed(false),
    runTurn: (request) =>
      Effect.suspend(() => {
        const adapter = adapters[request.harness];
        running.set(request.threadId, adapter);
        return adapter.runTurn(request);
      }).pipe(Effect.ensuring(Effect.sync(() => running.delete(request.threadId)))),
    steer: (threadId, message) => running.get(threadId)?.steer(threadId, message) ?? Effect.succeed(false),
  };
};

/** The turn's message as the harness receives it: the note (journal, lore, budget) first, set off from the messages. */
export const turnMessageOf = (request: TurnRequest) =>
  request.note === null ? request.text : `${request.note}\n\n---\n\n${request.text}`;
