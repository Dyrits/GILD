import type { RelayStatus } from "@iskios/contracts";
import { Context, Effect, Layer, Ref } from "effect";
import { Changes } from "../core/index.ts";

/**
 * What the host runtime shows the rest of the service: how its relay connection stands, which devices are
 * connected, and the two ways to reach it (to disconnect a device, and to say "look at the settings again").
 */
export class RemoteState extends Context.Service<
  RemoteState,
  {
    /** Ends one device's connection, if it has one. */
    readonly closeDevice: (deviceId: string) => void;
    /** The devices connected now. */
    readonly connectedDevices: () => ReadonlySet<string>;
    /** Closes every device's connection, as turning "Allow paired devices" off does. */
    readonly closeAll: () => void;
    /** Registers a connected device; the returned function removes it. */
    readonly deviceConnected: (deviceId: string, close: () => void) => () => void;
    /** Asks the runtime to read the host record again now. */
    readonly poke: () => void;
    /** Runs once per `poke`; the runtime's wait. */
    readonly onPoke: (listener: () => void) => () => void;
    readonly setStatus: (status: RelayStatus) => Effect.Effect<void>;
    readonly status: Effect.Effect<RelayStatus>;
  }
>()("iskios/RemoteState") {}

export const remoteStateLayer = Layer.effect(
  RemoteState,
  Effect.gen(function* () {
    const changes = yield* Changes;
    const status = yield* Ref.make<RelayStatus>("Off");
    const devices = new Map<string, () => void>();
    const pokes = new Set<() => void>();
    return {
      closeAll: () => {
        for (const close of [...devices.values()]) close();
      },
      closeDevice: (deviceId: string) => devices.get(deviceId)?.(),
      connectedDevices: () => new Set(devices.keys()),
      deviceConnected: (deviceId: string, close: () => void) => {
        // A device connects once at a time: a newer connection replaces the older.
        devices.get(deviceId)?.();
        devices.set(deviceId, close);
        return () => {
          if (devices.get(deviceId) === close) devices.delete(deviceId);
        };
      },
      onPoke: (listener: () => void) => {
        pokes.add(listener);
        return () => void pokes.delete(listener);
      },
      poke: () => {
        for (const listener of [...pokes]) listener();
      },
      setStatus: (next: RelayStatus) =>
        Ref.getAndSet(status, next).pipe(Effect.flatMap((before) => (before === next ? Effect.void : changes.publish))),
      status: Ref.get(status),
    };
  }),
);
