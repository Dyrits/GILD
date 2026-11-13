import { describe, expect, it } from "vitest";
import {
  checksumsOf,
  chooseRelease,
  listingsOf,
  plainNotesOf,
  type ReleaseListing,
  sumsFileName,
} from "../../src/updates/releases.ts";

const listing = (tag: string, options: Partial<ReleaseListing> & { arch?: string; hasSums?: boolean } = {}) => {
  const { arch = "arm64", hasSums = true, ...rest } = options;
  return {
    assets: [
      { name: `Iskios-${tag}-mac-${arch}.dmg`, size: 100, url: `https://example.test/${tag}.dmg` },
      ...(hasSums ? [{ name: sumsFileName, size: 10, url: `https://example.test/${tag}-sums` }] : []),
    ],
    isDraft: false,
    isPrerelease: true,
    notes: `Notes of ${tag}`,
    pageUrl: `https://example.test/releases/${tag}`,
    tag,
    ...rest,
  } satisfies ReleaseListing;
};

const running = { arch: "arm64", version: "0.1.1-Prototype" };

describe("choosing a release", () => {
  it("offers the newest newer release with this computer's installer and the checksums", () => {
    const choice = chooseRelease(
      [listing("0.1.2-Prototype"), listing("0.1.3-Prototype"), listing("0.1.0-Prototype")],
      running,
    );
    expect(choice).toMatchObject({ _tag: "Found", release: { version: "0.1.3-Prototype" } });
    if (choice._tag === "Found") expect(choice.release.installer.url).toBe("https://example.test/0.1.3-Prototype.dmg");
  });

  it("offers nothing when the running version is the newest", () => {
    expect(chooseRelease([listing("0.1.1-Prototype"), listing("0.1.0-Prototype")], running)).toEqual({
      _tag: "None",
      reason: null,
    });
  });

  it("never offers a draft", () => {
    expect(chooseRelease([listing("0.1.2-Prototype", { isDraft: true })], running)._tag).toBe("None");
  });

  it("lets a stable build follow stable releases only", () => {
    const stable = { arch: "arm64", version: "1.0.0" };
    const choice = chooseRelease(
      [listing("1.1.0-beta", { isPrerelease: true }), listing("1.0.1", { isPrerelease: false })],
      stable,
    );
    expect(choice).toMatchObject({ _tag: "Found", release: { version: "1.0.1" } });
    expect(chooseRelease([listing("1.1.0-beta")], stable)._tag).toBe("None");
  });

  it("lets a prerelease build take a stable release that is newer", () => {
    const choice = chooseRelease([listing("0.2.0", { isPrerelease: false })], running);
    expect(choice).toMatchObject({ _tag: "Found", release: { version: "0.2.0" } });
  });

  it("skips a newer release that lacks the installer for this architecture, taking the next one", () => {
    const choice = chooseRelease([listing("0.1.3-Prototype", { arch: "x64" }), listing("0.1.2-Prototype")], running);
    expect(choice).toMatchObject({ _tag: "Found", release: { version: "0.1.2-Prototype" } });
  });

  it("says why a newer release cannot be used when none can", () => {
    expect(chooseRelease([listing("0.1.2-Prototype", { hasSums: false })], running)).toEqual({
      _tag: "None",
      reason: `Release 0.1.2-Prototype has no ${sumsFileName}.`,
    });
  });

  it("reads a tag with a leading v", () => {
    const choice = chooseRelease([listing("v0.1.2-Prototype", { assets: [] })], running);
    expect(choice._tag).toBe("None");
  });
});

describe("reading GitHub's release list", () => {
  it("keeps well-formed releases and drops the rest", () => {
    const releases = listingsOf([
      {
        assets: [{ browser_download_url: "https://x.test/a.dmg", name: "a.dmg", size: 5 }, { name: "broken" }],
        body: "Hello",
        draft: false,
        html_url: "https://x.test/r",
        prerelease: true,
        tag_name: "0.1.2-Prototype",
      },
      { tag_name: 3 },
      "nonsense",
    ]);
    expect(releases).toEqual([
      {
        assets: [{ name: "a.dmg", size: 5, url: "https://x.test/a.dmg" }],
        isDraft: false,
        isPrerelease: true,
        notes: "Hello",
        pageUrl: "https://x.test/r",
        tag: "0.1.2-Prototype",
      },
    ]);
    expect(listingsOf({ message: "rate limited" })).toEqual([]);
  });
});

describe("reading checksums", () => {
  it("maps each file name to its SHA-512, with either separator style", () => {
    const hash = "a".repeat(128);
    const other = "B".repeat(128);
    const sums = checksumsOf(`${hash}  Iskios-1-mac-arm64.dmg\n${other} *Iskios-1-mac-x64.dmg\nnot a line\n`);
    expect(sums.get("Iskios-1-mac-arm64.dmg")).toBe(hash);
    expect(sums.get("Iskios-1-mac-x64.dmg")).toBe("b".repeat(128));
    expect(sums.size).toBe(2);
  });
});

describe("showing release notes", () => {
  it("turns the feed's HTML into plain lines", () => {
    expect(plainNotesOf("<h2>Breaking</h2><ul><li>Data &amp; settings</li><li>Reset</li></ul>")).toBe(
      "Breaking\nData & settings\nReset",
    );
  });

  it("leaves Markdown notes as written", () => {
    expect(plainNotesOf("## Breaking\n- Reset")).toBe("## Breaking\n- Reset");
  });
});
