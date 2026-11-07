import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessName, MissionDetail, MissionId, Request, RequestTag, ResultOf } from "@canopy/contracts";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { afterEach } from "vitest";
import {
  Harness,
  liveHarnessToolsLayer,
  makeClaudeHarness,
  makeCodexHarness,
  makeOpenCodeHarness,
  routeHarnesses,
  Service,
  serviceLayer,
} from "../src/index.ts";

// Opt-in checks against the installed Codex and OpenCode (provider-accounts). Each uses a few tokens of the
// owner's own sign-in: CANOPY_LIVE_HARNESSES=1, and CANOPY_LIVE_OPENCODE_MODEL for OpenCode's model.

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const commands = {
  claude: process.env.CANOPY_CLAUDE_PATH ?? "claude",
  codex: process.env.CANOPY_CODEX_PATH ?? "codex",
  opencode: process.env.CANOPY_OPENCODE_PATH ?? "opencode",
};

const live = () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "canopy-live-")));
  directories.push(directory);
  const harness = Layer.effect(
    Harness,
    Effect.gen(function* () {
      return routeHarnesses({
        claude: yield* makeClaudeHarness({ command: commands.claude, idleTimeout: "1 minute", sandboxProblem: null }),
        codex: yield* makeCodexHarness({ command: commands.codex, idleTimeout: "1 minute" }),
        opencode: yield* makeOpenCodeHarness({ command: commands.opencode, idleTimeout: "1 minute" }),
      });
    }),
  );
  return serviceLayer({
    filename: join(directory, "canopy.sqlite"),
    harness,
    harnessTools: liveHarnessToolsLayer(commands),
    homeFolder: directory,
    scratchRoot: join(directory, "missions"),
  });
};

const call = <R extends Request>(request: R) =>
  Effect.gen(function* () {
    const service = yield* Service;
    return (yield* service.handle(request)) as ResultOf<R["_tag"] & RequestTag>;
  });

const settle = (missionId: MissionId, check: (detail: MissionDetail) => boolean) =>
  Effect.gen(function* () {
    for (let i = 0; i < 1800; i++) {
      const detail = yield* call({ _tag: "ReadMission", missionId, threadId: null });
      if (check(detail)) return detail;
      yield* Effect.sleep("100 millis");
    }
    return yield* Effect.die(new Error("did not settle"));
  });

/** One turn that must call a thread tool, set_mission_title, which proves the thread reached its tools. */
const titledTurn = (harness: HarnessName, model: string) =>
  Effect.gen(function* () {
    const started = yield* call({
      _tag: "StartMission",
      effort: harness === "codex" ? "low" : "default",
      harness,
      model,
      requestId: crypto.randomUUID(),
      text: 'Call set_mission_title with the title "Live check", then reply with exactly: ok',
      workspacePath: null,
    });
    const detail = yield* settle(
      started.missionId,
      (d) => d.thread.state === "Idle" || d.thread.state === "Failed" || d.thread.state === "Attention",
    );
    expect(detail.thread.failure).toBeNull();
    expect(detail.mission.title).toBe("Live check");
    expect(detail.messages.at(-1)?.text.toLowerCase()).toContain("ok");
    return detail;
  });

describe.runIf(process.env.CANOPY_LIVE_HARNESSES === "1")("live harnesses (use a few tokens)", () => {
  it.live(
    "lists the installed harnesses, their sign-ins, and their models",
    () =>
      Effect.gen(function* () {
        const { harnesses } = yield* call({ _tag: "ListHarnesses" });
        for (const harness of harnesses) {
          expect(harness.problem).toBeNull();
          expect(harness.accounts[0]?.signIn).toBe("SignedIn");
        }
        expect(harnesses[1]?.models.length).toBeGreaterThan(1);
      }).pipe(Effect.provide(live())),
    120_000,
  );

  it.live(
    "runs a Codex turn that uses its thread tools",
    () =>
      Effect.gen(function* () {
        const detail = yield* titledTurn("codex", "default");
        expect(detail.mission.usage.output).toBeGreaterThan(0);
      }).pipe(Effect.provide(live())),
    300_000,
  );

  it.live(
    "runs an OpenCode turn that uses its thread tools",
    () => titledTurn("opencode", process.env.CANOPY_LIVE_OPENCODE_MODEL ?? "default").pipe(Effect.provide(live())),
    300_000,
  );
});
