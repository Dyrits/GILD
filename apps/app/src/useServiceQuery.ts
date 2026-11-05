import type { Request, ResultOf } from "@openmission/contracts";
import { useEffect, useState } from "react";
import type { ServiceClient } from "./client";

/** Runs a query now and again after every committed change. */
export function useServiceQuery<R extends Request>(client: ServiceClient, request: R, key: string) {
  const [data, setData] = useState<ResultOf<R["_tag"]>>();
  const [error, setError] = useState<string>();

  // biome-ignore lint/correctness/useExhaustiveDependencies: the key identifies the request.
  useEffect(() => {
    let current = true;
    const load = () =>
      client.request(request).then(
        (value) => {
          if (!current) return;
          setData(value);
          setError(undefined);
        },
        (reason: Error) => {
          if (current) setError(reason.message);
        },
      );
    load();
    const unsubscribe = client.subscribe(load);
    return () => {
      current = false;
      unsubscribe();
    };
  }, [client, key]);

  return { data, error };
}
