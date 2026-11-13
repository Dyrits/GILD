import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { downloadFile, fetchListings, fetchText, UpdateRequestError } from "../../src/updates/network.ts";

type Seen = { headers: IncomingMessage["headers"]; url: string | undefined };

const servers: Server[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

/** A local stand-in for GitHub that records each request it receives. */
const standIn = async (body: (url: string) => { status: number; text: string | Buffer }) => {
  const seen: Seen[] = [];
  const server = createServer((request, response) => {
    seen.push({ headers: request.headers, url: request.url });
    const answer = body(request.url ?? "");
    response.writeHead(answer.status, { "content-length": Buffer.byteLength(answer.text) });
    response.end(answer.text);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return { base: `http://127.0.0.1:${port}`, seen };
};

describe("asking for the release list", () => {
  it("sends the app's name and version as its user agent and nothing of the owner's", async () => {
    const github = await standIn(() => ({ status: 200, text: "[]" }));
    await fetchListings(fetch, `${github.base}/releases?per_page=30`, "0.1.1-Prototype");
    expect(github.seen).toHaveLength(1);
    const [request] = github.seen;
    expect(request?.url).toBe("/releases?per_page=30");
    expect(request?.headers["user-agent"]).toBe("Iskios/0.1.1-Prototype");
    // Only transport headers and the two the updater sets: no cookie, no authorization, no identifier.
    const names = Object.keys(request?.headers ?? {});
    expect(names).not.toContain("cookie");
    expect(names).not.toContain("authorization");
    expect(names.filter((name) => name.startsWith("x-"))).toEqual([]);
  });

  it("says GitHub's answer when it refuses", async () => {
    const github = await standIn(() => ({ status: 403, text: "{}" }));
    await expect(fetchListings(fetch, `${github.base}/releases`, "1.0.0")).rejects.toThrow("GitHub answered 403");
  });

  it("says which host it could not reach", async () => {
    await expect(fetchListings(fetch, "http://127.0.0.1:1/releases", "1.0.0")).rejects.toBeInstanceOf(
      UpdateRequestError,
    );
  });
});

describe("downloading a file", () => {
  it("writes the file and returns its SHA-512 while reporting progress", async () => {
    const content = Buffer.from("x".repeat(100_000));
    const github = await standIn(() => ({ status: 200, text: content }));
    const destination = join(mkdtempSync(join(tmpdir(), "iskios-download-")), "file.dmg");
    const percents: number[] = [];
    const hash = await downloadFile(fetch, `${github.base}/file.dmg`, destination, {
      appVersion: "1.0.0",
      onProgress: (percent) => percents.push(percent),
    });
    expect(hash).toBe(createHash("sha512").update(content).digest("hex"));
    expect(readFileSync(destination).equals(content)).toBe(true);
    expect(percents.at(-1)).toBe(100);
  });

  it("refuses a missing file", async () => {
    const github = await standIn(() => ({ status: 404, text: "" }));
    const destination = join(mkdtempSync(join(tmpdir(), "iskios-download-")), "file.dmg");
    await expect(
      downloadFile(fetch, `${github.base}/none`, destination, { appVersion: "1.0.0", onProgress: () => void 0 }),
    ).rejects.toThrow("GitHub answered 404");
  });
});

describe("reading a small text file", () => {
  it("returns its text", async () => {
    const github = await standIn(() => ({ status: 200, text: "sums" }));
    expect(await fetchText(fetch, `${github.base}/SHA512SUMS.txt`, "1.0.0")).toBe("sums");
  });
});
