# Mutation check for batch 16 (widening and narrowing proposed from evidence): applies each mutant to the
# service, runs the intel tests, restores. Run against a separate copy of the end state, never the checkout:
#   python3 documentation/verification/2026-11-07-intel-proposals/mutations.py <copy>
import subprocess, sys
root=sys.argv[1]
mutants=[
 ('intelProposals.ts','.filter((group) => new Set(group.map((row) => row.workspaceId)).size >= 2)','.filter((group) => group.length >= 2)'),
 ('intelProposals.ts','.map((group) => group.toSorted((a, b) => b.updatedAt - a.updatedAt || b.savedAt - a.savedAt))','.map((group) => group)'),
 ('intelProposals.ts','newest === undefined || globals.some((row) => isSameOf(row.text, newest.text))','newest === undefined'),
 ('intelProposals.ts','const halfLifeDays = halfLifeDaysOf(row.kind, fading.halfLives);\n      if (halfLifeDays === null) continue;','const halfLifeDays = halfLifeDaysOf(row.kind, fading.halfLives) ?? 45;'),
 ('intelProposals.ts','if (row.savedAt > since) continue;',''),
 ('intelProposals.ts','others.length > 0 || ',''),
 ('intelProposals.ts','|| only.workspaceId === null || only.workspaceName === null',''),
 ('intelProposals.ts','AND u.at > ${since}',''),
 ('intelProposals.ts','return all.filter((evidence) => !decided.some((row) => row.id === evidence.proposal.id));','return all;'),
 ('intelProposals.ts','.filter(\n    (row) => stateOfIntel(row, fading) !== "Archived",\n  )','.filter(() => true)'),
 ('intelProposals.ts','for (const row of merged) yield* trackChange(row.id, "Merged", owner, mergeInto(kept.id, row));',''),
 ('intelProposals.ts','const uses = rows.reduce((sum, row) => sum + row.uses, 0);','const uses = kept.uses;'),
 ('intelProposals.ts','"Narrowed",\n      owner,','"Widened",\n      owner,'),
 ('intelProposals.ts','if (!isApproved) return null;',''),
 ('intelProposals.ts','yield* sql`UPDATE intel_uses SET intel_id = ${keptId} WHERE intel_id = ${row.id}`;',''),
 ('intelViews.ts','SELECT ${intelId}, ${now}, workspace_id FROM threads','SELECT ${intelId}, ${now}, NULL FROM threads'),
 ('intelDuplicates.ts','return closeness >= sameAt && shared >= fewestShared;','return closeness >= closeAt;'),
]
tests=['packages/service/test/intelProposals.test.ts','packages/service/test/intelHistory.test.ts','packages/service/test/intelReplacing.test.ts','packages/service/test/intelOverTime.test.ts','packages/service/test/intel.test.ts']
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
    print(('CAUGHT  ' if ok else 'SURVIVED'), f, a[:70].replace('\n',' '))
print(f'{caught}/{len(mutants)} caught')
