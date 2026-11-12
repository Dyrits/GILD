import type { KnownHost } from "@iskios/contracts";
import { useEffect, useMemo, useState } from "react";
import { ServiceClient } from "./client";

/** Owns the window's local service and its selected host connection. */
export function useHostConnection() {
  // The local service always stays connected: it lists the hosts and pairs with them. The window shows either its own
  // data or, through it, a paired host's (device-pairing).
  const [localClient, setLocalClient] = useState<ServiceClient | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [hostClient, setHostClient] = useState<ServiceClient | null>(null);
  const [hosts, setHosts] = useState<readonly KnownHost[]>([]);
  const [computerName, setComputerName] = useState("This computer");
  const [isAddingHost, setIsAddingHost] = useState(false);
  const [linkFailure, setLinkFailure] = useState<string | null>(null);
  const client = hostId === null ? localClient : hostClient;
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    let isCurrent = true;
    let opened: ServiceClient | null = null;
    ServiceClient.connect().then(
      (connected) => {
        if (!isCurrent) return connected.close();
        opened = connected;
        setLocalClient(connected);
      },
      (error: Error) => {
        if (isCurrent) setFailure(error.message);
      },
    );
    return () => {
      isCurrent = false;
      opened?.close();
    };
  }, []);
  // The hosts this installation is paired with, and its own computer's name, read from the local service.
  useEffect(() => {
    if (localClient === null) return;
    const load = () => {
      localClient.request({ _tag: "ListHosts" }).then(setHosts, () => {});
      localClient.request({ _tag: "ReadHostName" }).then(setComputerName, () => {});
    };
    load();
    const unsubscribe = localClient.subscribe(load);
    return () => void unsubscribe();
  }, [localClient]);
  // The link to the chosen host opens when it is chosen and closes when another is.
  useEffect(() => {
    if (hostId === null) return;
    let isCurrent = true;
    let opened: ServiceClient | null = null;
    ServiceClient.connect(hostId).then(
      (connected) => {
        if (!isCurrent) return connected.close();
        opened = connected;
        setHostClient(connected);
      },
      (error: Error) => {
        if (isCurrent) setFailure(error.message);
      },
    );
    return () => {
      isCurrent = false;
      opened?.close();
      setHostClient(null);
    };
  }, [hostId]);
  // Why the link to a host is down, when it is, for the banner over the window.
  useEffect(() => {
    if (hostClient === null) {
      setLinkFailure(null);
      return;
    }
    setLinkFailure(hostClient.failure);
    const unsubscribe = hostClient.subscribeFailure(() => setLinkFailure(hostClient.failure));
    return () => void unsubscribe();
  }, [hostClient]);
  const activeHost = useMemo(
    () => ({
      hostId,
      name: hostId === null ? computerName : (hosts.find((host) => host.id === hostId)?.name ?? "Host"),
    }),
    [computerName, hostId, hosts],
  );
  return {
    activeHost,
    client,
    computerName,
    failure,
    hostClient,
    hostId,
    hosts,
    isAddingHost,
    linkFailure,
    localClient,
    setFailure,
    setHostId,
    setIsAddingHost,
  };
}
