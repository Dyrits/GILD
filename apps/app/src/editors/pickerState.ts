import type { CompanionPickerProps } from "./companionPicker";
import { isSameBackups, isSamePresets } from "./presets";

/** Whether two picker states draw the same: their data, not their handlers, which are new on every render. */
export const isSamePicker = (previous: CompanionPickerProps | null, next: CompanionPickerProps) =>
  previous !== null &&
  previous.accountId === next.accountId &&
  previous.effort === next.effort &&
  previous.harness === next.harness &&
  previous.harnesses === next.harnesses &&
  previous.isAccountShown === next.isAccountShown &&
  previous.model === next.model &&
  previous.isIskios === next.isIskios &&
  isSameBackups(previous.presetChoice?.backups, next.presetChoice?.backups) &&
  isSamePresets(previous.presetChoice?.presets, next.presetChoice?.presets) &&
  previous.extra?.key === next.extra?.key &&
  previous.panel?.key === next.panel?.key &&
  previous.effortOptions.join() === next.effortOptions.join();
