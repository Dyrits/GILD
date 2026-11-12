import type { KnownHost } from "@iskios/contracts";
import { createContext, useContext } from "react";

/** The computer whose Iskios the window shows: this one, or a paired host's (device-pairing). */
export interface ActiveHost {
  /** The paired host's identifier; null while the window shows this computer's own Iskios. */
  readonly hostId: string | null;
  readonly name: string;
}

export const ActiveHostContext = createContext<ActiveHost>({ hostId: null, name: "This computer" });

/** Which computer's Iskios the window shows, so a screen can leave out what only works on the computer it runs on. */
export const useActiveHost = () => useContext(ActiveHostContext);

/** Whether the window shows a paired host's Iskios and not its own computer's. */
export const useIsRemoteHost = () => useContext(ActiveHostContext).hostId !== null;

/** What the top bar's host menu needs: the computers it lists, the one the window shows, and what choosing one does. */
export interface HostMenuProps {
  /** The paired host the window shows; null for this computer. */
  readonly activeId: string | null;
  /** This computer's own name. */
  readonly computerName: string;
  readonly hosts: readonly KnownHost[];
  readonly onAdd: () => void;
  readonly onChoose: (hostId: string | null) => void;
}

/** The host menu the window offers; null where the window cannot pair (outside the desktop app). */
export const HostMenuContext = createContext<HostMenuProps | null>(null);
