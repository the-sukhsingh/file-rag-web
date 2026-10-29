import { describe, expect, it } from "vitest";
import {
  getFilesystemChildren,
  getActiveToken,
  getTerminalCompletions,
} from "./terminal-autocomplete";

describe("terminal-autocomplete", () => {
  const mockFiles = [
    "/workspace/math.pdf/Chapter 1/001.md",
    "/workspace/math.pdf/Chapter 1/002.md",
    "/workspace/math.pdf/Chapter 2/001.md",
    "/workspace/physics.pdf/Intro/001.md",
  ];

  it("lists immediate children of root /workspace", () => {
    const children = getFilesystemChildren(mockFiles, "");
    const names = children.map((c) => c.name);
    
    // Only immediate top-level folders, not nested files
    expect(names).toContain("math.pdf/");
    expect(names).toContain("physics.pdf/");
    expect(names).not.toContain("001.md");
    expect(children.every((c) => c.isDir)).toBe(true);
  });

  it("lists immediate children of a subdirectory", () => {
    const children = getFilesystemChildren(mockFiles, "math.pdf/");
    const names = children.map((c) => c.name);

    expect(names).toContain("Chapter 1/");
    expect(names).toContain("Chapter 2/");
    expect(names).not.toContain("001.md");
  });

  it("lists files inside a leaf directory with natural order", () => {
    const children = getFilesystemChildren(mockFiles, "math.pdf/Chapter 1/");
    const names = children.map((c) => c.name);

    expect(names).toEqual(["001.md", "002.md"]);
    expect(children.every((c) => !c.isDir)).toBe(true);
  });

  it("identifies active token and command name", () => {
    const tokenInfo1 = getActiveToken("grep -rni", 9);
    expect(tokenInfo1.token).toBe("-rni");
    expect(tokenInfo1.commandName).toBe("grep");
    expect(tokenInfo1.isFirstWord).toBe(false);

    const tokenInfo2 = getActiveToken("cat", 3);
    expect(tokenInfo2.token).toBe("cat");
    expect(tokenInfo2.isFirstWord).toBe(true);
  });

  it("completes commands when typing the first word", () => {
    const result = getTerminalCompletions("gr", 2, mockFiles, []);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].value).toBe("grep");
    expect(result.suggestions[0].type).toBe("command");
    expect(result.ghostText).toBe("ep");
  });

  it("completes command flags when typing flags", () => {
    const result = getTerminalCompletions("grep -r", 7, mockFiles, []);
    const flagValues = result.suggestions.map((s) => s.value);
    expect(flagValues).toContain("-r");
    expect(flagValues).toContain("-rni");
  });

  it("completes immediate directory segments cleanly", () => {
    const result = getTerminalCompletions("cat math", 8, mockFiles, []);
    expect(result.suggestions.length).toBe(1);
    expect(result.suggestions[0].display).toBe("math.pdf/");
    expect(result.suggestions[0].value).toBe("math.pdf/");
    expect(result.ghostText).toBe(".pdf/");
  });

  it("provides ghost text from command history if available", () => {
    const history = ["grep -rni probability /workspace", "ls -la"];
    const result = getTerminalCompletions("grep -r", 7, mockFiles, history);
    expect(result.ghostText).toBe("ni probability /workspace");
  });
});
