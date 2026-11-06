# Mutation check for batch 13 (intel over time): applies each mutant to the service, runs the intel tests, restores.
# Run against a separate worktree of the end state, never the working checkout:
#   python3 documentation/verification/2026-11-06-intel-over-time/mutations.py <worktree>
import subprocess, sys
root=sys.argv[1]
mutants=[
 ('intelFading.ts','if (intel.isPinned === 1 || halfLifeDays === null) return 1;','if (halfLifeDays === null) return 1;'),
 ('intelFading.ts','Rule: null,','Rule: 45,'),
 ('intelFading.ts','(1 + Math.log2(1 + intel.uses))','1'),
 ('intelFading.ts','strength < archivedBelow ? "Archived"','strength < 0 ? "Archived"'),
 ('intelFading.ts','export const dormantBelow = 0.15;','export const dormantBelow = 0.05;'),
 ('intelFading.ts','Temporary: halfLives.temporary,','Temporary: 3,'),
 ('intelFading.ts','if (flat.length <= summaryLength) return flat;','return flat;'),
 ('intel.ts','sum + tokensOf(summaryOf(row.text))','sum + tokensOf(row.text)'),
 ('intel.ts','toSorted((a, b) => a.savedAt - b.savedAt)','toSorted((a, b) => b.savedAt - a.savedAt)'),
 ('intel.ts','inFull: active.filter((row) => row.scope !== "Global"),','inFull: rows.filter((row) => row.scope !== "Global"),'),
 ('intel.ts','["1 dormant intel in your scope','["dormant intel in your scope'),
 ('intelViews.ts','intelsWith(word) <= rareWordLimit ? rareWordWeight : 1','1'),
 ('intelViews.ts','.toSorted((a, b) => b.score - a.score)','.toSorted(() => 0)'),
 ('intelViews.ts','&& stateOfIntel(row, fading) !== "Archived"',''),
 ('intelViews.ts','SET uses = uses + 1, last_used_at = ${now}','SET uses = uses + 1'),
 ('intelChanges.ts','insertIntel(placement, change.intelKind, change.text, change.threadId)','insertIntel(placement, "Fact", change.text, change.threadId)'),
 ('intelChanges.ts','yield* sql`UPDATE intels SET last_used_at = ${now} WHERE id = ${intelId}`;',''),
 ('intelViews.ts','state === "Pinned" ? row.isPinned === 1','state === "Pinned" ? true'),
 ('intelChanges.ts','${isPinned ? 1 : 0}','1'),
 ('intel.ts','save it as an intel of kind rule','save it as an intel'),
]
caught=0
for f,a,b in mutants:
    p=f'{root}/packages/service/src/{f}'; orig=open(p).read()
    assert a in orig, (f,a)
    open(p,'w').write(orig.replace(a,b,1))
    try:
        r=subprocess.run(['node_modules/.bin/electron','node_modules/vitest/vitest.mjs','run','packages/service/test/intelOverTime.test.ts','packages/service/test/intel.test.ts'],cwd=root,env={'ELECTRON_RUN_AS_NODE':'1','PATH':'/usr/bin:/bin:/opt/homebrew/bin'},capture_output=True,text=True,timeout=300)
        ok = r.returncode!=0
    finally:
        open(p,'w').write(orig)
    caught+=ok
    print('CAUGHT' if ok else 'SURVIVED', f, a[:60].replace('\n',' '))
print(f'{caught}/{len(mutants)}')
