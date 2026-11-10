"""Checks the folder layout of CHG-0125 from the import graph. Usage: python3 -I check-layout.py <repository root>. Exit code 1 when any check fails."""
import os, posixpath, re, sys

root = os.path.abspath(sys.argv[1])
os.chdir(root)
failures = []

def fail(check, message):
    failures.append(f"{check}: {message}")

def sources(base, suffixes=(".ts", ".tsx")):
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if not d.startswith(".") and d != "node_modules"]
        for name in filenames:
            if name.endswith(suffixes):
                yield posixpath.join(dirpath.replace(os.sep, "/"), name)

statement = re.compile(r'(?:import|export)\s+(?:type\s+)?(?:\{(?P<names>[^}]*)\}\s*|\*\s*(?:as\s+\w+\s*)?)?from\s*"(?P<spec>\.[^"]*)"', re.S)

def imports(path):
    text = open(path).read()
    for match in statement.finditer(text):
        target = posixpath.normpath(posixpath.join(posixpath.dirname(path), match["spec"]))
        names = [n.strip().removeprefix("type ").split(" as ")[0].strip() for n in (match["names"] or "").split(",") if n.strip()]
        yield target, names

def folder(path, base):
    relative = posixpath.relpath(path, base)
    parts = relative.split("/")
    return parts[0] if len(parts) > 1 else "."

# C1 and C2: the service
service = "packages/service/src"
leaves = {"core": set(), "harness": {"core"}, "lore": {"core"}, "policy": {"core"}}
exposed = {}
for name in leaves:
    index = open(f"{service}/{name}/index.ts").read()
    exposed[name] = {n for m in statement.finditer(index) for n in [x.strip().removeprefix("type ").split(" as ")[0].strip() for x in (m["names"] or "").split(",") if x.strip()]}
used = {name: set() for name in leaves}
for path in sources(service):
    own = folder(path, service)
    for target, names in imports(path):
        if not target.startswith(service + "/"):
            continue
        other = folder(target, service)
        if other == own:
            continue
        if own in leaves and other not in leaves[own]:
            fail("C1 one-way", f"{path} ({own}) imports {target} ({other})")
        if other in leaves:
            if not target.endswith(f"/{other}/index.ts") and not target.endswith(f"/{other}"):
                fail("C2 interface", f"{path} imports {target}, not {other}/index.ts")
            else:
                used[other].update(names)
for name, names in exposed.items():
    for unused in sorted(names - used[name]):
        fail("C2 interface", f"{name}/index.ts exports {unused}, which no other folder's source file imports")
    for missing in sorted(used[name] - names):
        fail("C2 interface", f"{name}/index.ts lacks {missing}")
count = sum(len(v) for v in exposed.values())

# C3: the app is one downward chain
chain = ["foundation", "attachments", "terminal", "ui", "editors", "crest", "realms", "rituals", "quests", "lore", "conversation", "settings", "shell"]
rank = {name: i for i, name in enumerate(chain)}
app = "apps/app/src"
for path in sources(app):
    own = folder(path, app)
    if own not in rank:
        fail("C3 app chain", f"{path} is in no listed folder")
        continue
    for target, _ in imports(path):
        if not target.startswith(app + "/") and not os.path.exists(target) and not any(os.path.exists(target + e) for e in (".ts", ".tsx", ".web.tsx")):
            fail("C3 app chain", f"{path} imports {target}, which does not exist")
            continue
        if target.startswith(app + "/"):
            other = folder(target, app)
            if other in rank and rank[other] > rank[own]:
                fail("C3 app chain", f"{path} ({own}) imports {target} ({other}), later in the chain")

# C4: tests mirror the folders
overrides = {"loreOverTime", "loreReplacing", "liveHarnesses", "companionLabel"}
for package, base in (("packages/service", service), ("apps/app", app)):
    tests = f"{package}/test"
    stems = {}
    for path in sources(base, (".ts", ".tsx", ".md")):
        stems.setdefault(posixpath.basename(path).split(".")[0], folder(path, base))
    for path in sources(tests, (".test.ts",)):
        stem = posixpath.basename(path)[: -len(".test.ts")]
        where = folder(path, tests)
        if stem in overrides or stem not in stems:
            continue
        expected = stems[stem]
        if (where if where != "." else ".") != (expected if expected != "." else "."):
            fail("C4 tests mirror", f"{path} tests {stem}, which lives in {expected}")

for message in failures:
    print("FAIL", message)
print(f"checked: {count} names in 4 service indexes; {sum(1 for _ in sources(service))} service files; {sum(1 for _ in sources(app))} app files")
print("RESULT", "FAIL" if failures else "PASS")
sys.exit(1 if failures else 0)
