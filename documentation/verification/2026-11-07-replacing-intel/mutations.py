# Mutation check for batch 14 (replacing duplicates, origins, relied on): applies each mutant to the service,
# runs the intel tests, restores. Run against a separate copy of the end state, never the working checkout:
#   python3 documentation/verification/2026-11-07-replacing-intel/mutations.py <copy>
import subprocess, sys
root=sys.argv[1]
mutants=[
 ('intelDuplicates.ts','const sameAt = 0.6;','const sameAt = 0.9;'),
 ('intelDuplicates.ts','const sameAt = 0.6;','const sameAt = 0.3;'),
 ('intelDuplicates.ts','const fewestShared = 2;','const fewestShared = 0;'),
 ('intelDuplicates.ts','isSamePlace(candidate.row) && ',''),
 ('intelDuplicates.ts',' && stateOfIntel(row, fading) !== "Archived"',''),
 ('intelDuplicates.ts','candidate !== same && candidate.closeness >= closeAt','candidate !== same && candidate.closeness >= 0.9'),
 ('intelChanges.ts','if (replaced.scope === "Global") {','if (false) {'),
 ('intelChanges.ts','last_used_at = ${now},\n        origin_kind','last_used_at = last_used_at,\n        origin_kind'),
 ('intelChanges.ts','if (isApplied && change.kind === "Replace" && change.intelId !== null) {','if (false) {'),
 ('intelChanges.ts','change.threadId, originOf(change));','change.threadId, null);'),
 ('intelChanges.ts','return answer(`Not saved: ${origin}.`, true);',''),
 ('intelOrigins.ts','ORDER BY sequence DESC LIMIT 1','ORDER BY sequence LIMIT 1'),
 ('intelOrigins.ts','AND delivered_turn_id IS NOT NULL',''),
 ('intelOrigins.ts','message.senderKind === "user" ? null','message.senderKind === "thread" ? null'),
 ('intelOrigins.ts','excerpt: summaryOf(entry.text)','excerpt: ""'),
 ('intelViews.ts','if (counted.length === 0) return','if (false) return'),
 ('intelViews.ts','(yield* searchableOf(threadId)).filter((row) => ids.includes(row.id))','(yield* listInScope(yield* readScopeChain(threadId))).filter((row) => ids.includes(row.id))'),
 ('intelViews.ts','yield* countUses(counted);',''),
 ('intel.ts','say so with relied_on_intel','say so'),
 ('threadTools.ts','.check(Schema.isMinLength(1))',''),
]
caught=0
for f,a,b in mutants:
    p=f'{root}/packages/service/src/{f}'; orig=open(p).read()
    assert a in orig, (f,a)
    open(p,'w').write(orig.replace(a,b,1))
    try:
        r=subprocess.run(['node_modules/.bin/electron','node_modules/vitest/vitest.mjs','run','packages/service/test/intelReplacing.test.ts','packages/service/test/intelOverTime.test.ts','packages/service/test/intel.test.ts'],cwd=root,env={'ELECTRON_RUN_AS_NODE':'1','PATH':'/usr/bin:/bin:/opt/homebrew/bin'},capture_output=True,text=True,timeout=300)
        ok = r.returncode!=0
    finally:
        open(p,'w').write(orig)
    caught+=ok
    print('CAUGHT' if ok else 'SURVIVED', f, a[:60].replace('\n',' '))
print(f'{caught}/{len(mutants)}')
