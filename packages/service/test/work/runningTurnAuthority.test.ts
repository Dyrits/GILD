import { describe, expect, it } from "@effect/vitest";
import type { HarnessName, MissionDetail, ThreadId } from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { fakeHarnessLayer } from "../../src/index.ts";
import { readAuthorityHarness } from "../../src/work/turnAdmission.ts";
import { isIdle, lastAgentText } from "../fixtures/guildmaster.ts";
import { callTool, listToolNames } from "../fixtures/mcp.ts";
import { call, send, settle, start, withService } from "../fixtures/service.ts";

// thread-handover: the running turn finishes on the harness it was admitted with, so its permission authority stays
// that harness's even when the owner picks another one during it; only the next turn uses the new selection.

const promptLine = `call answer_prompt ${JSON.stringify({ input: { command: "ls" }, tool_name: "Bash" })}`;
const unavailable = "This tool is not available to this thread.";

const isRunning = (detail: MissionDetail) => detail.thread.state === "Running";

const selectHarness = (threadId: ThreadId, harness: HarnessName) =>
  call({ _tag: "ChangeThreadRunner", accountId: null, effort: "default", harness, model: "default", threadId });

/** A fake harness whose Codex runs with no enforced sandbox, while its Claude Code has one. */
const unprotectedCodex = fakeHarnessLayer("10 millis", { codex: "Unprotected" });

describe("keeping a running turn's permission authority when the owner picks another harness", () => {
  it.live("still answers Claude Code's permission prompt for a Claude turn after the owner picks Codex", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start(`wait 300\n${promptLine}`);
        const during = yield* settle(started.missionId, isRunning);
        yield* selectHarness(during.thread.id, "codex");
        const after = yield* settle(started.missionId, isIdle);
        expect(after.thread.harness).toBe("codex");
        expect(lastAgentText(after)).toContain('{"behavior":"allow","updatedInput":{"command":"ls"}}');
        expect(lastAgentText(after)).not.toContain(unavailable);
      }),
    ),
  );

  it.live("keeps refusing the permission prompt tool to a Codex turn after the owner picks Claude Code", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("Hello");
        const first = yield* settle(started.missionId, isIdle);
        const threadId = first.thread.id;
        yield* selectHarness(threadId, "codex");
        yield* send(threadId, `wait 300\n${promptLine}`);
        yield* settle(started.missionId, (detail) => detail.messages.length === 3 && isRunning(detail));
        yield* selectHarness(threadId, "claude");
        const after = yield* settle(started.missionId, (detail) => detail.messages.length === 4 && isIdle(detail));
        expect(after.thread.harness).toBe("claude");
        expect(lastAgentText(after)).toContain(unavailable);
      }),
    ),
  );

  it.live("gives the next turn the newly picked harness's authority", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("wait 300");
        const during = yield* settle(started.missionId, isRunning);
        const threadId = during.thread.id;
        yield* selectHarness(threadId, "codex");
        yield* settle(started.missionId, isIdle);
        const refused = yield* callTool(threadId, "answer_prompt", { input: { command: "ls" }, tool_name: "Bash" });
        expect(refused.result.content[0]?.text).toBe(unavailable);
      }),
    ),
  );

  it.live("falls back to the thread's harness for a running turn saved before turns kept their harness", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("wait 300");
        const during = yield* settle(started.missionId, isRunning);
        const sql = yield* SqlClient.SqlClient;
        // A turn admitted before migration 0048 has no harness of its own.
        yield* sql`UPDATE turns SET harness = NULL WHERE thread_id = ${during.thread.id} AND status = 'running'`;
        yield* selectHarness(during.thread.id, "codex");
        expect(yield* readAuthorityHarness(during.thread.id)).toBe("codex");
        yield* settle(started.missionId, isIdle);
      }),
    ),
  );

  it.live("keeps the Claude turn's containment and tool list after the owner picks a Codex without a sandbox", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start(`wait 300\nprompt Bash ${JSON.stringify({ command: "ls" })}`);
        const during = yield* settle(started.missionId, isRunning);
        yield* selectHarness(during.thread.id, "codex");
        expect(yield* listToolNames(during.thread.id)).toContain("answer_prompt");
        const after = yield* settle(
          started.missionId,
          (detail) => isIdle(detail) || detail.questions.some((question) => question.outcome === null),
        );
        expect(after.questions.map((question) => question.outcome)).toEqual(["AllowedAutomatically"]);
        expect(lastAgentText(after)).toContain("prompt allowed");
      }),
      unprotectedCodex,
    ),
  );
});
