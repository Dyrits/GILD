# Deliberate breaks of the device-pairing code, one claim each, run in a SEPARATE worktree of the end state (never the
# working checkout): each break must turn a check red; the file is restored after each. Usage:
#   python3 mutations.py <worktree path>     (the worktree has the end state and `bun install` done)
import re
import subprocess
import sys

WT = sys.argv[1].rstrip("/") + "/"
S="packages/service/test/remote/devicePairing.test.ts"
M=[
 ("C1 code works once", [("packages/service/src/remote/hostAccess.ts","SET used_at = ${now}","SET used_at = NULL"),("packages/service/src/remote/hostAccess.ts",'if (code.usedAt !== null) return { refusal: "code-used" } as const;',"")], [S]),
 ("C2 code expires", [("packages/service/src/remote/hostAccess.ts","if (code.expiresAt < now) return","if (false) return")], [S]),
 ("C3 typo caught by checksum", [("packages/channel/src/pairingCode.ts",'if (!checksumOf(body).every((byte, index) => byte === checksum[index])) return fail("bad-checksum");',"")], [S,"packages/channel/test/pairingCode.test.ts"]),
 ("C4 relay sees nothing readable", [("packages/channel/src/noise/cipherState.ts","return chacha20poly1305(this.k, nonce, ad).encrypt(plaintext);","return plaintext;"),("packages/channel/src/noise/cipherState.ts","plaintext = chacha20poly1305(this.k, encodeNonce(this.n), ad).decrypt(ciphertext);","plaintext = ciphertext;")], [S]),
 ("C6 host-only requests refused", [("packages/service/src/remote/frames.ts","source.isPairedDevice && (hostOnlyRequestTags","false && (hostOnlyRequestTags")], [S]),
 ("C7a disconnect forgets the device", [("packages/service/src/remote/hostAccess.ts","DELETE FROM paired_devices WHERE id = ${deviceId} RETURNING id","SELECT id FROM paired_devices WHERE id = ${deviceId}")], [S]),
 ("C7b disconnect ends the connection", [("packages/service/src/service.ts","Effect.tap(() => Effect.sync(() => remote.closeDevice(given.deviceId))),","")], [S]),
 ("C8a switching off ends connections", [("packages/service/src/remote/hostRuntime.ts", "state.closeAll();\n              connection.close();", ""), ("packages/service/src/remote/hostActions.ts", "state.closeAll();", "")], [S]),
 ("C8b switching off keeps pairings", [("packages/service/src/remote/hostAccess.ts", "    yield* sql`UPDATE host_identity SET is_enabled", "    if (!isEnabled) yield* sql`DELETE FROM paired_devices`;\n    yield* sql`UPDATE host_identity SET is_enabled")], [S]),
 ("C9a host can be renamed", [("packages/service/src/remote/hostAccess.ts","yield* sql`UPDATE host_identity SET host_name = ${trimmed === \"\" ? null : trimmed} WHERE id = 1`;","")], [S]),
 ("C9b default name is the first label", [("packages/service/src/remote/config.ts",'raw.split(".")[0]?.trim() || "This computer"','raw')], ["packages/service/test/remote/computerName.test.ts"]),
 ("C11 relay keeps the room for its first host", [("packages/relay/src/roomCore.ts","return sameBytes(stored, hash) ? null : claimMismatch;","return null;")], ["packages/relay/test"]),
 ("C12 a tampered record is refused", [("packages/channel/src/noise/cipherState.ts","plaintext = chacha20poly1305(this.k, encodeNonce(this.n), ad).decrypt(ciphertext);","plaintext = ciphertext.subarray(0, ciphertext.length - 16);")], ["packages/channel/test"]),
 ("C13a a refused host ends the retries", [("apps/app/src/foundation/hosts.ts","export const isFinalLinkClose = (code: number) => code === hostLinkCodes.refused;","export const isFinalLinkClose = (_code: number) => false;")], ["apps/app/test/foundation/hosts.test.ts"]),
 ("C13b retries back off from a host", [("apps/app/src/foundation/hosts.ts","isHost ? Math.min(shortestRetryMillis * 2 ** Math.max(0, failures - 1), longestHostRetryMillis) : shortestRetryMillis","shortestRetryMillis")], ["apps/app/test/foundation/hosts.test.ts"]),
 ("disabled secret refused", [("packages/service/src/remote/hostAccess.ts", '    const record = yield* readHostRecord;\n    if (record === null || !record.isEnabled) return { refusal: "disabled" } as const;\n    const [code]', '    const [code]')], [S]),
]
failed_run = False
for label, edits, tests in M:
    originals = {}
    try:
        for path, old, new in edits:
            if path not in originals:
                with open(WT + path) as f:
                    originals[path] = f.read()
            with open(WT + path) as f:
                source = f.read()
            if old not in source:
                raise ValueError(f"pattern not found in {path}: {old[:60]}")
            with open(WT + path, "w") as f:
                f.write(source.replace(old, new, 1))
        result = subprocess.run(["node_modules/.bin/vitest", "run", *tests], cwd=WT, capture_output=True, text=True, timeout=300)
        output = result.stdout + result.stderr
        tests_line = re.search(r"Tests\s+([^\n]*)", output)
        failures = sorted(set(re.findall(r"FAIL\s+\S+ > (.*)", output)))
        valid_red = (result.returncode != 0 and tests_line is not None
                     and re.search(r"\b[1-9]\d* failed\b", tests_line.group(1))
                     and failures and "Failed Suites" not in output and "Unhandled Errors" not in output)
        if valid_red:
            print(f"RED | {label} | {tests_line.group(1).strip()} | {failures[:2]}", flush=True)
        else:
            failed_run = True
            print(f"INVALID | {label} | exit {result.returncode} | {tests_line.group(1).strip() if tests_line else 'no test results'}", flush=True)
    except (OSError, ValueError, subprocess.TimeoutExpired) as error:
        failed_run = True
        print(f"SKIP | {label} | {error}", flush=True)
    finally:
        for path, original in originals.items():
            with open(WT + path, "w") as f:
                f.write(original)

sys.exit(1 if failed_run else 0)
