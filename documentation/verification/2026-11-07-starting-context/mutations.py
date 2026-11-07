# Mutation check for batch 17 (the warning before a thread starts with too large a starting context): applies
# each mutant, runs the starting context, thread, and label tests, restores. Run against a separate copy of
# the end state, never the checkout:
#   python3 documentation/verification/2026-11-07-starting-context/mutations.py <copy>
import subprocess, sys
root=sys.argv[1]
service='packages/service/src'
labels='apps/app/src'
mutants=[
 (service,'startingContext.ts','tokens * 100 > windowTokens * startingContextWarningPercent','tokens * 100 >= windowTokens * 100'),
 (service,'startingContext.ts','export const startingContextWarningPercent = 25;','export const startingContextWarningPercent = 30;'),
 (service,'startingContext.ts','intel: intel.tokens,','intel: 0,'),
 (service,'startingContext.ts','journal: tokensOf(yield* readJournalText(parentId, null, null)),','journal: 0,'),
 (service,'startingContext.ts','openerMessages: openerMessages === null ? 0 : tokensOf(openerMessages),','openerMessages: 0,'),
 (service,'startingContext.ts','request: tokensOf(request),','request: 0,'),
 (service,'startingContext.ts','const tokens = parts.intel + parts.journal + parts.openerMessages + parts.request;','const tokens = parts.openerMessages;'),
 (service,'startingContext.ts','.filter((choice) => contextWindows[choice] > windowTokens)','.filter((choice) => contextWindows[choice] >= windowTokens)'),
 (service,'tree.ts','if (!shouldStartAnyway) {','if (false) {'),
 (service,'tree.ts','if (refusal !== null) return yield* invalid(refusal);',''),
 (service,'intel.ts','recall.index.reduce((sum, row) => sum + tokensOf(summaryOf(row.text)), 0),','0,'),
 (labels,'labels.ts','Math.round((context.tokens * 100) / context.windowTokens)','Math.floor((context.tokens * 100) / context.windowTokens)'),
 (labels,'labels.ts',"Opener's messages ${tokenCountOf(parts.openerMessages)}","Opener's messages ${tokenCountOf(parts.intel)}"),
]
tests={
 service:['packages/service/test/startingContext.test.ts','packages/service/test/threads.test.ts','packages/service/test/intel.test.ts'],
 labels:['apps/app/test/labels.test.ts'],
}
caught=0
for folder,f,a,b in mutants:
    p=f'{root}/{folder}/{f}'; orig=open(p).read()
    assert a in orig, (f,a)
    open(p,'w').write(orig.replace(a,b,1))
    try:
        r=subprocess.run(['node_modules/.bin/electron','node_modules/vitest/vitest.mjs','run',*tests[folder]],cwd=root,env={'ELECTRON_RUN_AS_NODE':'1','PATH':'/usr/bin:/bin:/opt/homebrew/bin'},capture_output=True,text=True,timeout=300)
        ok = r.returncode!=0
    finally:
        open(p,'w').write(orig)
    caught+=ok
    print(('CAUGHT  ' if ok else 'SURVIVED'), f, a[:70].replace('\n',' '))
print(f'{caught}/{len(mutants)} caught')
