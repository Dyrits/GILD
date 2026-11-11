import { describe, expect, it } from "vitest";
import { mergedPathOf, pathFromShellOutput } from "../src/shellPath.ts";

const home = "/Users/owner";

describe("pathFromShellOutput", () => {
  it("reads the path between the marks and ignores what the start-up files print around it", () => {
    const output = "Welcome back\n__ISKIOS_PATH_START__/usr/bin:/Users/owner/.local/bin\n__ISKIOS_PATH_END__\nbye\n";
    expect(pathFromShellOutput(output)).toBe("/usr/bin:/Users/owner/.local/bin");
  });

  it("finds no path when the shell printed none", () => {
    expect(pathFromShellOutput("")).toBeNull();
    expect(pathFromShellOutput("__ISKIOS_PATH_START__\n__ISKIOS_PATH_END__")).toBeNull();
  });
});

describe("mergedPathOf", () => {
  it("puts the login shell's folders first, then the launcher's, without repeats", () => {
    expect(mergedPathOf({ home, launchPath: "/usr/bin:/bin", loginPath: "/opt/homebrew/bin:/usr/bin" })).toMatch(
      /^\/opt\/homebrew\/bin:\/usr\/bin:\/bin(:|$)/,
    );
  });

  it("adds the folders the harness tools install into when the login shell gave none", () => {
    const path = mergedPathOf({ home, launchPath: "/usr/bin:/bin:/usr/sbin:/sbin", loginPath: null }).split(":");
    expect(path.slice(0, 4)).toEqual(["/usr/bin", "/bin", "/usr/sbin", "/sbin"]);
    expect(path).toContain(`${home}/.local/bin`);
    expect(path).toContain(`${home}/.opencode/bin`);
    expect(path).toContain("/opt/homebrew/bin");
  });

  it("starts from the home folders when the launcher gave no path at all", () => {
    expect(mergedPathOf({ home, launchPath: undefined, loginPath: null })).toContain(`${home}/.local/bin`);
  });

  it("drops empty entries", () => {
    expect(mergedPathOf({ home, launchPath: "/usr/bin::", loginPath: ":/bin" }).split(":")).not.toContain("");
  });
});
