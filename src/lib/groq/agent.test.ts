import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Chunk, TraceStep } from "@/lib/library/types";
import { searchChunks } from "@/lib/retrieval/search";
import { createWorkspaceShell, type WorkspaceShell } from "@/lib/shell/workspace-shell";
import { runAgent } from "./agent";
import { streamWithTools } from "./client";

vi.mock("@/lib/retrieval/search", () => ({
  searchChunks: vi.fn(),
  renderContext: () => ({ text: "Revenue increased by fifteen percent.", citations: [{ chunkId: "chunk-1", label: "Notes" }] }),
}));
vi.mock("@/lib/shell/workspace-shell", () => ({
  SHELL_INSTRUCTIONS: "Read the workspace.",
  createWorkspaceShell: vi.fn(),
}));
vi.mock("./client", () => ({
  complete: vi.fn(),
  stream: vi.fn(),
  streamWithTools: vi.fn(),
}));

const chunk: Chunk = {
  id: "chunk-1",
  documentId: "document-1",
  folderId: "",
  section: "Notes",
  index: 0,
  text: "Revenue increased by fifteen percent.",
  embedding: null,
  tokens: ["revenue"],
  createdAt: 1,
};
const request = { question: "What changed in revenue?", folderName: "selected files", chunks: [chunk], apiKey: "test-key", model: "test-model" };
const run = vi.fn<WorkspaceShell["run"]>();
let traces: TraceStep[];
const callbacks = { onTrace: (step: TraceStep) => traces.push(structuredClone(step)), onText: vi.fn(), onCitations: vi.fn() };

function replyWithCommands(...commands: string[]) {
  vi.mocked(streamWithTools).mockResolvedValueOnce({
    content: "",
    toolCalls: commands.map((command, index) => ({ id: `call-${index}`, name: "shell", arguments: JSON.stringify({ command }) })),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  traces = [];
  vi.mocked(searchChunks).mockResolvedValue({ results: [{ chunk, score: 1, reason: "lexical" }], semantic: false, queryTokens: ["revenue"] });
  vi.mocked(createWorkspaceShell).mockResolvedValue({ run, files: ["/workspace/Notes/001.md"], chunkByPath: new Map([["/workspace/Notes/001.md", chunk.id]]) });
  run.mockResolvedValue({ stdout: "/workspace/Notes/001.md: Revenue increased by fifteen percent.", stderr: "", exitCode: 0, truncated: false });
  vi.mocked(streamWithTools).mockImplementation(async (_messages, _options, onText) => {
    onText("Revenue increased by fifteen percent. [1]");
    return { content: "Revenue increased by fifteen percent. [1]", toolCalls: [] };
  });
});

describe("agent command history", () => {
  it("emits the exact command before execution and updates the same step afterward", async () => {
    const command = 'grep -rn "revenue" /workspace | head -5';
    replyWithCommands(command);
    run.mockImplementationOnce(async () => {
      expect(traces.at(-1)).toMatchObject({ kind: "command", title: command, state: "running" });
      return { stdout: "/workspace/Notes/001.md: revenue", stderr: "", exitCode: 0, truncated: false };
    });

    await runAgent(request, callbacks);

    const commands = traces.filter((step) => step.kind === "command");
    expect(commands).toHaveLength(2);
    expect(commands[0].id).toBe(commands[1].id);
    expect(commands[1]).toMatchObject({ title: command, state: "done", exitCode: 0, detail: "/workspace/Notes/001.md: revenue", chunkIds: [chunk.id] });
    expect(commands[1].durationMs).toBeGreaterThanOrEqual(0);
    expect(run).toHaveBeenCalledWith(command);
    expect(callbacks.onCitations).toHaveBeenCalledWith([chunk.id]);
  });

  it("keeps repeated commands as distinct chronological executions", async () => {
    const command = "cat /workspace/Notes/001.md";
    replyWithCommands(command, command);

    await runAgent(request, callbacks);

    const commands = traces.filter((step) => step.kind === "command");
    expect(commands.map((step) => step.state)).toEqual(["running", "done", "running", "done"]);
    expect(new Set(commands.map((step) => step.id)).size).toBe(2);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("records nonzero exit codes and stderr without stopping the answer", async () => {
    replyWithCommands("cat /workspace/missing.md");
    run.mockResolvedValueOnce({ stdout: "", stderr: "cat: /workspace/missing.md: No such file or directory", exitCode: 1, truncated: false });

    await runAgent(request, callbacks);

    expect(traces.filter((step) => step.kind === "command").at(-1)).toMatchObject({ state: "failed", exitCode: 1, detail: "cat: /workspace/missing.md: No such file or directory" });
    expect(callbacks.onText).toHaveBeenCalledWith("Revenue increased by fifteen percent. [1]");
  });

  it("records commands that throw without inventing an exit code", async () => {
    replyWithCommands("cat /workspace/Notes/001.md");
    const error = new Error("Execution interrupted");
    run.mockRejectedValueOnce(error);

    await expect(runAgent(request, callbacks)).rejects.toBe(error);

    const commands = traces.filter((step) => step.kind === "command");
    expect(commands[1]).toMatchObject({ id: commands[0].id, state: "failed", detail: "Execution interrupted" });
    expect(commands[1].exitCode).toBeUndefined();
    expect(commands[1].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("keeps output previews bounded without truncating commands", async () => {
    const command = `grep -rn "${"term".repeat(100)}" /workspace`;
    replyWithCommands(command);
    run.mockResolvedValueOnce({ stdout: "result ".repeat(100), stderr: "", exitCode: 0, truncated: false });

    await runAgent(request, callbacks);

    const commandStep = traces.filter((step) => step.kind === "command").at(-1)!;
    expect(commandStep.title).toBe(command);
    expect(commandStep.detail).toHaveLength(160);
    expect(commandStep.detail).toMatch(/…$/);
  });

  it("does not invent a command history for an answer using only retrieval", async () => {
    await runAgent(request, callbacks);

    expect(traces.some((step) => step.kind === "command")).toBe(false);
    expect(run).not.toHaveBeenCalled();
    expect(callbacks.onText).toHaveBeenCalled();
  });
});
