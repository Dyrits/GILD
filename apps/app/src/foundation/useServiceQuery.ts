import type { Request, ResultOf } from "@iskios/contracts";
import { useEffect, useState } from "react";
import type { ServiceClient } from "./client";

/** Runs a query now and again after every committed change. */
export function useServiceQuery<R extends Request>(client: ServiceClient, request: R, key: string) {
  const [data, setData] = useState<ResultOf<R["_tag"]> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the key identifies the request.
  useEffect(() => {
    let isCurrent = true;
    // Only the latest read may show its outcome, so a slow older reply cannot replace a newer one.
    let latest = 0;
    const load = () => {
      const mine = ++latest;
      return client.request(request).then(
        (value) => {
          if (!isCurrent || mine !== latest) return;
          setData(value);
          setError(null);
        },
        (reason: Error) => {
          if (isCurrent && mine === latest) setError(reason.message);
        },
      );
    };
    load();
    const unsubscribe = client.subscribe(load);
    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [client, key]);

  return { data, error };
}
