import type { BackupCompanion, Settings, Tier } from "@iskios/contracts";
import { TierName } from "@iskios/contracts";
import type { Runner } from "./runners";

/**
 * A Companion preset: one of the Workshop's three tiers that the owner has set, a Companion and the backup Companions that go with it, which choosing it puts in place together (companion-presets).
 */
export type Preset = {
  readonly backups: Tier["backups"];
  readonly name: TierName;
  readonly runner: Runner;
};

/** What a Companion picker needs to offer the presets: those the owner set, the backups of the stack in use (null while unread, so none is marked chosen too early), and what choosing one does. */
export type PresetChoice = {
  readonly backups: ReadonlyArray<BackupCompanion> | null;
  readonly onPreset: (preset: Preset) => void;
  readonly presets: ReadonlyArray<Preset>;
};

/** Whether two runners are the same Companion: harness, account, model, and effort. */
export const isSameRunner = (current: Runner, next: Runner) =>
  current.harness === next.harness &&
  current.model === next.model &&
  current.effort === next.effort &&
  current.accountId === next.accountId;

/** The presets a picker offers, in the order Light, Balanced, Heavy; a tier left unset is not offered. */
export const presetsOf = (tiers: Settings["tiers"]): ReadonlyArray<Preset> =>
  TierName.literals.flatMap((name) => {
    const tier = tiers[name];
    if (tier === null) return [];
    const { backups, ...runner } = tier;
    return [{ backups, name, runner }];
  });

/** Whether two backup lists hold the same Companions in the same order; a list not given or not yet read matches only another one. */
export const isSameBackups = (
  current: ReadonlyArray<BackupCompanion> | null | undefined,
  next: ReadonlyArray<BackupCompanion> | null | undefined,
) =>
  current == null || next == null
    ? current == null && next == null
    : current.length === next.length &&
      current.every((backup, index) => {
        const other = next[index];
        return other !== undefined && isSameRunner(backup, other);
      });

/** Whether two stacks have the same primary Companion and the same backups in the same order. */
export const isSameStack = (current: Tier, next: Tier) =>
  isSameRunner(current, next) && isSameBackups(current.backups, next.backups);

/** Whether two preset lists offer the same presets, each with the same whole stack. */
export const isSamePresets = (current: ReadonlyArray<Preset> | undefined, next: ReadonlyArray<Preset> | undefined) =>
  current === undefined || next === undefined
    ? current === next
    : current.length === next.length &&
      current.every((preset, index) => {
        const other = next[index];
        return (
          other !== undefined &&
          preset.name === other.name &&
          isSameStack(presetChangeOf(preset), presetChangeOf(other))
        );
      });

/** The first preset whose whole stack matches, or null for a custom stack or one not yet read. */
export const presetOf = (presets: ReadonlyArray<Preset>, stack: Tier | null): Preset | null =>
  stack === null ? null : (presets.find((preset) => isSameStack(presetChangeOf(preset), stack)) ?? null);

/** Choosing a preset always replaces the whole stack, including an empty backup list. */
export const presetChangeOf = (preset: Preset) => ({
  ...preset.runner,
  backups: preset.backups,
});
