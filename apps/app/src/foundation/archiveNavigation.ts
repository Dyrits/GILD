import type { QuestPlacement } from "@iskios/contracts";
import { createContext } from "react";

/** Successful archive actions return to their parent; cancelled or refused actions never call this boundary. */
export const ArchiveNavigation = createContext<{
  quest: (parent: QuestPlacement) => void;
  realm: () => void;
}>({ quest: () => {}, realm: () => {} });
