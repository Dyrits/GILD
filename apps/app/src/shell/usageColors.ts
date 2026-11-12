import type { HarnessName } from "@iskios/contracts";
import { colors } from "../foundation/theme";

/** Each harness's color in the graph, the list beside it, and the breakdowns. */
const harnessColors = {
  claude: colors.warning,
  codex: colors.violet,
  opencode: colors.textMuted,
} as const satisfies Record<HarnessName, string>;

/** A harness's color; turns that recorded no harness are grey. */
export const harnessColorOf = (harness: HarnessName | null) =>
  harness === null ? colors.borderStrong : harnessColors[harness];
