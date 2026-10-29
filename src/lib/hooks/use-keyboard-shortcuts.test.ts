import { describe, expect, it, vi } from "vitest";
import { handleKeyboardShortcut, isEditableElement } from "./use-keyboard-shortcuts";

function createMockElement(tagName: string, isContentEditable = false) {
  return {
    tagName,
    isContentEditable,
    getAttribute: (name: string) => (name === "contenteditable" && isContentEditable ? "true" : null),
  } as unknown as HTMLElement;
}

function createMockEvent(options: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  target?: unknown;
}) {
  let prevented = false;
  return {
    key: options.key,
    ctrlKey: Boolean(options.ctrlKey),
    metaKey: Boolean(options.metaKey),
    shiftKey: Boolean(options.shiftKey),
    altKey: Boolean(options.altKey),
    target: options.target ?? null,
    preventDefault: () => {
      prevented = true;
    },
    get defaultPrevented() {
      return prevented;
    },
  } as unknown as KeyboardEvent;
}

describe("keyboard shortcuts handler", () => {
  it("detects editable elements correctly", () => {
    const input = createMockElement("INPUT");
    const textarea = createMockElement("TEXTAREA");
    const select = createMockElement("SELECT");
    const div = createMockElement("DIV");
    const editableDiv = createMockElement("DIV", true);

    expect(isEditableElement(input)).toBe(true);
    expect(isEditableElement(textarea)).toBe(true);
    expect(isEditableElement(select)).toBe(true);
    expect(isEditableElement(editableDiv)).toBe(true);
    expect(isEditableElement(div)).toBe(false);
    expect(isEditableElement(null)).toBe(false);
  });

  it("handles Ctrl+B / Cmd+B to toggle sidebar", () => {
    const onToggleSidebar = vi.fn();
    const event = createMockEvent({ key: "b", ctrlKey: true });
    const handled = handleKeyboardShortcut(event, { onToggleSidebar });

    expect(handled).toBe(true);
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("handles 'd' or 'D' when not in editable element to toggle theme", () => {
    const onToggleTheme = vi.fn();
    const target = createMockElement("DIV");
    const event = createMockEvent({ key: "d", target });

    const handled = handleKeyboardShortcut(event, { onToggleTheme });
    expect(handled).toBe(true);
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it("does NOT toggle theme with 'd' when focused on an input or textarea", () => {
    const onToggleTheme = vi.fn();
    const textarea = createMockElement("TEXTAREA");
    const event = createMockEvent({ key: "d", target: textarea });

    const handled = handleKeyboardShortcut(event, { onToggleTheme });
    expect(handled).toBe(false);
    expect(onToggleTheme).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("handles Ctrl+Shift+D anywhere to toggle theme", () => {
    const onToggleTheme = vi.fn();
    const textarea = createMockElement("TEXTAREA");
    const event = createMockEvent({ key: "d", ctrlKey: true, shiftKey: true, target: textarea });

    const handled = handleKeyboardShortcut(event, { onToggleTheme });
    expect(handled).toBe(true);
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it("handles Ctrl+K to focus prompt", () => {
    const onFocusPrompt = vi.fn();
    const event = createMockEvent({ key: "k", ctrlKey: true });
    const handled = handleKeyboardShortcut(event, { onFocusPrompt });
    expect(handled).toBe(true);
    expect(onFocusPrompt).toHaveBeenCalledTimes(1);
  });

  it("handles '?' to open shortcuts dialog when not in input", () => {
    const onOpenShortcuts = vi.fn();
    const div = createMockElement("DIV");
    const event = createMockEvent({ key: "?", target: div });

    const handled = handleKeyboardShortcut(event, { onOpenShortcuts });
    expect(handled).toBe(true);
    expect(onOpenShortcuts).toHaveBeenCalledTimes(1);
  });

  it("handles Ctrl+N and 'c' for new conversation", () => {
    const onNewConversation = vi.fn();
    const eventCtrlN = createMockEvent({ key: "n", ctrlKey: true });
    handleKeyboardShortcut(eventCtrlN, { onNewConversation });

    const div = createMockElement("DIV");
    const eventC = createMockEvent({ key: "c", target: div });
    handleKeyboardShortcut(eventC, { onNewConversation });

    expect(onNewConversation).toHaveBeenCalledTimes(2);
  });

  it("handles Ctrl+Shift+S for switching sidebar views", () => {
    const onToggleSidebarView = vi.fn();
    const event = createMockEvent({ key: "s", ctrlKey: true, shiftKey: true });
    handleKeyboardShortcut(event, { onToggleSidebarView });
    expect(onToggleSidebarView).toHaveBeenCalledTimes(1);
  });
});
