import { RitualScope as RitualScopeSchema, Settings } from "@iskios/contracts";
import { Context, Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { readSettings, type ToolAnswer } from "../core/index.ts";
import { isNamedByOwner, type NamedAction } from "../policy/index.ts";
import type { Approvals } from "./approvals.ts";
import { previewEnding, readWorkingIds } from "./ending.ts";
import { findRealm, isGuildmasterThread } from "./guildmaster.ts";
import { fallbackNoteOf, ritualStartOf } from "./guildmasterCompanions.ts";
import { changeableSettings } from "./guildmasterSettings.ts";
import { checkRealmCreation, checkRealmRename } from "./realmChecks.ts";
import { coveringEntryOf, type ScopedAction } from "./ritualScope.ts";
import type { ArgumentsOf } from "./threadTools.ts";
import { titleOf } from "./titles.ts";

// Structural actions by provenance (CHG-0208), replacing the quoted-words check and the one-click guards. The service
// derives the operation, its resolved target and its new value from the tool call. The authority comes from the owner:
// their own message of the current turn naming that action exactly, or a Ritual's reviewed scope during one of its
// runs; otherwise one exact question, Allow or Deny. The model supplies no evidence, and agent-written text (thread
// messages, reports, a Ritual's run message) is never the owner's.

/** The tools that change the app's structure, each derived and authorized here before it runs. */
export type StructuralTool = "act_on_mission" | "change_setting" | "create_realm" | "rename_realm" | "create_ritual";

/** A structural action as the service derived it from a tool call. */
interface DerivedAction {
  readonly details: string;
  /** Everything the action depends on, compared again when it runs: the turn, the target, the threads at work. */
  readonly fingerprint: string;
  /** Whether it must be asked whatever the owner wrote: an ending that would stop threads at work. */
  readonly mustAsk: boolean;
  /** How the owner would name it: operation, target names, new value, and rival targets of the same kind. */
  readonly named: NamedAction;
  /** How a Ritual's scope entry would name it, or null when no scope can cover it. */
  readonly scoped: ScopedAction | null;
  /** The exact action and target, as the question and the record show it. */
  readonly summary: string;
}

const runningTurnOf = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [turn] = yield* sql<{ id: string }>`SELECT id FROM turns
      WHERE thread_id = ${threadId} AND status = 'running' ORDER BY started_at DESC, rowid DESC LIMIT 1`;
    return turn?.id ?? null;
  });

/** The Ritual whose quest's top thread this is, with its reviewed scope; null for any other thread. */
const ritualOfThread = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ authority: string }>`
      SELECT r.authority FROM rituals r JOIN missions m ON m.id = r.mission_id WHERE m.top_thread_id = ${threadId}`;
    return row === undefined ? null : { scope: Schema.decodeUnknownSync(RitualScopeSchema)(JSON.parse(row.authority)) };
  });

/**
 * Whether the thread may take a structural action at all: Iskios always; a Ritual's own thread only for acting on a
 * quest or changing a setting, which its scope can cover. Any other thread is refused by the tool itself.
 */
export const isStructuralCaller = (threadId: string, tool: StructuralTool) =>
  Effect.gen(function* () {
    if (yield* isGuildmasterThread(threadId)) return true;
    if (tool !== "act_on_mission" && tool !== "change_setting") return false;
    return (yield* ritualOfThread(threadId)) !== null;
  });

/**
 * The texts of the owner's own messages delivered to the thread's running turn. A message from another thread, an
 * agent's reply, and the service's message that starts a Ritual's run are never among them.
 */
const ownerTextsOf = (threadId: string, turnId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ text: string }>`
      SELECT m.text FROM messages m
      WHERE m.thread_id = ${threadId} AND m.delivered_turn_id = ${turnId}
        AND m.sender_kind = 'user' AND m.sender_thread_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM ritual_run_messages r WHERE r.message_id = m.id)`;
    return rows.map((row) => row.text);
  });

/** Whether the running turn is one of the Ritual's runs: its service-made run message was delivered to it. */
const isRitualRunTurn = (threadId: string, turnId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string }>`
      SELECT m.id FROM messages m JOIN ritual_run_messages r ON r.message_id = m.id
      WHERE m.thread_id = ${threadId} AND m.delivered_turn_id = ${turnId} LIMIT 1`;
    return rows.length > 0;
  });

/** A value as the owner would write it: a text without its JSON quotes, anything else as JSON. */
const spokenOf = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));

const jsonOf = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const threadsLineOf = (count: number) => (count === 1 ? "1 thread" : `${count} threads`);

/** `act_on_mission` as a structural action: the quest by its id, and what Stop or an ending would stop. */
const deriveQuestAction = (args: ArgumentsOf<"act_on_mission">) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [quest] = yield* sql<{ id: string; title: string; ending: string | null }>`
      SELECT m.id, m.title, m.ending FROM missions m JOIN threads top ON top.id = m.top_thread_id
      WHERE m.id = ${args.mission} AND m.is_guildmaster = 0 AND top.is_deleting = 0`;
    if (quest === undefined) return null;
    const rivals = (yield* sql<{ title: string }>`
      SELECT title FROM missions WHERE is_guildmaster = 0 AND id <> ${quest.id}`).map((row) => row.title);
    const targets = [quest.title];
    const scopeTargets = [quest.id, quest.title];
    if (args.action === "Rename") {
      const title = titleOf(args.title ?? "");
      if (title === "") return null;
      return {
        mustAsk: false,
        named: { operation: "Rename", rivals, targets, value: title },
        scoped: { operation: "Rename", payload: title, targets: scopeTargets },
        state: { quest },
        summary: `Rename the quest "${quest.title}" to "${title}".`,
      } as const;
    }
    if (args.action === "Stop") {
      const ids = yield* readWorkingIds(quest.id).pipe(Effect.catchTag("ServiceFailure", () => Effect.succeed([])));
      if (ids.length === 0) return null;
      return {
        mustAsk: false,
        named: { operation: "Stop", rivals, targets, value: null },
        scoped: { operation: "Stop", payload: null, targets: scopeTargets },
        state: { ids, quest },
        summary: `Stop the ${threadsLineOf(ids.length)} at work in the quest "${quest.title}".`,
      } as const;
    }
    const ending = args.action === "Done" ? "Done" : "Archived";
    const preview = yield* previewEnding(quest.id, ending).pipe(
      Effect.catchTag("ServiceFailure", () => Effect.succeed(null)),
    );
    if (preview === null) return null;
    const what =
      args.action === "Done" ? `Mark the quest "${quest.title}" Done.` : `Archive the quest "${quest.title}".`;
    return {
      mustAsk: preview.question !== null,
      named: { operation: args.action, rivals, targets, value: null },
      scoped: { operation: args.action, payload: null, targets: scopeTargets },
      state: { quest, snapshot: preview.snapshot },
      // Stopping threads at work is part of it: always one question, bound to the threads it names.
      summary: preview.question === null ? what : `${what} ${preview.question}`,
    } as const;
  });

/** Derives the structural action a tool call would take; null when the tool's own checks will refuse it. */
const deriveAction = (callerId: string, tool: StructuralTool, args: object) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (!(yield* isStructuralCaller(callerId, tool))) return null;
    const turnId = yield* runningTurnOf(callerId);
    if (turnId === null) return null;
    const base = { args, callerId, tool, turnId };
    const finish = (found: {
      readonly named: NamedAction;
      readonly scoped: ScopedAction | null;
      readonly state: unknown;
      readonly summary: string;
      readonly mustAsk: boolean;
      readonly details?: object;
    }): DerivedAction => ({
      details: JSON.stringify({ action: found.named.operation, ...(found.details ?? {}), state: found.state }, null, 2),
      fingerprint: JSON.stringify({ ...base, state: found.state }),
      mustAsk: found.mustAsk,
      named: found.named,
      scoped: found.scoped,
      summary: found.summary,
    });
    if (tool === "act_on_mission") {
      const found = yield* deriveQuestAction(args as ArgumentsOf<"act_on_mission">);
      return found === null ? null : finish(found);
    }
    if (tool === "change_setting") {
      const { setting, value: text } = args as ArgumentsOf<"change_setting">;
      if (!(changeableSettings as ReadonlyArray<string>).includes(setting)) return null;
      const value = jsonOf(text);
      if (value === undefined) return null;
      const before = yield* readSettings;
      if (Schema.decodeUnknownExit(Settings)({ ...before, [setting]: value })._tag === "Failure") return null;
      const was = before[setting as keyof typeof before];
      return finish({
        mustAsk: false,
        named: { operation: "ChangeSetting", targets: [setting], value: spokenOf(value) },
        scoped: { operation: "ChangeSetting", payload: JSON.stringify(value), targets: [setting] },
        state: { before: was, setting, value },
        summary: `Change the setting ${setting} from ${JSON.stringify(was)} to ${JSON.stringify(value)}.`,
      });
    }
    if (tool === "create_realm") {
      const checked = yield* checkRealmCreation(args as ArgumentsOf<"create_realm">);
      // What the tool would refuse is never put to the owner as a question: it refuses it with its own reason.
      if (checked._tag === "Refused") return null;
      const existing = yield* sql`SELECT id, name, path FROM workspaces
        WHERE lower(name) = lower(${checked.name}) OR path = ${checked.real ?? ""} ORDER BY id`;
      return finish({
        mustAsk: false,
        named: { operation: "CreateRealm", targets: [checked.name], value: checked.folder },
        scoped: null,
        state: { existing, folder: checked.real, name: checked.name },
        summary: `Make the realm "${checked.name}", ${checked.real === null ? "tied to no folder" : `tied to ${checked.real}`}.`,
      });
    }
    if (tool === "rename_realm") {
      const checked = yield* checkRealmRename(args as ArgumentsOf<"rename_realm">);
      if (checked._tag === "Refused") return null;
      const { name, realm: found } = checked;
      const rivals = (yield* sql<{ name: string }>`SELECT name FROM workspaces WHERE id <> ${found.id}`).map(
        (row) => row.name,
      );
      return finish({
        mustAsk: false,
        named: {
          operation: "RenameRealm",
          rivals,
          targets: [found.name, ...(found.path === null ? [] : [found.path])],
          value: name,
        },
        scoped: null,
        state: { name, realm: found },
        summary: `Rename the realm "${found.name}" to "${name}".`,
      });
    }
    const ritual = args as ArgumentsOf<"create_ritual">;
    const title = titleOf(ritual.title).slice(0, 80);
    if (ritual.instruction.trim() === "" || title === "") return null;
    const realm = ritual.realm === undefined || ritual.realm.trim() === "" ? null : yield* findRealm(ritual.realm);
    if (ritual.realm !== undefined && ritual.realm.trim() !== "" && realm === null) return null;
    const { companion, fallbacks } = ritualStartOf(yield* readSettings, ritual);
    const where = realm === null ? "with no realm" : `in the realm ${realm.name}`;
    return finish({
      details: { companion, fallbacks, instruction: ritual.instruction, schedule: ritual.schedule },
      mustAsk: false,
      named: { operation: "CreateRitual", targets: [title], value: null },
      scoped: null,
      state: { companion, realm, title },
      summary: `Create the Ritual "${title}", ${JSON.stringify(ritual.schedule)}, ${where}, on ${companion.harness} ${companion.model}${fallbackNoteOf(fallbacks, ritual.tier)}.`,
    });
  });

/** Where the authority for a derived action comes from, or that the owner must be asked. */
type Authority =
  | { readonly _tag: "Owner"; readonly evidence: string }
  | { readonly _tag: "Scope"; readonly evidence: string }
  | { readonly _tag: "Ask" };

const clip = (text: string, length: number) => (text.length <= length ? text : `${text.slice(0, length - 1)}…`);

/** The owner's own words of this turn naming the action exactly, or the Ritual's reviewed scope in a run; else ask. */
const authorityOf = (callerId: string, derived: DerivedAction) =>
  Effect.gen(function* () {
    const turnId = yield* runningTurnOf(callerId);
    if (turnId === null || derived.mustAsk) return { _tag: "Ask" } satisfies Authority;
    const named = (yield* ownerTextsOf(callerId, turnId)).find((text) => isNamedByOwner(text, derived.named));
    if (named !== undefined) return { _tag: "Owner", evidence: clip(named, 400) } satisfies Authority;
    if (derived.scoped !== null) {
      const ritual = yield* ritualOfThread(callerId);
      if (ritual !== null && (yield* isRitualRunTurn(callerId, turnId))) {
        const entry = coveringEntryOf(ritual.scope, derived.scoped);
        if (entry !== null)
          return {
            _tag: "Scope",
            evidence: `The Ritual's reviewed scope: ${entry.operation} ${entry.target}${entry.payload === null ? "" : ` → ${entry.payload}`}`,
          } satisfies Authority;
      }
    }
    return { _tag: "Ask" } satisfies Authority;
  });

/** The one-use proof, handed only to this invocation, that its exact action was authorized. */
interface Receipt {
  readonly fingerprint: string;
  isUsed: boolean;
  readonly key: string;
}

// Only the fiber that ran the authorization holds it; tool arguments cannot make one.
const receiptReference = Context.Reference<Receipt | null>("iskios/StructuralReceipt", { defaultValue: () => null });
const keyOf = (callerId: string, tool: StructuralTool, args: object) => JSON.stringify([callerId, tool, args]);

/**
 * Spends this invocation's receipt inside the mutation's transaction, after deriving the action again: a changed turn,
 * target, value, or set of threads at work means it no longer matches what was authorized, and nothing runs.
 */
export const consumeReceipt = (callerId: string, tool: StructuralTool, args: object) =>
  Effect.gen(function* () {
    const receipt = yield* receiptReference;
    if (receipt === null || receipt.isUsed || receipt.key !== keyOf(callerId, tool, args)) return false;
    receipt.isUsed = true;
    const now = yield* deriveAction(callerId, tool, args).pipe(Effect.orDie);
    return now !== null && now.fingerprint === receipt.fingerprint;
  });

/** What a structural tool says when its action was not authorized, or changed before it could run. */
export const notAuthorizedText =
  "Not done: the owner did not authorize this exact action, or its quest, realm, setting, turn, or threads at work changed meanwhile. Nothing was changed.";

/**
 * Authorizes one structural tool call by provenance, outside any transaction, then runs it with a one-use receipt.
 * A call whose action cannot be derived runs without one, so the tool's own checks refuse it with their reason.
 */
export const withProvenance = (
  approvals: Approvals["Service"],
  read: <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) => Effect.Effect<A>,
  callerId: string,
  tool: StructuralTool,
  args: object,
  run: (authorize: <A, E, R>(work: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>) => Effect.Effect<ToolAnswer>,
) =>
  Effect.gen(function* () {
    const derived = yield* read(deriveAction(callerId, tool, args));
    if (derived === null) return yield* run((work) => work);
    const authority = yield* read(authorityOf(callerId, derived));
    if (authority._tag === "Ask") {
      const decision = yield* approvals.confirmAction(callerId, derived.summary, derived.details);
      if (!decision.isAllowed) return { isError: true, text: decision.text } satisfies ToolAnswer;
    }
    const receipt: Receipt = { fingerprint: derived.fingerprint, isUsed: false, key: keyOf(callerId, tool, args) };
    const answer = yield* run((work) => Effect.provideService(work, receiptReference, receipt));
    // A tool that reports success without spending the receipt changed something its authorization never covered: a
    // defect in the tool, which no caller can recover from.
    if (!answer.isError && !receipt.isUsed)
      return yield* Effect.die(new Error(`${tool} succeeded without spending its authorization receipt.`));
    if (!answer.isError && authority._tag !== "Ask")
      yield* approvals.recordDecision(
        callerId,
        derived.summary,
        derived.details,
        authority._tag === "Owner" ? "AllowedByMessage" : "AllowedByPermission",
        authority.evidence,
      );
    return answer;
  });
