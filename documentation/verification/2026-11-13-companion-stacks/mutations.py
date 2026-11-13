"""Shows that the preset checks can fail: breaks one line of production code at a time in a separate copy of the end state and runs the test that covers it.
Usage: python3 mutations.py <path-of-a-worktree-with-the-end-state-applied>
Each mutation must make its test fail; the file is restored afterwards."""
import shutil
import subprocess
import sys

root = sys.argv[1]
mutations = [
    ("a card's default backup list is checked again (off-topic and Iskios Default chip)", "packages/service/src/work/backups.ts",
     "JSON.stringify(backups) === JSON.stringify(defaults)", "false", "packages/service/test/work/suggestionBackups.test.ts"),
    ("a settings change replaces every tier, not only the named ones", "packages/service/src/core/settings.ts",
     "tiers: { ...saved.tiers, ...change.tiers },", "tiers: { ...change.tiers } as never,", "packages/service/test/presets.test.ts"),
    ("choosing a preset does not store its backups", "packages/service/src/work/handover.ts",
     "if (backups !== null) yield* sql`UPDATE threads SET backups", "if (false as boolean) yield* sql`UPDATE threads SET backups", "packages/service/test/work/presetStacks.test.ts"),
    ("a side-quest always inherits its parent's backups", "packages/service/src/work/tree.ts",
     "opening.backups === null ? parent.backups : JSON.stringify(opening.backups)", "parent.backups", "packages/service/test/work/presetStacks.test.ts"),
    ("a preset is marked chosen by its primary Companion alone", "apps/app/src/editors/presets.ts",
     "isSameRunner(current, next) && isSameBackups(current.backups, next.backups)", "isSameRunner(current, next)", "apps/app/test/editors/presets.test.ts"),
    ("a Ritual on a tier gets no fallbacks", "packages/service/src/work/guildmasterCompanions.ts",
     "? backupsOf(settings, choice.tier)", "? []", "packages/service/test/work/guildmasterPresets.test.ts"),
    ("a tier saved before presets had backups no longer reads", "packages/contracts/src/companions.ts",
     "BackupCompanions.pipe(Schema.withDecodingDefaultKey(Effect.succeed([])))", "BackupCompanions", "packages/service/test/presets.test.ts"),
    ("a request naming a tier without backups is accepted", "packages/contracts/src/companions.ts",
     "  backups: BackupCompanions,\n  effort: EffortChoice,\n  harness: HarnessName,\n  model: ModelChoice,\n});\nexport type Tier",
     "  backups: BackupCompanions.pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),\n  effort: EffortChoice,\n  harness: HarnessName,\n  model: ModelChoice,\n});\nexport type Tier", "packages/service/test/presets.test.ts"),
]
failed = 0
for name, path, old, new, test in mutations:
    full = f"{root}/{path}"
    shutil.copy(full, full + ".orig")
    source = open(full).read()
    if old not in source:
        print(f"SKIPPED (pattern not found) {name}")
        failed += 1
        shutil.move(full + ".orig", full)
        continue
    open(full, "w").write(source.replace(old, new, 1))
    result = subprocess.run(["node", "node_modules/vitest/vitest.mjs", "run", test], cwd=root, capture_output=True, text=True)
    shutil.move(full + ".orig", full)
    status = "FAILS as it must" if result.returncode != 0 else "STILL PASSES (check cannot fail)"
    if result.returncode == 0:
        failed += 1
    print(f"{status}: {name} [{test}]")
sys.exit(1 if failed else 0)
