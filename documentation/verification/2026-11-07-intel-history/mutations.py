# Mutation check for batch 15 (intel history with undo): applies each mutant to the service, runs the intel
# tests, restores. Run against a separate copy of the end state, never the working checkout:
#   python3 documentation/verification/2026-11-07-intel-history/mutations.py <copy>
import subprocess, sys
root=sys.argv[1]
mutants=[
 ('intelFading.ts','halfLife * Math.log2(1 / dormantBelow)','halfLife * Math.log2(1 / archivedBelow)'),
 ('intelFading.ts','.filter((step) => step.at <= fading.now)',''),
 ('intelFading.ts','if (intel.isPinned === 1 || halfLifeDays === null) return [];\n  const halfLife','if (intel.isPinned === 2) return [];\n  const halfLife'),
 ('intelViews.ts','yield* recordFadingStepsOf(intelIds);',''),
 ('intelHistory.ts','if (before !== null) yield* recordFadingSteps(before);',''),
 ('intelHistoryViews.ts','canUndo: row.actor !== "Fading" && row.undoneAt === null','canUndo: row.actor !== "Fading"'),
 ('intelHistoryViews.ts','.toSorted((a, b) => b.row.at - a.row.at || b.order - a.order)','.toSorted((a, b) => a.row.at - b.row.at || a.order - b.order)'),
 ('intelHistoryViews.ts','WHERE h.after_state IS NULL AND h.before_state IS NOT NULL','WHERE h.before_state IS NOT NULL'),
 ('intelHistory.ts','yield* sql`DELETE FROM intel_history WHERE intel_id IN (','yield* sql`DELETE FROM intel_history WHERE 0 AND intel_id IN ('),
 ('intelHistory.ts','(SELECT title FROM threads WHERE id = ${threadId})','NULL'),
 ('intelUndo.ts','if (entry.undoneAt !== null) return','if (false) return'),
 ('intelUndo.ts','if (isFadingEntryId(entryId)) {','if (false) {'),
 ('intelUndo.ts','if (current === null) return yield* invalid("This intel is deleted: undo its deletion first.");',''),
 ('intelUndo.ts','yield* markUndone(entryId);',''),
 ('intelUndo.ts','lastUsedAt: current.lastUsedAt === after.lastUsedAt ? before.lastUsedAt : current.lastUsedAt','lastUsedAt: current.lastUsedAt'),
 ('intelUndo.ts','kind: back("kind"),','kind: current.kind,'),
 ('intelUndo.ts','scope: back("scope"),','scope: current.scope,'),
 ('intelUndo.ts','      yield* writeSnapshot(entry.before);\n',''),
 ('intelChanges.ts','yield* recordSaved(intelId, actor, now);','yield* recordSaved(intelId, actor);'),
 ('intelChanges.ts','isWidening ? "Widened" : "Corrected"','"Corrected"'),
 ('intelChanges.ts','    yield* recordSaved(intelId, threadActor(threadId));\n',''),
 ('deleting.ts','      yield* eraseThreadHistory(ids);\n',''),
]
tests=['packages/service/test/intelHistory.test.ts','packages/service/test/intelReplacing.test.ts','packages/service/test/intelOverTime.test.ts','packages/service/test/intel.test.ts']
caught=0
for f,a,b in mutants:
    p=f'{root}/packages/service/src/{f}'; orig=open(p).read()
    assert a in orig, (f,a)
    open(p,'w').write(orig.replace(a,b,1))
    try:
        r=subprocess.run(['node_modules/.bin/electron','node_modules/vitest/vitest.mjs','run',*tests],cwd=root,env={'ELECTRON_RUN_AS_NODE':'1','PATH':'/usr/bin:/bin:/opt/homebrew/bin'},capture_output=True,text=True,timeout=300)
        ok = r.returncode!=0
    finally:
        open(p,'w').write(orig)
    caught+=ok
    print('CAUGHT' if ok else 'SURVIVED', f, a[:60].replace('\n',' '))
print(f'{caught}/{len(mutants)}')
