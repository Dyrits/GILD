import { EffortChoice, HarnessName, ModelChoice, RitualSchedule, TierName } from "@iskios/contracts";
import { Effect, Exit, Schema } from "effect";
import type { ToolAnswer } from "../core/index.ts";
import { latestEntryCount, nothingToRecord } from "./journal.ts";

// Stored and wire names keep `intel` so existing data and agents still work: thread tool names (`save_intel`, ...).

// The thread tool catalogue (ADR 0005; thread-tree, thread-messaging, mission-journal, mission-tracking,
// action-approval External contracts): each tool is defined once, by its name, description, and argument
// schema. Its MCP listing, its argument decoding, and the list Claude Code runs without asking all come
// from that one definition; the tool server carries the calls, and domain modules answer them typed.

const text = (description: string) => Schema.String.annotate({ description });
const optionalText = (description: string) => Schema.optionalKey(text(description));
const optionalWhole = (description: string) => Schema.optionalKey(Schema.Int.annotate({ description }));

const definitionOf = <S extends Schema.ConstraintDecoder<unknown> & Schema.Top>(definition: {
  readonly description: string;
  readonly schema: S;
  /** The answer to arguments that do not decode. */
  readonly invalid: ToolAnswer;
  /** Whether a thread uses it without asking the owner; false for the approval tools themselves. */
  readonly isUnasked: boolean;
}) => {
  const schema: Record<string, unknown> = Schema.toJsonSchemaDocument(definition.schema).schema;
  return {
    ...definition,
    // MCP asks every input schema to be an object schema, and Claude Code drops the whole listing when one is
    // not. A struct with no fields encodes as `{ "not": { "type": "null" } }`, so it is written out here.
    inputSchema: schema.type === "object" ? schema : { properties: {}, type: "object" },
  };
};

const invalid = (text: string): ToolAnswer => ({ isError: true, text });

const ToolScope = Schema.Literals(["thread", "mission", "workspace", "global"]);
const ToolKind = Schema.Literals(["rule", "preference", "decision", "fact", "temporary"]);
const kindHelp =
  "rule: an instruction to follow, never fades; preference: how the owner likes things; decision: a settled choice; fact: how things are; temporary: true for days only.";

/** The answer to a `search_intel` call with neither query nor ids. */
export const searchInvalid = invalid(
  "Invalid arguments: give query, ids, or both, and optionally scope (thread, mission, workspace, or global).",
);
const scopeHelp =
  "thread: you and the threads beneath you; mission: every thread of this mission; workspace: every thread in this folder, in any mission; global: everywhere, after the owner's approval.";

/** Every thread tool, by name. */
export const threadTools = {
  act_on_mission: definitionOf({
    description:
      "Only Iskios uses it, and only because the owner asked in their latest message: stop a quest's threads, mark it Done, archive it, or rename it. Pass the owner's exact words asking for it as quote; Iskios checks them. When threads are still running, marking Done or archiving first answers with the question to put to the owner; when they agree in their next message, call again with the same arguments, the snapshot you were given, and their words as quote.",
    invalid: invalid("Invalid arguments: give mission, action (Stop, Done, Archive, or Rename), and quote."),
    isUnasked: true,
    schema: Schema.Struct({
      action: Schema.Literals(["Stop", "Done", "Archive", "Rename"]).annotate({
        description: "Stop: stop every thread at work in the quest. Done and Archive: end it. Rename: give it a title.",
      }),
      mission: text("The quest's id, from your context or find_missions."),
      quote: text("The owner's exact words from their latest message that ask for this, copied verbatim."),
      snapshot: optionalText("The snapshot a confirmation question gave, when the owner has agreed to it."),
      title: optionalText("For Rename: the new title."),
    }),
  }),
  answer_prompt: definitionOf({
    description: "Used by Claude Code itself to answer permission prompts. Never call it yourself.",
    // Claude Code reads the decision from the text, so an invalid prompt is denied, not an error.
    invalid: { isError: false, text: JSON.stringify({ behavior: "deny", message: "Invalid permission prompt." }) },
    isUnasked: false,
    schema: Schema.Struct({
      input: Schema.Record(Schema.String, Schema.Unknown),
      tool_name: Schema.String,
      tool_use_id: Schema.optionalKey(Schema.String),
    }),
  }),
  change_setting: definitionOf({
    description:
      "Only Iskios uses it, and only because the owner asked in their latest message: change one of the owner's settings (read_settings lists them). The approval level, the budgets, and price fetching are the owner's alone and are refused. Pass the owner's exact words asking for it as quote; Iskios checks them.",
    invalid: invalid("Invalid arguments: give setting, value, and quote."),
    isUnasked: true,
    schema: Schema.Struct({
      quote: text("The owner's exact words from their latest message that ask for this, copied verbatim."),
      setting: text("The setting's name, as read_settings gives it, for example shouldShowFinishedQuests."),
      value: text(
        'The new value as JSON text, whole and in the shape read_settings shows for that setting, for example true, 14, "Steer", or {"cost":null,"tokens":null}.',
      ),
    }),
  }),
  create_realm: definitionOf({
    description:
      "Only Iskios uses it, and only because the owner asked in their latest message: make a realm, tied to a folder or to none. Pass the owner's exact words asking for it as quote; Iskios checks them.",
    invalid: invalid("Invalid arguments: give name and quote; folder is optional."),
    isUnasked: true,
    schema: Schema.Struct({
      folder: optionalText(
        "The folder's full path, when the realm is tied to a folder; left out for a realm tied to none.",
      ),
      name: text("The realm's name, at most 80 characters."),
      quote: text("The owner's exact words from their latest message that ask for this, copied verbatim."),
    }),
  }),
  create_ritual: definitionOf({
    description:
      "Only Iskios uses it. Create a Ritual: an instruction that runs by itself on a schedule, in a quest of its own, for anything the owner wants done repeatedly (every hour, every morning, weekly). Use it, not a quest, for a repeating request. Pick the preset that fits; there is no cron. Check the Rituals in your context first, so the same one is not made twice. The Ritual starts on and runs when next due.",
    invalid: invalid(
      "Invalid arguments: give instruction, title, and schedule (Daily, Weekdays, Weekly, Monthly, or Hourly).",
    ),
    isUnasked: true,
    schema: Schema.Struct({
      effort: Schema.optionalKey(
        EffortChoice.annotate({ description: "How hard each run works. Yours when left out." }),
      ),
      harness: Schema.optionalKey(HarnessName.annotate({ description: "The harness. Yours when left out." })),
      instruction: text("What each run does, complete enough to act on: a run sees none of your conversation."),
      model: Schema.optionalKey(ModelChoice.annotate({ description: "The model. Yours when left out." })),
      realm: optionalText("The name or folder of one of the realms in your context, when each run works there."),
      schedule: RitualSchedule.annotate({
        description:
          'When it runs, in the computer\'s local time, for example {"_tag":"Hourly","hours":1}, {"_tag":"Daily","time":"07:00"}, {"_tag":"Weekly","day":1,"time":"09:00"} (day 0 is Sunday), {"_tag":"Monthly","day":1,"time":"08:00"}, or {"_tag":"Weekdays","time":"08:30"}.',
      }),
      tier: Schema.optionalKey(
        TierName.annotate({
          description:
            "How demanding the work is, as the owner set their Companions for it: Light (small, well-scoped, checkable), Balanced (ordinary work), Heavy (ambiguous, architectural, or risky). Left out, the default Companion; a tier the owner did not set also falls back to it.",
        }),
      ),
      title: text("A short title of a few words, at most 80 characters."),
    }),
  }),
  find_missions: definitionOf({
    description:
      "Find other missions that may fit an off-topic request, by their titles and briefings: up to 3, best first, with their ids, states, and briefings.",
    invalid: invalid("Invalid arguments: give request."),
    isUnasked: true,
    schema: Schema.Struct({ request: text("The off-topic part of the owner's message.") }),
  }),
  forget_intel: definitionOf({
    description:
      "Delete a lore entry that no longer holds, by its id. Thread and workspace lore go at once; deleting a global lore entry waits for the owner's approval.",
    invalid: invalid("Invalid arguments: give id."),
    isUnasked: true,
    schema: Schema.Struct({ id: text("The lore entry's id, as your context or search_intel gives it.") }),
  }),
  interrupt_thread: definitionOf({
    description:
      "Interrupt a running thread directly beneath you, by its id: its current turn ends and it waits for a message. Use it when its work is no longer needed or must change course; then message it with what to do instead.",
    invalid: invalid("Invalid arguments: give thread."),
    isUnasked: true,
    schema: Schema.Struct({ thread: text("The id of the thread beneath you to interrupt.") }),
  }),
  open_thread: definitionOf({
    description:
      "Open a thread beneath you to work on one request on its own, in parallel with you. It starts with your request, in your working folder, with your harness, account, model, and effort unless you choose others, and reports its result to you as a message. Use it instead of subagents. A harness other than yours (claude for Claude Code, codex, opencode) runs on its own sign-in and default model unless you name one of its models.",
    invalid: invalid("Invalid arguments: give request."),
    isUnasked: true,
    schema: Schema.Struct({
      effort: Schema.optionalKey(
        EffortChoice.annotate({
          description: "How hard the new thread works, low to max; default is the harness's own. Yours when left out.",
        }),
      ),
      harness: Schema.optionalKey(
        HarnessName.annotate({
          description: "The harness the new thread runs on: claude, codex, or opencode. Yours when left out.",
        }),
      ),
      model: Schema.optionalKey(
        ModelChoice.annotate({
          description: "The new thread's model; default is the harness's own. Yours when left out.",
        }),
      ),
      request: text("Everything the new thread needs to know: it sees none of your conversation."),
      title: optionalText("A short title for the new thread, a few words, shown to the owner."),
    }),
  }),
  read_control_history: definitionOf({
    description:
      "Only Iskios uses it. Read your own older messages with the owner, newest first, when they ask about something said earlier, for example 'Remember what we did about X?'.",
    invalid: invalid("Invalid arguments: query is text; before and count are whole numbers."),
    isUnasked: true,
    schema: Schema.Struct({
      before: optionalWhole("Only messages numbered below this one, to read older ones."),
      count: optionalWhole("How many messages, 10 by default, at most 40."),
      query: optionalText("Only messages that contain these words."),
    }),
  }),
  read_journal: definitionOf({
    description: `Read the mission's journal: the briefing of where the mission stands, its version, and change log entries. Without arguments it gives the ${latestEntryCount} latest entries.`,
    invalid: invalid("Invalid arguments: before and count are whole numbers."),
    isUnasked: true,
    schema: Schema.Struct({
      before: optionalWhole("Only entries numbered below this one, to read older entries."),
      count: Schema.optionalKey(
        Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)).annotate({
          description: `How many entries, ${latestEntryCount} by default.`,
        }),
      ),
      mission: optionalText(
        "The id of another quest whose journal to read: Iskios reads any; another thread only one the owner mentioned with @ in this turn.",
      ),
    }),
  }),
  read_settings: definitionOf({
    description:
      "Only Iskios uses it. Read the owner's settings as JSON, to answer a question about them or before you change one.",
    invalid: invalid("Invalid arguments: read_settings takes none."),
    isUnasked: true,
    schema: Schema.Struct({}),
  }),
  relied_on_intel: definitionOf({
    description:
      "Say that lore entries from your context shaped what you did, by their ids. Each counts as a use and keeps it from fading; only lore that really guided you counts.",
    invalid: invalid("Invalid arguments: give ids, at least one."),
    isUnasked: true,
    schema: Schema.Struct({
      ids: Schema.Array(Schema.String)
        .check(Schema.isMinLength(1))
        .annotate({ description: "The ids of the lore entries you relied on, as your context lists them." }),
    }),
  }),
  rename_realm: definitionOf({
    description:
      "Only Iskios uses it, and only because the owner asked in their latest message: rename a realm. Pass the owner's exact words asking for it as quote; Iskios checks them.",
    invalid: invalid("Invalid arguments: give realm, name, and quote."),
    isUnasked: true,
    schema: Schema.Struct({
      name: text("The realm's new name, at most 80 characters."),
      quote: text("The owner's exact words from their latest message that ask for this, copied verbatim."),
      realm: text("The name or folder of one of the realms listed in your context."),
    }),
  }),
  report_result: definitionOf({
    description:
      "When your work is done, report your result to the thread that opened you, with an entry for the mission's journal. You become Done; a later message continues you.",
    invalid: invalid(
      `Not reported: give result, and journal: an entry for the mission's journal, or exactly "${nothingToRecord}".`,
    ),
    isUnasked: true,
    schema: Schema.Struct({
      journal: text(
        `The entry for the mission's journal saying what you did or decided, or exactly "${nothingToRecord}".`,
      ),
      result: text("The result, complete enough to use without your conversation."),
    }),
  }),
  request_approval: definitionOf({
    description:
      "Ask the owner before one sensitive action (see your instructions). One call per action. Wait for the answer; do the action only if it is Allowed.",
    invalid: invalid("Invalid arguments: give action and command."),
    isUnasked: false,
    schema: Schema.Struct({
      action: text(
        "One plain sentence: what you want to do and why, e.g. 'Push today's 3 commits so the release can start'.",
      ),
      command: text("The exact command, file path, or recipient and text."),
      pattern: optionalText("A command pattern covering this kind of action, with * for any text, e.g. 'git push *'."),
      permission: optionalText("A short sentence naming this kind of action, e.g. 'Push code'."),
      quote: optionalText(
        "Only when the owner's latest message already names this action: the owner's exact words naming it, copied verbatim.",
      ),
    }),
  }),
  save_intel: definitionOf({
    description:
      "Save one rule, preference, decision, fact, or temporary note that later work should know, at the narrowest scope that fits, only when it is worth keeping. Thread, mission, and workspace lore are saved at once; global lore waits for the owner's approval. A save repeating a lore entry in that scope or a wider one, or a newer version of it, replaces that lore entry.",
    invalid: invalid(
      "Invalid arguments: give text, scope (thread, mission, workspace, or global), and kind (rule, preference, decision, fact, or temporary).",
    ),
    isUnasked: true,
    schema: Schema.Struct({
      journalEntry: optionalWhole(
        "The number of the journal entry it rests on, when there is one; otherwise the message you are answering is recorded.",
      ),
      kind: ToolKind.annotate({ description: `What it is, which sets how fast it fades unused. ${kindHelp}` }),
      scope: ToolScope.annotate({ description: `Where it applies. ${scopeHelp}` }),
      text: text("One fact, at most 200 tokens."),
    }),
  }),
  search_intel: definitionOf({
    description:
      "Search the active and dormant lore in your scope by words, best match first, or read lore entries in full by their ids, such as global lore from your context's index. Reading a lore entry counts as a use and keeps it from fading.",
    invalid: searchInvalid,
    isUnasked: true,
    schema: Schema.Struct({
      ids: Schema.optionalKey(
        Schema.Array(Schema.String).annotate({ description: "Lore ids to read in full, as your context lists them." }),
      ),
      query: optionalText("Words to look for."),
      scope: Schema.optionalKey(ToolScope.annotate({ description: `Only lore of this scope. ${scopeHelp}` })),
    }),
  }),
  send_thread_message: definitionOf({
    description:
      "Send a message to your parent thread or to a thread directly beneath you, by its id. Any thread may also message Iskios by its id, to ask it to find the right quest, and Iskios may message any quest's top thread. During a turn, you may also message the top thread of a quest, or a side-quest, the owner mentioned with @ in a message of that turn, and answer a thread that wrote to you in it. It joins that thread's current turn if it is running, and wakes it if it is idle.",
    invalid: invalid("Invalid arguments: give to and text."),
    isUnasked: true,
    schema: Schema.Struct({
      text: text("The message, complete enough to act on: the receiving thread sees none of your conversation."),
      to: text("The receiving thread's id."),
    }),
  }),
  set_mission_title: definitionOf({
    description:
      "Name the mission. Only the mission's top thread uses it, on its first turn, with a short title of a few words.",
    invalid: invalid("Not named: give a title."),
    isUnasked: true,
    schema: Schema.Struct({ title: text("A short title of a few words.") }),
  }),
  suggest_mission: definitionOf({
    description:
      "Ask the owner where an off-topic message goes: continue in a matching mission, open a new mission, or keep it as an aside beneath you. Wait for the answer, then carry on as if the message had not been sent to you. Iskios uses it for every request that calls for a quest, with the ids of the quests that fit, or none: the owner chooses Continue in or Open a new quest, and it offers no aside. Iskios opens no quest without that choice.",
    invalid: invalid("Invalid arguments: give text, title, and missions."),
    isUnasked: true,
    schema: Schema.Struct({
      missions: Schema.optionalKey(
        Schema.Array(Schema.String).annotate({
          description: "The ids of the missions from find_missions that fit, best first, at most 3.",
        }),
      ),
      realm: optionalText("Iskios only: the realm for a new quest, when the owner chose or named one."),
      text: text("The off-topic part of the owner's message, as written."),
      tier: Schema.optionalKey(
        TierName.annotate({
          description:
            "How demanding the work is, as the owner set their Companions for it: Light (small, well-scoped, checkable), Balanced (ordinary work), Heavy (ambiguous, architectural, or risky). Left out, the default Companion; a tier the owner did not set also falls back to it.",
        }),
      ),
      title: text("A short title of a few words for a new mission or aside."),
    }),
  }),
  update_intel: definitionOf({
    description:
      "Correct a lore entry's text, or propose a wider scope for it when it is not specific to where it was saved. Thread and workspace corrections apply at once; a change to global lore and every widening wait for the owner's approval.",
    invalid: invalid("Invalid arguments: give id, and text, scope, or both."),
    isUnasked: true,
    schema: Schema.Struct({
      id: text("The lore entry's id, as your context or search_intel gives it."),
      scope: Schema.optionalKey(ToolScope.annotate({ description: `A wider scope to move it to. ${scopeHelp}` })),
      text: optionalText("The corrected text, one fact, at most 200 tokens."),
    }),
  }),
  update_journal: definitionOf({
    description:
      "Record a change in the mission's journal: an entry when you settle a decision, change direction, or finish a piece of work. Rewrite the briefing only when where the mission stands has changed; every rewrite comes with an entry.",
    invalid: invalid("Invalid arguments: give entry."),
    isUnasked: true,
    schema: Schema.Struct({
      basedOn: optionalWhole("With briefing: the briefing version your rewrite starts from, as read_journal gave it."),
      briefing: optionalText("The whole new briefing of where the mission stands, short enough for its limit."),
      entry: text("One entry for the change log: what was decided, changed, or done."),
    }),
  }),
};

/** A thread tool's name. */
export type ThreadToolName = keyof typeof threadTools;

/** The decoded arguments of a thread tool. */
export type ArgumentsOf<Name extends ThreadToolName> = (typeof threadTools)[Name]["schema"]["Type"];

/** Answers one thread tool with its decoded arguments. */
export type ToolHandlers = {
  readonly [Name in ThreadToolName]: (threadId: string, args: ArgumentsOf<Name>) => Effect.Effect<ToolAnswer>;
};

/** The tools as MCP's `tools/list` gives them. */
export const toolListing = Object.entries(threadTools).map(([name, tool]) => ({
  description: tool.description,
  inputSchema: tool.inputSchema,
  name,
}));

/**
 * The tools a thread's harness lists: `answer_prompt` only for a harness that asks its permission prompts
 * through it, Claude Code; the others ask the owner in-process.
 */
export const toolListingOf = (hasPromptTool: boolean) =>
  hasPromptTool ? toolListing : toolListing.filter((tool) => tool.name !== "answer_prompt");

/** Whether a name is one of the thread tools. */
export const isThreadToolName = (name: string): name is ThreadToolName => Object.hasOwn(threadTools, name);

/** The tool names Claude Code runs without asking, as it prefixes them with the server name. */
export const unaskedToolNamesOf = (serverName: string) =>
  Object.entries(threadTools)
    .filter(([, tool]) => tool.isUnasked)
    .map(([name]) => `mcp__${serverName}__${name}`);

/** Decodes a call's arguments and answers it, or answers that the arguments are invalid. */
export const answerToolCall = <Name extends ThreadToolName>(
  handlers: ToolHandlers,
  name: Name,
  threadId: string,
  args: unknown,
): Effect.Effect<ToolAnswer> => {
  const tool = threadTools[name];
  const decoded = Schema.decodeUnknownExit<(typeof threadTools)[Name]["schema"]>(tool.schema)(args);
  if (Exit.isFailure(decoded)) return Effect.succeed(tool.invalid);
  const handler: ToolHandlers[Name] = handlers[name];
  return handler(threadId, decoded.value);
};
