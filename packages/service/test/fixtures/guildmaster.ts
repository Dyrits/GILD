import type { MissionDetail, MissionId, ThreadId } from "@iskios/contracts";
import { Effect } from "effect";
import { call, settle, start } from "./service.ts";

/** Whether the thread is idle. */
export const isIdle = (detail: MissionDetail) => detail.thread.state === "Idle";
/** The text of the last message an agent wrote. */
export const lastAgentText = (detail: MissionDetail) =>
  detail.messages.filter((message) => message.sender === "agent").at(-1)?.text ?? "";

/** Starts a mission and waits for its first turn to end. */
export const startIdle = (text: string, workspacePath: string | null = null) =>
  Effect.gen(function* () {
    const started = yield* start(text, workspacePath);
    yield* settle(started.missionId, isIdle);
    return started;
  });

/** The missions on the dashboard, not archived. */
export const listed = call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null });

/** The Guildmaster's place, made on first use. */
export const guildmaster = call({ _tag: "ReadGuildmaster" });

/** Writes to the Guildmaster as the owner; the fake harness runs the scripted `call` line as its agent would. */
export const say = (threadId: ThreadId, text: string, realmPath: string | null = null) =>
  call({ _tag: "SendMessage", delivery: null, realmPath, requestId: crypto.randomUUID(), text, threadId });

/** Drives the owner's actual one-click approval for successful management fixtures. */
export const approvedCall = (place: { missionId: MissionId; threadId: ThreadId }, name: string, args: object) =>
  Effect.gen(function* () {
    yield* say(place.threadId, `call ${name} ${JSON.stringify(args)}`);
    const detail = yield* settle(
      place.missionId,
      (detail) => isIdle(detail) || detail.questions.some((question) => question.outcome === null),
      place.threadId,
    );
    const question = detail.questions.find((question) => question.outcome === null);
    if (question !== undefined)
      yield* call({ _tag: "AnswerQuestion", answer: "Allow", message: null, questionId: question.id });
    return lastAgentText(yield* settle(place.missionId, isIdle, place.threadId));
  });
