import type { Ref } from "react";

/** The visible shell's rendered output, flushed before the owner sends it. */
export interface TerminalPanelHandle {
  focus(): void;
  snapshot(): Promise<{ cwd: string; text: string }>;
}

/** A desktop terminal, retained while hidden so its next snapshot includes ongoing output. */
export interface TerminalPanelProps {
  readonly cwd: string | null;
  readonly id: string;
  readonly onReady: () => void;
  readonly ref?: Ref<TerminalPanelHandle>;
}
