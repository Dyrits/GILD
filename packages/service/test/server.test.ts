import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { ServerFrameJson } from "@openmission/contracts";
import { Effect, Schema } from "effect";
import { afterEach } from "vitest";
import { fakeHarnessLayer, serveLoopback, serviceLayer } from "../src/index.ts";

const TOKEN = "owner-token-for-tests";
const decodeFrame = Schema.decodeUnknownSync(ServerFrameJson);

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const running = serveLoopback({ port: 0, token: TOKEN }).pipe(Effect.map(({ port }) => port));

/** A service over its own database, kept open for the whole test. */
const fresh = () => {
  const directory = mkdtempSync(join(tmpdir(), "openmission-test-"));
  directories.push(directory);
  return serviceLayer({
    filename: join(directory, "openmission.sqlite"),
    harness: fakeHarnessLayer("10 millis"),
    homeFolder: directory,
    scratchRoot: join(directory, "missions"),
  });
};

const connect = (url: string) =>
  Effect.callback<{ socket: WebSocket; frames: unknown[] }, Error>((resume) => {
    const socket = new WebSocket(url);
    const frames: unknown[] = [];
    socket.addEventListener("message", (event) => frames.push(decodeFrame(event.data)));
    socket.addEventListener("open", () => resume(Effect.succeed({ frames, socket })));
    socket.addEventListener("error", () => resume(Effect.fail(new Error("connection refused"))));
  });

const until = <A>(check: () => A | undefined) =>
  Effect.gen(function* () {
    for (let i = 0; i < 200; i++) {
      const value = check();
      if (value !== undefined) return value;
      yield* Effect.sleep("10 millis");
    }
    return yield* Effect.fail(new Error("timed out waiting"));
  });

describe("loopback WebSocket", () => {
  it.live("refuses a connection without the owner token", () =>
    Effect.gen(function* () {
      const port = yield* running;
      const missing = yield* Effect.flip(connect(`ws://127.0.0.1:${port}/`));
      const wrong = yield* Effect.flip(connect(`ws://127.0.0.1:${port}/?token=nope`));
      expect(missing.message).toBe("connection refused");
      expect(wrong.message).toBe("connection refused");
    }).pipe(Effect.provide(fresh())),
  );

  it.live("answers requests and announces committed changes to the owner", () =>
    Effect.gen(function* () {
      const port = yield* running;
      const { socket, frames } = yield* connect(`ws://127.0.0.1:${port}/?token=${TOKEN}`);
      socket.send(
        JSON.stringify({
          id: "1",
          request: {
            _tag: "StartMission",
            effort: "default",
            model: "default",
            requestId: "r1",
            text: "Over the wire",
            workspacePath: null,
          },
        }),
      );

      const reply = yield* until(() => frames.find((f) => (f as { id?: string }).id === "1"));
      expect(reply).toMatchObject({ _tag: "Success", value: { missionId: expect.any(String) } });
      yield* until(() => frames.find((f) => (f as { _tag: string })._tag === "Changed"));

      socket.send(JSON.stringify({ id: "2", request: { _tag: "ListMissions" } }));
      const list = yield* until(() => frames.find((f) => (f as { id?: string }).id === "2"));
      expect(list).toMatchObject({ _tag: "Success", value: [{ title: "Over the wire" }] });
      socket.close();
    }).pipe(Effect.provide(fresh())),
  );

  it.live("answers an invalid frame with InvalidInput", () =>
    Effect.gen(function* () {
      const port = yield* running;
      const { socket, frames } = yield* connect(`ws://127.0.0.1:${port}/?token=${TOKEN}`);
      socket.send(JSON.stringify({ id: "9", request: { _tag: "DropTables" } }));
      const reply = yield* until(() => frames.find((f) => (f as { id?: string }).id === "9"));
      expect(reply).toMatchObject({ _tag: "Failure", error: { kind: "InvalidInput" } });
      socket.close();
    }).pipe(Effect.provide(fresh())),
  );
});
