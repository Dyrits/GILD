import { mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { type MissionId, mentionReferencesOf, mentionTokenOf, mentionTokensOf, type ThreadId } from "@iskios/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { call, fixture, open, read, send, settle, start, tool } from "../fixtures/service.ts";

// Quests, side-quests, and realms named with `@` (thread-messaging, Who can message whom; CHG-0181).

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

/** Runs a check on a service whose data folder also holds a folder to tie a realm to. */
const withService = <A, E, R>(body: (folder: string) => Effect.Effect<A, E, R>) => {
  const value = fixture();
  fixtures.push(value);
  // A real path, as a realm stores it: the temporary folder is a link on macOS.
  const folder = join(realpathSync(value.directory), "garden");
  mkdirSync(folder);
  return body(folder).pipe(Effect.provide(value.layer));
};

const idle = (detail: { thread: { state: string } }) => detail.thread.state === "Idle";
const lastReplyOf = (detail: { messages: ReadonlyArray<{ sender: string; text: string }> }) =>
  detail.messages.filter((message) => message.sender === "agent").at(-1)?.text ?? "";

/** A quest with a known title, settled after its first turn. */
const quest = (title: string, workspacePath: string | null = null) =>
  Effect.gen(function* () {
    const started = yield* start("Hello", workspacePath);
    yield* settle(started.missionId, idle);
    yield* call({ _tag: "RenameMission", missionId: started.missionId, title });
    return started;
  });

/** Sends the owner's message and waits for the thread's reply to it. */
const say = (missionId: MissionId, threadId: ThreadId, text: string) =>
  Effect.gen(function* () {
    const before = (yield* read(missionId, threadId)).messages.length;
    yield* send(threadId, text);
    return lastReplyOf(
      yield* settle(missionId, (detail) => detail.messages.length >= before + 2 && idle(detail), threadId),
    );
  });

const archive = (missionId: MissionId) =>
  Effect.gen(function* () {
    const preview = yield* call({ _tag: "PreviewEnding", ending: "Archived", missionId });
    yield* call({ _tag: "EndMission", ending: "Archived", missionId, snapshot: preview.snapshot });
  });

describe("reading references in a message", () => {
  it("reads quest, side-quest, and realm tokens once each, and leaves workspace paths alone", () => {
    const text = "Ask @quest:1a-2b, then @side-quest:3c and @realm:4d; @quest:1a-2b again. Read @src/index.ts.";
    expect(mentionReferencesOf(text)).toEqual([
      { id: "1a-2b", kind: "quest" },
      { id: "3c", kind: "side-quest" },
      { id: "4d", kind: "realm" },
    ]);
    expect(mentionTokensOf(text).map((token) => token.path)).toContain("src/index.ts");
    expect(mentionReferencesOf("@quest: and @quests:1 and @notes/quest:1")).toEqual([]);
  });
});

describe("offering quests, side-quests, and realms to the @ menu", () => {
  it.live("lists open quests with their side-quests beneath, then realms, and leaves out archived quests", () =>
    withService((folder) =>
      Effect.gen(function* () {
        yield* call({ _tag: "CreateRealm", crest: null, name: "Garden", path: folder });
        const login = yield* quest("Fix login", folder);
        const side = yield* open(login.threadId, "Write the tests");
        yield* settle(login.missionId, (detail) => detail.threads.every((thread) => thread.state !== "Running"));
        const old = yield* quest("Old work");
        yield* archive(old.missionId);

        const listed = yield* call({ _tag: "ListMentionables" });
        expect(listed.find((each) => each.id === login.missionId)).toEqual({
          detail: "Garden",
          id: login.missionId,
          kind: "quest",
          trail: ["Fix login"],
        });
        const sideQuest = listed.find((each) => each.id === side.threadId);
        expect(sideQuest?.kind).toBe("side-quest");
        expect(sideQuest?.trail[0]).toBe("Fix login");
        expect(sideQuest?.trail).toHaveLength(2);
        expect(listed.find((each) => each.kind === "realm")).toMatchObject({ detail: folder, trail: ["Garden"] });
        expect(listed.some((each) => each.id === old.missionId)).toBe(false);
        expect(listed.some((each) => each.trail[0] === "Iskios")).toBe(false);
      }),
    ),
  );
});

describe("resolving the owner's mentions for the receiving thread", () => {
  it.live("appends what each mentioned quest and realm is, with its ids, after the owner's unchanged words", () =>
    withService((folder) =>
      Effect.gen(function* () {
        yield* call({ _tag: "CreateRealm", crest: null, name: "Garden", path: folder });
        const realm = (yield* call({ _tag: "ListMentionables" })).find((each) => each.kind === "realm");
        const login = yield* quest("Fix login", folder);
        const here = yield* quest("Release notes");
        const text = `Compare with ${mentionTokenOf({ id: login.missionId, kind: "quest" })} in ${mentionTokenOf({ id: realm?.id ?? "", kind: "realm" })}`;

        const reply = yield* say(here.missionId, here.threadId, text);

        expect(reply).toContain(text);
        expect(reply).toContain(
          `Quest "Fix login" (id ${login.missionId}, state Idle, realm Garden, top thread id ${login.threadId})`,
        );
        expect(reply).toContain(`Realm "Garden" (id ${realm?.id}, folder ${folder})`);
        const stored = (yield* read(here.missionId)).messages.find(
          (message) => message.sender === "user" && message.text === text,
        );
        expect(stored?.text).toBe(text);
      }),
    ),
  );

  it.live("says an archived quest's mention names nothing open", () =>
    withService(() =>
      Effect.gen(function* () {
        const old = yield* quest("Old work");
        yield* archive(old.missionId);
        const here = yield* quest("Release notes");
        const reply = yield* say(
          here.missionId,
          here.threadId,
          `See ${mentionTokenOf({ id: old.missionId, kind: "quest" })}`,
        );
        expect(reply).toContain("archived or deleted");
        expect(reply).not.toContain('Quest "Old work"');
      }),
    ),
  );
});

describe("reaching a quest the owner mentioned", () => {
  it.live("refuses another quest's journal and top thread without a mention, as before", () =>
    withService(() =>
      Effect.gen(function* () {
        const login = yield* quest("Fix login");
        const here = yield* quest("Release notes");
        yield* say(here.missionId, here.threadId, "Ask the other quest");

        const journal = yield* tool(here.threadId, "read_journal", { mission: login.missionId });
        expect(journal).toContain("Only Iskios reads another quest's journal");
        const sent = yield* tool(here.threadId, "send_thread_message", { text: "Hi", to: login.threadId });
        expect(sent).toContain("Not sent");
      }),
    ),
  );

  it.live("opens the mentioned quest's journal and top thread for that turn only", () =>
    withService(() =>
      Effect.gen(function* () {
        const login = yield* quest("Fix login");
        const other = yield* quest("Unrelated");
        const here = yield* quest("Release notes");
        yield* say(
          here.missionId,
          here.threadId,
          `Ask ${mentionTokenOf({ id: login.missionId, kind: "quest" })} how it went`,
        );

        const journal = yield* tool(here.threadId, "read_journal", { mission: login.missionId });
        expect(journal).not.toContain("Only Iskios");
        expect(yield* tool(here.threadId, "read_journal", { mission: other.missionId })).toContain("Only Iskios");
        expect(yield* tool(here.threadId, "send_thread_message", { text: "How did it go?", to: login.threadId })).toBe(
          "Sent.",
        );
        expect(yield* tool(here.threadId, "send_thread_message", { text: "Hi", to: other.threadId })).toContain(
          "Not sent",
        );
        const received = yield* settle(login.missionId, (detail) =>
          detail.messages.some(
            (message) => message.fromThreadId === here.threadId && message.text === "How did it go?",
          ),
        );
        expect(received.messages.find((message) => message.text === "How did it go?")?.fromMissionId).toBe(
          here.missionId,
        );

        // The next turn, with no mention, is back to the tree's rules.
        yield* say(here.missionId, here.threadId, "Thanks");
        expect(yield* tool(here.threadId, "read_journal", { mission: login.missionId })).toContain("Only Iskios");
        expect(yield* tool(here.threadId, "send_thread_message", { text: "Again", to: login.threadId })).toContain(
          "Not sent",
        );
      }),
    ),
  );

  it.live("lets the mentioned quest answer the thread that wrote to it", () =>
    withService(() =>
      Effect.gen(function* () {
        const login = yield* quest("Fix login");
        const here = yield* quest("Release notes");
        yield* say(here.missionId, here.threadId, `Ask ${mentionTokenOf({ id: login.missionId, kind: "quest" })}`);
        yield* tool(here.threadId, "send_thread_message", { text: "Which version?", to: login.threadId });
        yield* settle(
          login.missionId,
          (detail) => detail.messages.some((message) => message.text === "Which version?") && idle(detail),
        );

        expect(yield* tool(login.threadId, "send_thread_message", { text: "Version 2.", to: here.threadId })).toBe(
          "Sent.",
        );
        yield* settle(here.missionId, (detail) => detail.messages.some((message) => message.text === "Version 2."));
      }),
    ),
  );

  it.live("reaches a mentioned side-quest and reads its quest's journal", () =>
    withService(() =>
      Effect.gen(function* () {
        const login = yield* quest("Fix login");
        const side = yield* open(login.threadId, "Write the tests");
        yield* settle(login.missionId, (detail) => detail.threads.every((thread) => thread.state !== "Running"));
        const here = yield* quest("Release notes");
        const reply = yield* say(
          here.missionId,
          here.threadId,
          `Check ${mentionTokenOf({ id: side.threadId, kind: "side-quest" })}`,
        );
        expect(reply).toContain(`(thread id ${side.threadId}`);

        expect(yield* tool(here.threadId, "read_journal", { mission: login.missionId })).not.toContain("Only Iskios");
        expect(yield* tool(here.threadId, "send_thread_message", { text: "Done yet?", to: side.threadId })).toBe(
          "Sent.",
        );
        expect(yield* tool(here.threadId, "send_thread_message", { text: "Hi", to: login.threadId })).toContain(
          "Not sent",
        );
      }),
    ),
  );

  it.live("grants nothing for an archived quest's mention", () =>
    withService(() =>
      Effect.gen(function* () {
        const old = yield* quest("Old work");
        yield* archive(old.missionId);
        const here = yield* quest("Release notes");
        yield* say(here.missionId, here.threadId, `See ${mentionTokenOf({ id: old.missionId, kind: "quest" })}`);
        expect(yield* tool(here.threadId, "read_journal", { mission: old.missionId })).toContain("Only Iskios");
        expect(yield* tool(here.threadId, "send_thread_message", { text: "Hi", to: old.threadId })).toContain(
          "Not sent",
        );
      }),
    ),
  );
});
