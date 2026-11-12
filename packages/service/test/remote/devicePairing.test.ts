import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { decodePairingCode } from "@iskios/channel";
import { type Request, type ServerFrame, ServerFrameJson } from "@iskios/contracts";
import { startNodeRelay } from "@iskios/relay";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { fakeHarnessLayer, Service, serveLoopback, serviceLayer } from "../../src/index.ts";
import { redeemPairingSecret } from "../../src/remote/hostAccess.ts";

// Two whole services, each over its own database, joined by a real local relay: the host accepts paired devices and
// the controller pairs with it and steers it through its own loopback socket (device-pairing).

const TOKEN = "owner-token-for-tests";
const decodeFrame = Schema.decodeUnknownSync(ServerFrameJson);

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const machine = (computerName: string, relayOrigin: string) => {
  const directory = mkdtempSync(join(tmpdir(), "iskios-remote-"));
  directories.push(directory);
  return serviceLayer({
    computerName,
    filename: join(directory, "iskios.sqlite"),
    harness: fakeHarnessLayer("10 millis"),
    homeFolder: directory,
    relayOrigin,
    scratchRoot: join(directory, "missions"),
  });
};

const until = <A>(check: () => A | undefined | Promise<A | undefined>) =>
  Effect.gen(function* () {
    for (let i = 0; i < 300; i++) {
      const value = yield* Effect.promise(async () => check());
      if (value !== undefined) return value;
      yield* Effect.sleep("20 millis");
    }
    return yield* Effect.fail(new Error("timed out waiting"));
  });

/** A socket to a loopback server, remembering the frames it received and how it closed. */
interface Link {
  readonly closed: { code: number; reason: string } | null;
  readonly frames: ServerFrame[];
  readonly socket: WebSocket;
}

const connect = (url: string) =>
  Effect.callback<Link, Error>((resume) => {
    const state = { closed: null as { code: number; reason: string } | null, frames: [] as ServerFrame[] };
    const socket = new WebSocket(url);
    socket.addEventListener("message", (event) => state.frames.push(decodeFrame(event.data)));
    socket.addEventListener("close", (event) => {
      state.closed = { code: event.code, reason: event.reason };
    });
    socket.addEventListener("open", () =>
      resume(
        Effect.succeed({
          ...state,
          get closed() {
            return state.closed;
          },
          get frames() {
            return state.frames;
          },
          socket,
        }),
      ),
    );
    socket.addEventListener("error", () => resume(Effect.fail(new Error("connection refused"))));
  });

/** Two services and a relay; the controller's loopback server is up. */
/** `controllerRelay` is the relay address the controller itself is set up with, when it is not the one in use. */
const makeWorld = (options: { controllerRelay?: string } = {}) =>
  Effect.gen(function* () {
    const relay = yield* Effect.acquireRelease(
      Effect.promise(() => startNodeRelay()),
      (running) => Effect.promise(() => running.close()),
    );
    const relayOrigin = `http://127.0.0.1:${relay.port}`;
    const hostContext = yield* Layer.build(machine("Host Mac", relayOrigin));
    const controllerContext = yield* Layer.build(machine("Laptop", options.controllerRelay ?? relayOrigin));
    const { port } = yield* serveLoopback({ port: 0, token: TOKEN }).pipe(Effect.provideContext(controllerContext));

    const on = (context: typeof hostContext) => (request: Request) =>
      Effect.gen(function* () {
        const service = yield* Service;
        return yield* service.handle(request);
      }).pipe(Effect.provideContext(context));
    const host = on(hostContext);
    const controller = on(controllerContext);
    const hostSql = <A, E>(work: (sql: SqlClient.SqlClient) => Effect.Effect<A, E>) =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        return yield* work(sql);
      }).pipe(Effect.provideContext(hostContext));

    const accessOf = () =>
      host({ _tag: "ReadRemoteAccess" }) as Effect.Effect<{
        devices: Array<{ isConnected: boolean; lastActiveAt: number | null; name: string }>;
        hostName: string;
        isEnabled: boolean;
        status: string;
      }>;

    /** Turns pairing on at the host and waits until its relay connection is up. */
    const allowPairing = Effect.gen(function* () {
      yield* host({ _tag: "SetRemoteAccess", isEnabled: true });
      yield* until(() =>
        accessOf()
          .pipe(Effect.runPromise)
          .then((view) => (view.status === "Connected" ? view : undefined)),
      );
    });

    const newCode = () =>
      host({ _tag: "CreatePairingCode" }).pipe(Effect.map((made) => (made as { code: string }).code));
    const pair = (code: string, deviceName = "Laptop") =>
      controller({ _tag: "AddHost", code, deviceName }) as Effect.Effect<{ id: string; name: string }, unknown>;
    const bridge = (hostId: string) => connect(`ws://127.0.0.1:${port}/host/${hostId}?token=${TOKEN}`);
    const ask = (link: Link, id: string, request: object) =>
      Effect.gen(function* () {
        link.socket.send(JSON.stringify({ id, request }));
        return yield* until(() => link.frames.find((frame) => "id" in frame && frame.id === id));
      });
    const controllerSql = <A, E>(work: (sql: SqlClient.SqlClient) => Effect.Effect<A, E>) =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        return yield* work(sql);
      }).pipe(Effect.provideContext(controllerContext));
    return { accessOf, allowPairing, ask, bridge, controller, controllerSql, host, hostSql, newCode, pair };
  });

const world = makeWorld();

const claimedMission = (text: string) => ({
  _tag: "StartMission",
  effort: "default",
  model: "default",
  requestId: crypto.randomUUID(),
  text,
  workspacePath: null,
});

describe("controlling one installation from another through the relay", () => {
  it.live("pairs with a code, then steers the host and sees its changes", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        const host = yield* w.pair(yield* w.newCode());
        expect(host.name).toBe("Host Mac");
        expect(yield* w.controller({ _tag: "ListHosts" })).toMatchObject([{ name: "Host Mac" }]);
        // The short channel that paired it closes by itself.
        yield* until(() =>
          Effect.runPromise(w.accessOf()).then((view) => (view.devices[0]?.isConnected === false ? view : undefined)),
        );
        expect((yield* w.accessOf()).devices).toMatchObject([{ isConnected: false, name: "Laptop" }]);

        const link = yield* w.bridge(host.id);
        const started = yield* w.ask(link, "1", claimedMission("Steered from another computer"));
        expect(started).toMatchObject({ _tag: "Success", value: { missionId: expect.any(String) } });
        yield* until(() => link.frames.find((frame) => frame._tag === "Changed"));
        const missions = yield* w.host({
          _tag: "ListMissions",
          isArchived: false,
          search: null,
          state: null,
          workspaceId: null,
        });
        expect(missions).toMatchObject({ missions: [{ title: "Steered from another computer" }] });

        expect(yield* w.ask(link, "2", { _tag: "RenameHost", name: "Studio" })).toMatchObject({
          _tag: "Success",
          value: "Studio",
        });
        expect(yield* w.host({ _tag: "ReadHostName" })).toBe("Studio");
        const view = yield* w.accessOf();
        expect(view.devices).toMatchObject([{ isConnected: true, name: "Laptop" }]);
        expect(view.devices[0]?.lastActiveAt).not.toBeNull();
        link.socket.close();
      }),
    ),
  );

  it.live("accepts a pairing code once, and refuses an expired or garbled one", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        const code = yield* w.newCode();
        yield* w.pair(code);
        const again = yield* Effect.flip(w.pair(code));
        expect(String((again as { message: string }).message)).toContain("already used");

        const stale = yield* w.newCode();
        yield* w.hostSql((sql) => sql`UPDATE pairing_codes SET expires_at = 1 WHERE used_at IS NULL`);
        const expired = yield* Effect.flip(w.pair(stale));
        expect(String((expired as { message: string }).message)).toContain("expired");

        const garbled = yield* Effect.flip(w.pair(`${code.slice(0, -4)}AAAA`));
        expect(String((garbled as { message: string }).message)).toContain("not valid");
        expect((yield* w.accessOf()).devices).toHaveLength(1);
      }),
    ),
  );

  it.live("refuses a paired device what only the host may do", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        const host = yield* w.pair(yield* w.newCode());
        const link = yield* w.bridge(host.id);
        for (const [id, request] of [
          ["a", { _tag: "ReadRemoteAccess" }],
          ["b", { _tag: "CreatePairingCode" }],
          ["c", { _tag: "SetRemoteAccess", isEnabled: false }],
          ["d", { _tag: "DisconnectDevice", deviceId: "anything" }],
          ["e", { _tag: "ListHosts" }],
        ] as const) {
          expect(yield* w.ask(link, id, request)).toMatchObject({ _tag: "Failure", error: { kind: "AccessRefused" } });
        }
        expect((yield* w.accessOf()).isEnabled).toBe(true);
        link.socket.close();
      }),
    ),
  );

  it.live("ends a device's connection at once when the host disconnects it, and forgets it", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        const host = yield* w.pair(yield* w.newCode());
        const link = yield* w.bridge(host.id);
        yield* w.ask(link, "1", { _tag: "ReadHostName" });
        const [device] = (yield* w.accessOf()).devices as unknown as Array<{ id: string }>;
        yield* w.host({ _tag: "DisconnectDevice", deviceId: device?.id as never });
        yield* until(() => link.closed ?? undefined);
        expect(link.closed?.code).toBe(4001);

        const retry = yield* w.bridge(host.id);
        const closed = yield* until(() => retry.closed ?? undefined);
        // A host that forgot this installation refuses it for good, so the app stops trying.
        expect(closed.code).toBe(4002);
        expect(closed.reason).toContain("no longer knows");
        expect((yield* w.accessOf()).devices).toEqual([]);
      }),
    ),
  );

  it.live(
    "ends every connection when Allow paired devices goes off, and resumes with the same pairing when it is on",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const w = yield* world;
          yield* w.allowPairing;
          const host = yield* w.pair(yield* w.newCode());
          const link = yield* w.bridge(host.id);
          yield* w.ask(link, "1", { _tag: "ReadHostName" });

          // The answer already shows Off, before the runtime has closed its relay connection.
          const off = yield* w.host({ _tag: "SetRemoteAccess", isEnabled: false });
          expect(off).toMatchObject({ isEnabled: false, status: "Off" });
          yield* until(() => link.closed ?? undefined);
          expect((yield* w.accessOf()).status).toBe("Off");
          const refused = yield* w.bridge(host.id);
          expect((yield* until(() => refused.closed ?? undefined)).code).toBe(4000);
          expect((yield* w.accessOf()).devices).toHaveLength(1);

          yield* w.allowPairing;
          const back = yield* w.bridge(host.id);
          expect(yield* w.ask(back, "2", { _tag: "ReadHostName" })).toMatchObject({
            _tag: "Success",
            value: "Host Mac",
          });
          back.socket.close();
        }),
      ),
  );
  it.live("sends the relay nothing readable: not a quest title, a name, a pairing secret, or a device token", () =>
    Effect.scoped(
      Effect.gen(function* () {
        // Every frame the services send to the relay, as text, whatever its length: the relay forwards them unchanged.
        const seen: string[] = [];
        const Original = globalThis.WebSocket;
        class Spy extends Original {
          readonly isRelay: boolean;
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            this.isRelay = String(url).includes("/r/");
          }
          override send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
            if (this.isRelay && typeof data !== "string" && !(data instanceof Blob)) {
              const bytes = ArrayBuffer.isView(data)
                ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
                : new Uint8Array(data);
              seen.push(Buffer.from(bytes).toString("latin1"));
            }
            super.send(data as string);
          }
        }
        globalThis.WebSocket = Spy as typeof WebSocket;
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            globalThis.WebSocket = Original;
          }),
        );

        const w = yield* world;
        yield* w.allowPairing;
        const code = yield* w.newCode();
        const host = yield* w.pair(code, "Secret Laptop Name");
        const link = yield* w.bridge(host.id);
        yield* w.ask(link, "1", claimedMission("A very private quest title"));
        yield* w.ask(link, "2", { _tag: "RenameHost", name: "Private Host Name" });
        link.socket.close();

        const [stored] = yield* w.controllerSql(
          (sql) => sql<{ token: string }>`SELECT device_token AS token FROM remote_hosts`,
        );
        const secret = Buffer.from(code.slice("iskios1-".length), "base64url").subarray(48, 64);
        expect(seen.length).toBeGreaterThan(8);
        for (const marker of [
          "A very private quest title",
          "Private Host Name",
          "Secret Laptop Name",
          "StartMission",
          "Success",
          stored?.token ?? "no-token",
          secret.toString("latin1"),
        ]) {
          expect(seen.filter((frame) => frame.includes(marker))).toEqual([]);
        }
      }),
    ),
  );
});

describe("what the owner is told, and what a host refuses, at the edges", () => {
  it.live("refuses an already received secret when access has since been disabled", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        const decoded = decodePairingCode(yield* w.newCode());
        if (!decoded.ok) throw new Error("test code did not decode");
        yield* w.host({ _tag: "SetRemoteAccess", isEnabled: false });
        const result = yield* w.hostSql((sql) =>
          redeemPairingSecret(decoded.value.secret, { kind: "desktop", name: "Late laptop" }, Date.now()).pipe(
            Effect.provideService(SqlClient.SqlClient, sql),
          ),
        );
        expect(result).toEqual({ refusal: "disabled" });
        expect((yield* w.accessOf()).devices).toEqual([]);
      }),
    ),
  );

  it.live("says when the host is not connected, instead of blaming the relay", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        const code = yield* w.newCode();
        yield* w.host({ _tag: "SetRemoteAccess", isEnabled: false });
        yield* until(() => Effect.runPromise(w.accessOf()).then((view) => (view.status === "Off" ? view : undefined)));
        const failure = yield* Effect.flip(w.pair(code));
        expect(String((failure as { message: string }).message)).toContain("not connected right now");
      }),
    ),
  );

  it.live("does not serve anyone when pairing was switched off while the relay was still answering", () =>
    Effect.scoped(
      Effect.gen(function* () {
        // The relay's answer is held back for a moment, so the switch can go off while the connection is being made.
        type Listening = {
          addEventListener: (type: string, listener: (event: unknown) => void, options?: unknown) => void;
        };
        const target = WebSocket.prototype as unknown as Listening;
        const original = target.addEventListener;
        target.addEventListener = function (this: { url: string }, type, listener, options) {
          const isRelayOpen = type === "open" && this.url.includes("/r/");
          const held = (event: unknown) => void setTimeout(() => listener(event), 400);
          original.call(this, type, isRelayOpen ? held : listener, options);
        };
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            target.addEventListener = original;
          }),
        );
        const w = yield* world;
        yield* w.host({ _tag: "SetRemoteAccess", isEnabled: true });
        yield* until(() =>
          Effect.runPromise(w.accessOf()).then((view) => (view.status === "Connecting" ? view : undefined)),
        );
        yield* w.host({ _tag: "SetRemoteAccess", isEnabled: false });
        yield* Effect.sleep("1500 millis");
        // The connection that was being made must not come up and serve devices.
        expect((yield* w.accessOf()).status).toBe("Off");
      }),
    ),
  );

  it.live("tells a new pairing the host's name as it is now", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        yield* w.host({ _tag: "RenameHost", name: "Studio" });
        const host = yield* w.pair(yield* w.newCode());
        expect(host.name).toBe("Studio");
      }),
    ),
  );

  it.live("pairs again after a disconnect without leaving the old entry in the menu", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        const first = yield* w.pair(yield* w.newCode());
        const [device] = (yield* w.accessOf()).devices as unknown as Array<{ id: string }>;
        yield* w.host({ _tag: "DisconnectDevice", deviceId: device?.id as never });
        const second = yield* w.pair(yield* w.newCode());
        expect(second.id).not.toBe(first.id);
        expect(yield* w.controller({ _tag: "ListHosts" })).toMatchObject([{ id: second.id }]);
      }),
    ),
  );

  it.live("does not bring a code back to life when pairing is switched off and on again", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        const code = yield* w.newCode();
        yield* w.host({ _tag: "SetRemoteAccess", isEnabled: false });
        yield* w.allowPairing;
        const failure = yield* Effect.flip(w.pair(code));
        expect(String((failure as { message: string }).message)).toContain("not valid");
      }),
    ),
  );

  it.live(
    "does not accept a code that names a relay on this computer when this installation's relay is elsewhere",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const w = yield* makeWorld({ controllerRelay: "https://relay.example.invalid" });
          yield* w.allowPairing;
          const failure = yield* Effect.flip(w.pair(yield* w.newCode()));
          expect(String((failure as { message: string }).message)).toContain("on this computer");
        }),
      ),
  );

  it.live("keeps only a hash of a device's token on the host, and a code lives ten minutes", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const w = yield* world;
        yield* w.allowPairing;
        const before = Date.now();
        const code = yield* w.newCode();
        const after = Date.now();
        const [row] = yield* w.hostSql(
          (sql) => sql<{ expiresAt: number }>`SELECT expires_at AS expiresAt FROM pairing_codes`,
        );
        expect(row?.expiresAt).toBeGreaterThanOrEqual(before + 10 * 60_000);
        expect(row?.expiresAt).toBeLessThanOrEqual(after + 10 * 60_000);

        yield* w.pair(code);
        const [kept] = yield* w.controllerSql(
          (sql) => sql<{ token: string }>`SELECT device_token AS token FROM remote_hosts`,
        );
        const [hashed] = yield* w.hostSql(
          (sql) => sql<{ hash: string }>`SELECT token_hash AS hash FROM paired_devices`,
        );
        expect(kept?.token).toBeTruthy();
        expect(hashed?.hash).toBeTruthy();
        expect(hashed?.hash).not.toBe(kept?.token);
        expect(JSON.stringify(yield* w.hostSql((sql) => sql`SELECT * FROM paired_devices`))).not.toContain(
          kept?.token ?? "?",
        );
      }),
    ),
  );
});
