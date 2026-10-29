import { describe, expect, it } from "vitest";
import {
  buildFilesystemIndex,
  getActiveToken,
  getTerminalCompletions,
} from "./terminal-autocomplete";

describe("terminal-autocomplete", () => {
  const mockFiles = [
    "/workspace/math.pdf/Chapter 1/001.md",
    "/workspace/math.pdf/Chapter 1/002.md",
    "/workspace/physics.pdf/Intro/001.md",
  ];

  it("builds index of directories and files correctly", () => {
    const { absolutePaths, relativePaths, directories } = buildFilesystemIndex(mockFiles);
    
    expect(absolutePaths.has("/workspace/math.pdf/Chapter 1/001.md")).toBe(true);
    expect(relativePaths.has("math.pdf/Chapter 1/001.md")).toBe(true);
    expect(directories.has("/workspace/math.pdf")).toBe(true);
    expect(directories.has("math.pdf")).toBe(true);
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

  it("completes file and directory paths", () => {
    const result = getTerminalCompletions("cat math", 8, mockFiles, []);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.some((s) => s.value.includes("math.pdf"))).toBe(true);
  });

  it("provides ghost text from command history if available", () => {
    const history = ["grep -rni probability /workspace", "ls -la"];
    const result = getTerminalCompletions("grep -r", 7, mockFiles, history);
    expect(result.ghostText).toBe("ni probability /workspace");
  });
});

