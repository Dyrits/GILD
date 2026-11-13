"""Exercise the workflow's Bash steps offline with fake CLIs: python3 documentation/verification/2026-11-10-release-workflow.py."""

import json
import os
from pathlib import Path
import subprocess
import tempfile


root = Path(__file__).resolve().parents[2]
workflow = json.loads(subprocess.check_output([
    "bun", "-e",
    'console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(".github/workflows/package.yml").text())))',
], cwd=root))
build = next(step["run"] for step in workflow["jobs"]["package"]["steps"] if step.get("name") == "Build installer")
publish = next(step["run"] for step in workflow["jobs"]["release"]["steps"] if step.get("name") == "Publish GitHub Release")

with tempfile.TemporaryDirectory(prefix="gild-release-check-") as folder:
    directory = Path(folder)
    binaries = directory / "bin"
    binaries.mkdir()
    log = directory / "commands"
    fake = '''#!/bin/bash
printf '%s\\n' "$*" >> "$COMMAND_LOG"
if [[ "${0##*/}" == sha512sum ]]; then echo "hash  Gild-mac-arm64.dmg"; fi
if [[ "$1 $2" == "release view" ]]; then
  if [[ "$GH_STATE" == missing ]]; then exit 1; fi
  if [[ "$*" == *--json* ]]; then printf '%s\\n' "$GH_STATE"; fi
fi
'''
    for name in ("gh", "bun", "sha512sum"):
        executable = binaries / name
        executable.write_text(fake)
        executable.chmod(0o755)
    installers = directory / "installers"
    installers.mkdir()
    for name in ("Gild-mac-arm64.dmg", "Gild-mac-x64.dmg", "Gild-win-x64.exe", "Gild-linux-x64.AppImage"):
        (installers / name).write_text("fake installer")

    for name in ("latest.yml", "latest-linux.yml"):
        (installers / name).write_text("version: 1")

    def run(script, **values):
        log.write_text("")
        environment = dict(os.environ, PATH=f"{binaries}{os.pathsep}{os.environ['PATH']}", COMMAND_LOG=str(log))
        environment.update(values)
        result = subprocess.run(["bash", "-e", "-o", "pipefail", "-c", script], cwd=directory, env=environment, capture_output=True)
        return result.returncode, log.read_text()

    for tag, prerelease in (("v0.1.0-alpha.1", "true"), ("v1.0.0", "false")):
        code, commands = run(publish, RELEASE_TAG=tag, GH_STATE="missing")
        assert code == 0, commands
        assert f"release create {tag} --verify-tag --generate-notes --draft --prerelease={prerelease}" in commands
        assert commands.index("release upload") < commands.index("release edit")
        assert f"--draft=false --prerelease={prerelease}" in commands
        assert ".dmg" in commands and ".exe" in commands and ".AppImage" in commands
        # The update files and the checksums of the installers are published with them.
        assert "-- Gild-mac-arm64.dmg Gild-mac-x64.dmg Gild-win-x64.exe Gild-linux-x64.AppImage" in commands
        assert "installers/latest.yml" in commands and "installers/latest-linux.yml" in commands
        assert "installers/SHA512SUMS.txt --clobber" in commands
    code, commands = run(publish, RELEASE_TAG="v1.0.0", GH_STATE="true")
    assert code == 0 and "release create" not in commands and "release upload" in commands
    code, commands = run(publish, RELEASE_TAG="v1.0.0", GH_STATE="false")
    assert code != 0 and "release upload" not in commands and "release edit" not in commands
    (installers / "latest-linux.yml").unlink()
    code, commands = run(publish, RELEASE_TAG="v1.0.0", GH_STATE="missing")
    assert code != 0 and "release upload" not in commands, (code, commands)
    (installers / "latest-linux.yml").write_text("version: 1")
    (installers / "Gild-linux-x64.AppImage").unlink()
    code, commands = run(publish, RELEASE_TAG="v1.0.0", GH_STATE="missing")
    assert code != 0 and commands == ""
    for kind, ref, expected in (("tag", "v0.1.0-alpha.1", " --config.extraMetadata.version=0.1.0-alpha.1"), ("branch", "main", "")):
        code, commands = run(build, BUILD_ARCH="arm64", GITHUB_REF_TYPE=kind, GITHUB_REF_NAME=ref)
        assert code == 0 and commands == f"run package --arm64{expected}\n", commands

assert workflow["jobs"]["release"]["needs"] == "package"
assert workflow["jobs"]["release"]["permissions"] == {"contents": "write"}
assert workflow["permissions"] == {"contents": "read"}
print("Passed 8 offline shell scenarios and release dependency/permission checks; no network or real GitHub commands ran.")
