import { describe, expect, it } from "@effect/vitest";
import type { HarnessName } from "@iskios/contracts";
import { Effect } from "effect";
import { installHarnessPackage } from "../../src/harness/harnessInstallation.ts";
import type { runHarnessCommand } from "../../src/harness/lineProcess.ts";

describe("installing harness packages", () => {
  const packages: ReadonlyArray<readonly [HarnessName, string]> = [
    ["claude", "@anthropic-ai/claude-code"],
    ["codex", "@openai/codex"],
    ["opencode", "opencode-ai"],
  ];
  for (const [harness, packageName] of packages) {
    it.effect(`installs ${harness} from its official package`, () =>
      Effect.gen(function* () {
        const calls: Array<unknown> = [];
        const run: typeof runHarnessCommand = (...args) => {
          calls.push(args);
          return Effect.succeed({ code: 0, output: "installed", stdout: "installed" });
        };
        yield* installHarnessPackage(harness, run, "darwin");
        expect(calls).toEqual([["npm", ["install", "--global", `${packageName}@latest`], {}, 300000]]);
      }),
    );
  }

  it.effect("reports npm failures with the last output lines", () =>
    Effect.gen(function* () {
      const run: typeof runHarnessCommand = () =>
        Effect.succeed({ code: 1, output: "first\none\ntwo\nEACCES", stdout: "" });
      const failure = yield* installHarnessPackage("codex", run).pipe(Effect.flip);
      expect(failure.message).toContain("global installation permissions");
      expect(failure.message).toContain("one two EACCES");
    }),
  );

  it.effect("explains the npm prerequisite when the command cannot run", () =>
    Effect.gen(function* () {
      const run: typeof runHarnessCommand = () => Effect.succeed({ code: null, output: "", stdout: "" });
      const failure = yield* installHarnessPackage("claude", run).pipe(Effect.flip);
      expect(failure.message).toContain("Install Node.js and npm");
    }),
  );

  it.effect("uses the Windows command launcher for npm", () =>
    Effect.gen(function* () {
      const calls: Array<unknown> = [];
      const run: typeof runHarnessCommand = (...args) => {
        calls.push(args);
        return Effect.succeed({ code: 0, output: "", stdout: "" });
      };
      yield* installHarnessPackage("opencode", run, "win32");
      expect(calls).toEqual([
        ["cmd.exe", ["/d", "/s", "/c", "npm", "install", "--global", "opencode-ai@latest"], {}, 300000],
      ]);
    }),
  );
});
