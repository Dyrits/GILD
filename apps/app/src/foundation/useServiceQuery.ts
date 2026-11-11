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
    const load = () =>
      client.request(request).then(
        (value) => {
          if (!isCurrent) return;
          setData(value);
          setError(null);
        },
        (reason: Error) => {
          if (isCurrent) setError(reason.message);
        },
      );
    load();
    const unsubscribe = client.subscribe(load);
    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [client, key]);

  return { data, error };
}
