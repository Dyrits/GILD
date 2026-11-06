# Mutation check for batch 12 (scoped intel): applies each mutant to the service, runs intel.test.ts, restores.
# Run from anywhere: python3 documentation/verification/2026-11-06-scoped-intel/mutations.py
import subprocess, sys, shutil
root='/Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission'
mutants=[
 ('intelChanges.ts','if (isWidening || row.scope === "Global")','if (row.scope === "Global")'),
 ('intelChanges.ts','if (placement.scope === "Global") {\n      yield* insertChange({ ...change, intelId: null, status: "Awaiting" });','if (false) {\n      yield* insertChange({ ...change, intelId: null, status: "Awaiting" });'),
 ('intelChanges.ts','return tokens > intelLimit','return tokens > intelLimit * 2'),
 ('intelChanges.ts','    if (row.scope === "Global") {\n      yield* insertChange({ ...change, status: "Awaiting" });','    if (false) {\n      yield* insertChange({ ...change, status: "Awaiting" });'),
 ('intel.ts','return rows.toSorted((a, b) => rankOf(a) - rankOf(b));','return rows.toSorted((a, b) => rankOf(b) - rankOf(a));'),
 ('intel.ts','isOverWarning: tokens * 100 > windowTokens * intelWarningPercent','isOverWarning: tokens > windowTokens * intelWarningPercent'),
 ('intel.ts',"WHERE (i.scope = 'Thread' AND i.thread_id IN ${sql.in(chain.threads)})","WHERE (i.scope = 'Thread' AND i.thread_id IN ${sql.in(chain.threads.slice(0, 1))})"),
 ('intel.ts',"OR (i.scope = 'Workspace' AND i.workspace_id = ${chain.workspaceId})","OR (i.scope = 'Workspace')"),
 ('intel.ts',"yield* sql`DELETE FROM intels WHERE scope = 'Thread' AND thread_id IN ${sql.in(threadIds)}`;",""),
 ('intel.ts',"always run the tests before a commit","run checks"),
 ('intelChanges.ts','const isApplied = isApproved && (change.kind === "Save" || target !== null);','const isApplied = change.kind === "Save" || target !== null;'),
 ('intelChanges.ts','mission: { scope: "Thread", threadId: chain.topThreadId, workspaceId: null },','mission: { scope: "Thread", threadId: chain.threads[0] ?? null, workspaceId: null },'),
]
caught=0
for f,a,b in mutants:
    p=f'{root}/packages/service/src/{f}'; orig=open(p).read()
    assert a in orig, (f,a)
    open(p,'w').write(orig.replace(a,b,1))
    try:
        r=subprocess.run(['node_modules/.bin/electron','node_modules/vitest/vitest.mjs','run','packages/service/test/intel.test.ts'],cwd=root,env={'ELECTRON_RUN_AS_NODE':'1','PATH':'/usr/bin:/bin:/opt/homebrew/bin'},capture_output=True,text=True,timeout=300)
        ok = r.returncode!=0
    finally:
        open(p,'w').write(orig)
    caught+=ok
    print('CAUGHT' if ok else 'SURVIVED', f, a[:60].replace('\n',' '))
print(f'{caught}/{len(mutants)}')
