import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { Request, RequestTag, ResultOf } from "@iskios/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { fakeHarnessLayer, Service, serviceLayer } from "../../src/index.ts";

// The folder picker's service side (CHG-0253): search, browsing, and New folder, where a paired device reaches only
// the host's browsable roots and the host's own window reaches any folder.

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const paired = { isPairedDevice: true };
const owner = { isPairedDevice: false };

/** A home folder (the first root) with folders to find and to leave out, and a folder outside every root. */
const setUp = () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "iskios-picker-")));
  directories.push(base);
  const home = join(base, "home");
  const outside = join(base, "outside");
  for (const folder of [
    join(home, "app", "lib"),
    join(home, "app", "dist"),
    join(home, "apple"),
    join(home, "Projects", "iskios-app"),
    join(home, ".hidden", "secret"),
    join(home, "node_modules", "pkg"),
    join(home, "repo", "cache"),
    join(home, "repo", "src"),
    join(outside, "elsewhere"),
  ]) {
    mkdirSync(folder, { recursive: true });
  }
  writeFileSync(join(home, "repo", ".gitignore"), "cache/\n");
  execFileSync("git", ["init", "-q", join(home, "repo")]);
  symlinkSync(outside, join(home, "escape"));
  symlinkSync(join(home, "app"), join(home, "inside-link"));
  const layer = serviceLayer({
    filename: join(base, "iskios.sqlite"),
    harness: fakeHarnessLayer("10 millis"),
    homeFolder: home,
    scratchRoot: join(base, "data", "missions"),
  });
  return { base, home, layer, outside };
};

const as = (source: { isPairedDevice: boolean }) => ({
  call: <R extends Request>(request: R) =>
    Effect.gen(function* () {
      const service = yield* Service;
      return (yield* service.handle(request, source)) as ResultOf<R["_tag"] & RequestTag>;
    }),
  failureOf: <R extends Request>(request: R) =>
    Effect.gen(function* () {
      const service = yield* Service;
      return yield* Effect.flip(service.handle(request, source));
    }),
});

const pairedDevice = as(paired);
const hostWindow = as(owner);
const pathsOf = (folders: ReadonlyArray<{ path: string }>) => folders.map((folder) => folder.path);

let requestCount = 0;
const start = (workspacePath: string) =>
  hostWindow.call({
    _tag: "StartMission",
    effort: "default",
    model: "default",
    requestId: `picker-${++requestCount}`,
    text: "Work here",
    workspacePath,
  });

describe("searching folders", () => {
  it.live("ranks an exact name, then a prefix, then a part, then a loose match", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const found = yield* pairedDevice.call({ _tag: "SearchFolders", query: "app" });
      expect(pathsOf(found)).toEqual([join(home, "app"), join(home, "apple"), join(home, "Projects", "iskios-app")]);
      const loose = yield* pairedDevice.call({ _tag: "SearchFolders", query: "isap" });
      expect(pathsOf(loose)).toEqual([join(home, "Projects", "iskios-app")]);
    }).pipe(Effect.provide(layer));
  });

  it.live("leaves out hidden folders, node_modules, build output, ignored folders, and links out of the root", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      for (const query of ["secret", "pkg", "dist", "cache", "elsewhere"]) {
        expect(yield* pairedDevice.call({ _tag: "SearchFolders", query }), query).toEqual([]);
      }
      // A folder behind a link that stays inside the root is found, once, under its own name.
      const folders = pathsOf(yield* pairedDevice.call({ _tag: "SearchFolders", query: "lib" }));
      expect(folders).toContain(join(home, "app", "lib"));
      // Not-ignored folders of a Git repository are still offered.
      expect(pathsOf(yield* pairedDevice.call({ _tag: "SearchFolders", query: "src" }))).toEqual([
        join(home, "repo", "src"),
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("resolves a typed path exactly, even a hidden folder, when it lies under a root", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const hidden = join(home, ".hidden");
      expect(pathsOf(yield* pairedDevice.call({ _tag: "SearchFolders", query: hidden }))).toEqual([hidden]);
      const completed = yield* pairedDevice.call({ _tag: "SearchFolders", query: `${home}/ap` });
      expect(pathsOf(completed)).toEqual([join(home, "app"), join(home, "apple")]);
    }).pipe(Effect.provide(layer));
  });

  it.live("gives a paired device nothing outside the roots, and the host's own window any typed folder", () => {
    const { layer, outside } = setUp();
    return Effect.gen(function* () {
      expect(yield* pairedDevice.call({ _tag: "SearchFolders", query: outside })).toEqual([]);
      expect(yield* pairedDevice.call({ _tag: "SearchFolders", query: join(outside, "elsewhere") })).toEqual([]);
      expect(pathsOf(yield* hostWindow.call({ _tag: "SearchFolders", query: outside }))).toEqual([outside]);
    }).pipe(Effect.provide(layer));
  });

  it.live("follows a root the host adds and stops at one the host removes", () => {
    const { layer, outside } = setUp();
    return Effect.gen(function* () {
      yield* hostWindow.call({ _tag: "AddBrowsableRoot", path: outside });
      expect(pathsOf(yield* pairedDevice.call({ _tag: "SearchFolders", query: "elsewhere" }))).toEqual([
        join(outside, "elsewhere"),
      ]);
      yield* hostWindow.call({ _tag: "RemoveBrowsableRoot", path: outside });
      expect(yield* pairedDevice.call({ _tag: "SearchFolders", query: "elsewhere" })).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live("suggests the folders quests used, newest first, and a paired device only those under a root", () => {
    const { home, layer, outside } = setUp();
    return Effect.gen(function* () {
      yield* start(join(home, "app"));
      yield* start(outside);
      yield* start(join(home, "apple"));
      expect(pathsOf(yield* hostWindow.call({ _tag: "SearchFolders", query: "" }))).toEqual([
        join(home, "apple"),
        outside,
        join(home, "app"),
      ]);
      expect(pathsOf(yield* pairedDevice.call({ _tag: "SearchFolders", query: "" }))).toEqual([
        join(home, "apple"),
        join(home, "app"),
      ]);
    }).pipe(Effect.provide(layer));
  });
});

describe("browsing and making folders as a paired device or on the host", () => {
  it.live(
    "refuses a paired device a folder outside the roots, also through a link, and allows the host's window",
    () => {
      const { home, layer, outside } = setUp();
      return Effect.gen(function* () {
        const browse = (path: string) => ({ _tag: "BrowseFolders", path, shouldIncludeHidden: false }) as const;
        expect((yield* pairedDevice.failureOf(browse(outside))).message).toContain("outside the browsable roots");
        expect((yield* pairedDevice.failureOf(browse(join(home, "escape")))).kind).toBe("InvalidInput");
        const listing = yield* hostWindow.call(browse(outside));
        expect(pathsOf(listing.folders)).toEqual([join(outside, "elsewhere")]);
        // Above the roots the host's window can still climb; a root itself has no parent in the picker.
        expect(listing.parent).toBe(join(outside, ".."));
      }).pipe(Effect.provide(layer));
    },
  );

  it.live("makes a folder under a root for a paired device, and outside only for the host's window", () => {
    const { home, layer, outside } = setUp();
    return Effect.gen(function* () {
      const made = yield* pairedDevice.call({ _tag: "CreateFolder", name: "notes", parent: home });
      expect(made.path).toBe(join(home, "notes"));
      const refused = yield* pairedDevice.failureOf({ _tag: "CreateFolder", name: "notes", parent: outside });
      expect(refused.kind).toBe("InvalidInput");
      const local = yield* hostWindow.call({ _tag: "CreateFolder", name: "notes", parent: outside });
      expect(local.path).toBe(join(outside, "notes"));
    }).pipe(Effect.provide(layer));
  });
});

describe("the browsable roots", () => {
  it.live("are removed one at a time, and a root that is not listed is refused", () => {
    const { home, layer, outside } = setUp();
    return Effect.gen(function* () {
      yield* hostWindow.call({ _tag: "AddBrowsableRoot", path: outside });
      const left = yield* hostWindow.call({ _tag: "RemoveBrowsableRoot", path: home });
      expect(pathsOf(left.folders)).toEqual([outside]);
      const refused = yield* hostWindow.failureOf({ _tag: "RemoveBrowsableRoot", path: home });
      expect(refused.kind).toBe("InvalidInput");
    }).pipe(Effect.provide(layer));
  });
});

describe("naming a folder from a paired device", () => {
  const startFrom = (source: ReturnType<typeof as>, workspacePath: string) =>
    source.failureOf({
      _tag: "StartMission",
      effort: "default",
      model: "default",
      requestId: `named-${++requestCount}`,
      text: "Work here",
      workspacePath,
    });

  it.live("refuses a folder outside the roots that is no realm, for every request that names a folder", () => {
    const { outside, layer } = setUp();
    return Effect.gen(function* () {
      const refused = yield* startFrom(pairedDevice, outside);
      expect(refused.message).toContain("outside the browsable roots");
      expect((yield* pairedDevice.failureOf({ _tag: "ListSkills", workspacePath: outside })).message).toContain(
        "outside the browsable roots",
      );
      expect(
        (yield* pairedDevice.failureOf({
          _tag: "ListWorkspaceEntries",
          query: "",
          workspacePath: outside,
        })).message,
      ).toContain("outside the browsable roots");
      expect(
        (yield* pairedDevice.failureOf({
          _tag: "CreateRealm",
          crest: null,
          name: "Elsewhere",
          path: outside,
        })).message,
      ).toContain("outside the browsable roots");
    }).pipe(Effect.provide(layer));
  });

  it.live("lets a paired device use a folder under a root, and one the host already attached as a realm", () => {
    const { home, outside, layer } = setUp();
    return Effect.gen(function* () {
      yield* start(outside);
      yield* pairedDevice.call({ _tag: "ListSkills", workspacePath: outside });
      yield* pairedDevice.call({ _tag: "ListSkills", workspacePath: join(home, "app") });
    }).pipe(Effect.provide(layer));
  });

  it.live("lets the host's own window name any folder", () => {
    const { outside, layer } = setUp();
    return Effect.gen(function* () {
      yield* hostWindow.call({ _tag: "ListSkills", workspacePath: outside });
    }).pipe(Effect.provide(layer));
  });
});
