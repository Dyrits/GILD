import { useEffect, useState } from "react";
import { messageOf } from "./client";
import { useIsRemoteHost } from "./hostContext";
import type { UpdateState, UpdatesBridge } from "./updateState";

/** What a screen needs to show updates and act on them; the actions reject with the reason a request failed. */
export type AppUpdates = {
  readonly bridge: UpdatesBridge;
  readonly error: string | null;
  readonly state: UpdateState | null;
};

/**
 * The app updates of the computer the window runs on, kept current as they change; null where the window cannot
 * update itself (a browser, the phone) or shows a paired host, whose app is not this one.
 */
export function useAppUpdates(): AppUpdates | null {
  const isRemote = useIsRemoteHost();
  const bridge = typeof window === "undefined" || isRemote ? null : (window.iskios?.updates ?? null);
  const [state, setState] = useState<UpdateState | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (bridge === null) return;
    let isCurrent = true;
    bridge.state().then(
      (current) => isCurrent && setState(current),
      (reason) => isCurrent && setError(messageOf(reason)),
    );
    const stop = bridge.listen((next) => isCurrent && setState(next));
    return () => {
      isCurrent = false;
      stop();
    };
  }, [bridge]);
  return bridge === null ? null : { bridge, error, state };
}
