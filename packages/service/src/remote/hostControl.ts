import { encodePairingCode } from "@iskios/channel";
import { Effect } from "effect";
import type { SqlClient, SqlError } from "effect/sql";
import { invalid, ServiceFailure } from "../core/index.ts";
import { RemoteConfig } from "./config.ts";
import {
  ensureHostRecord,
  forgetDevice,
  makePairingSecret,
  readHostRecord,
  relayOriginOf,
  remoteAccessView,
  setRelayOrigin,
  setRemoteAccess,
} from "./hostAccess.ts";
import type { RemoteState } from "./state.ts";

/** Runs storage work as one command, announcing the change; the service's own runner is handed in. */
export type StoreChange = <A, E, R>(
  work: Effect.Effect<A, E, R>,
) => Effect.Effect<A, E | SqlError.SqlError, Exclude<R, SqlClient.SqlClient>>;

/**
 * Host access: whether paired devices may reach this host, which relay it uses, and which devices it has paired. It
 * owns the order the pieces need (write the stored record, tell the running host, read the view back), so callers
 * ask for the outcome and never poke the runtime themselves; "off, or moved to another relay" is settled here.
 */
export const makeHostControl = (dependencies: {
  readonly change: StoreChange;
  readonly config: RemoteConfig["Service"];
  readonly state: RemoteState["Service"];
}) => {
  const { change, config, state } = dependencies;
  const withConfig = <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient | RemoteConfig>) =>
    Effect.provideService(work, RemoteConfig, config);
  /** Charter's remote access section as it stands. */
  const view = Effect.flatMap(state.status, (status) => withConfig(remoteAccessView(status, state.connectedDevices())));
  /** The relay this host uses now, by address. */
  const relayInUse = withConfig(Effect.flatMap(readHostRecord, relayOriginOf));
  /**
   * Uses the relay at `origin` (the shared one when null). When the address changes, devices are disconnected and the
   * host reconnects through the new relay if pairing is on; the same address means a relay updated where it stands,
   * which changes nothing.
   */
  const useRelay = (origin: string | null) =>
    Effect.gen(function* () {
      const before = yield* relayInUse;
      yield* change(setRelayOrigin(origin));
      if ((yield* relayInUse) === before) return;
      const isEnabled = (yield* withConfig(readHostRecord))?.isEnabled ?? false;
      state.closeAll();
      yield* state.setStatus(isEnabled ? "Connecting" : "Off");
      state.poke();
    });
  return {
    /** Makes a pairing code that works once, for ten minutes, naming this host's room on the relay. */
    createPairingCode: withConfig(
      Effect.gen(function* () {
        const record = yield* ensureHostRecord;
        const { expiresAt, secret } = yield* makePairingSecret(Date.now());
        const code = encodePairingCode({
          hostPublicKey: record.publicKey,
          relayOrigin: yield* relayOriginOf(record),
          room: record.room,
          secret,
        });
        return { code, expiresAt };
      }),
    ),
    /** Forgets a paired device and ends its connection, then shows the section. */
    disconnectDevice: (deviceId: string) =>
      change(forgetDevice(deviceId)).pipe(
        Effect.tap(() => Effect.sync(() => state.closeDevice(deviceId))),
        Effect.andThen(view),
      ),
    /** Switches "Allow paired devices": off ends every connection at once, and the runtime then reads the record again. */
    setAccess: (isEnabled: boolean) =>
      change(setRemoteAccess(isEnabled)).pipe(
        Effect.tap(() =>
          Effect.gen(function* () {
            if (!isEnabled) {
              state.closeAll();
              // Charter shows Off at once; the runtime closes its relay connection a moment later.
              yield* state.setStatus("Off");
            }
            state.poke();
          }),
        ),
        Effect.andThen(view),
      ),
    /** Deploys the relay to the user's own Cloudflare account and uses it. The token is used once and kept nowhere. */
    useOwnRelay: (token: string) =>
      Effect.gen(function* () {
        const trimmed = token.trim();
        if (trimmed === "") return yield* invalid("Paste the Cloudflare API token first.");
        const result = yield* Effect.promise(() => config.deployOwnRelay(trimmed));
        if (!result.ok) return yield* new ServiceFailure({ kind: "ExecutionFailure", message: result.message });
        yield* useRelay(result.origin);
        return yield* view;
      }),
    /** Goes back to the shared relay. */
    useSharedRelay: () => useRelay(null).pipe(Effect.andThen(view)),
    view,
  };
};
