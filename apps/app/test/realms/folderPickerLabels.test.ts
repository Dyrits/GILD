import { describe, expect, it } from "vitest";
import { parentLabelOf } from "../../src/realms/folderPickerLabels";

describe("the line under a folder in the picker", () => {
  it("names the folder above", () => {
    expect(parentLabelOf("/Users/me/Code/iskios")).toBe("/Users/me/Code");
    expect(parentLabelOf("/Users/me/Code/iskios/")).toBe("/Users/me/Code");
    expect(parentLabelOf("C:\\Users\\me\\Code")).toBe("C:\\Users\\me");
  });

  it("gives the top of the file system for a folder directly under it, and nothing for the top itself", () => {
    expect(parentLabelOf("/Volumes")).toBe("/");
    expect(parentLabelOf("/")).toBe("");
  });
});
