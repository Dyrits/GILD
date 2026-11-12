import { closeCodes, connectHost, type HostConnection } from "@iskios/relay";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { Changes, Sessions } from "../core/index.ts";
import { Service } from "../serviceTag.ts";
import { RemoteConfig } from "./config.ts";
import { answerText } from "./frames.ts";
import { type HostRecord, readHostRecord, relayOriginOf } from "./hostAccess.ts";
import { createDeviceServer, type RunWork, reportFailure } from "./hostSession.ts";
import { RemoteState } from "./state.ts";

const firstRetryMillis = 1_000;
const longestRetryMillis = 30_000;

/** Whether "Allow paired devices" is off, or the host has never been asked to pair. */
const isOff = (record: HostRecord | null) => record === null || !record.isEnabled;

/**
 * Keeps this installation's connection to its room on the relay for as long as "Allow paired devices" is on, and
 * serves each paired device through its own end-to-end encrypted channel exactly as the owner's window is served,
 * except for what only the host may do (device-pairing, Behavior).
 */
export const remoteHostLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const service = yield* Service;
    const state = yield* RemoteState;
    const sessions = yield* Sessions;
    const changes = yield* Changes;
    const sql = yield* SqlClient.SqlClient;
    const config = yield* RemoteConfig;
    const context = yield* Effect.context<never>();
    const runPlain = Effect.runPromiseWith(context);
    const withParts = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient | RemoteConfig>) =>
      effect.pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.provideService(RemoteConfig, config));
    const run: RunWork = (effect) => runPlain(withParts(effect));
    const runInTransaction: RunWork = (effect) => runPlain(withParts(sql.withTransaction(effect)));

    const devices = createDeviceServer({
      addSession: (send) => sessions.add(send),
      announce: () => void runPlain(changes.publish).catch(reportFailure),
      answer: (message, send) =>
        void runPlain(answerText(service.handle, message, send, { isPairedDevice: true })).catch(reportFailure),
      deviceConnected: state.deviceConnected,
      run,
      runInTransaction,
    });

    let isStopped = false;
    let current: HostConnection | null = null;
    let wake: (() => void) | null = null;
    const pause = (millis: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(done, millis);
        function done() {
          clearTimeout(timer);
          wake = null;
          resolve();
        }
        wake = done;
      });
    const stopListening = state.onPoke(() => wake?.());

    /** Holds one connection to the relay until it ends; the code it ended with. */
    const hold = (connection: HostConnection, record: HostRecord) =>
      new Promise<number>((resolve) => {
        const stopWatching = state.onPoke(() => {
          void run(readHostRecord)
            .then((now) => {
              if (!isOff(now)) return;
              state.closeAll();
              connection.close();
            })
            .catch(reportFailure);
        });
        connection.onClientJoined((clientId) => devices.serve(connection, record, clientId));
        connection.onClientData(devices.deliver);
        connection.onClientLeft(devices.left);
        connection.onClose((code) => {
          stopWatching();
          devices.endAll();
          resolve(code);
        });
        void runPlain(state.setStatus("Connected")).catch(reportFailure);
      });

    const keepConnected = async () => {
      let retry = firstRetryMillis;
      while (!isStopped) {
        try {
          let record: HostRecord | null;
          try {
            record = await run(readHostRecord);
          } catch (reason) {
            reportFailure(reason);
            await pause(longestRetryMillis);
            continue;
          }
          if (record === null || isOff(record)) {
            await runPlain(state.setStatus("Off"));
            await pause(longestRetryMillis);
            retry = firstRetryMillis;
            continue;
          }
          await runPlain(state.setStatus("Connecting"));
          const relayOrigin = await run(relayOriginOf(record));
          const connected = await connectHost({ claim: record.claimSecret, relayOrigin, room: record.room });
          if (!connected.ok) {
            await runPlain(state.setStatus("Unreachable"));
            await pause(retry);
            retry = Math.min(retry * 2, longestRetryMillis);
            continue;
          }
          retry = firstRetryMillis;
          const connection = connected.value;
          current = connection;
          // The switch may have gone off while the relay was answering; a connection made then must not serve anyone.
          const latest = await run(readHostRecord).catch(() => null);
          if (isStopped || isOff(latest)) {
            connection.close();
            current = null;
            continue;
          }
          const code = await hold(connection, record);
          current = null;
          if (isStopped) break;
          // Claimed by another host: wait longer than for a dropped connection. Switched off: say so at once.
          const isRefused = code === closeCodes.claimMismatch;
          const isNowOff = isOff(await run(readHostRecord).catch(() => null));
          await runPlain(state.setStatus(isNowOff ? "Off" : isRefused ? "Unreachable" : "Connecting"));
          await pause(isRefused ? longestRetryMillis : isNowOff ? 0 : firstRetryMillis);
        } catch (reason) {
          current?.close();
          current = null;
          devices.endAll();
          if (isStopped) break;
          reportFailure(reason);
          await runPlain(state.setStatus("Unreachable")).catch(reportFailure);
          await pause(longestRetryMillis);
        }
      }
    };

    yield* Effect.acquireRelease(
      Effect.sync(() => void keepConnected().catch(reportFailure)),
      () =>
        Effect.sync(() => {
          isStopped = true;
          stopListening();
          state.closeAll();
          current?.close();
          wake?.();
        }),
    );
  }),
);
