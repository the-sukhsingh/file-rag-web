import * as React from "react";

export function isEditableElement(target: EventTarget | null): boolean {
  if (!target) return false;
  const anyTarget = target as {
    tagName?: string;
    isContentEditable?: boolean;
    getAttribute?: (name: string) => string | null;
  };
  const tagName = anyTarget.tagName?.toUpperCase();
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }
  return (
    Boolean(anyTarget.isContentEditable) ||
    anyTarget.getAttribute?.("contenteditable") === "true"
  );
}

export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

export interface ShortcutHandlers {
  onToggleSidebar?: () => void;
  onToggleTheme?: () => void;
  onFocusPrompt?: () => void;
  onNewConversation?: () => void;
  onToggleSidebarView?: () => void;
  onOpenSettings?: () => void;
  onOpenShortcuts?: () => void;
  onCloseModals?: () => void;
}

export function handleKeyboardShortcut(
  event: KeyboardEvent,
  handlers: ShortcutHandlers
): boolean {
  const isModifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  const editable = isEditableElement(event.target);

  // Ctrl+B / Cmd+B: Toggle sidebar
  if (isModifier && !event.shiftKey && key === "b") {
    event.preventDefault();
    handlers.onToggleSidebar?.();
    return true;
  }

  // Ctrl+Shift+D / Cmd+Shift+D: Toggle theme (works anywhere)
  if (isModifier && event.shiftKey && key === "d") {
    event.preventDefault();
    handlers.onToggleTheme?.();
    return true;
  }

  // Single-key 'd' or 'D': Toggle theme (only when not typing in editable element)
  if (!isModifier && !event.altKey && key === "d" && !editable) {
    event.preventDefault();
    handlers.onToggleTheme?.();
    return true;
  }

  // Ctrl+K / Cmd+K: Focus prompt box
  if (isModifier && !event.shiftKey && key === "k") {
    event.preventDefault();
    handlers.onFocusPrompt?.();
    return true;
  }

  // '/' to focus prompt (only when not typing in an editable field)
  if (!isModifier && !event.altKey && !event.shiftKey && event.key === "/" && !editable) {
    event.preventDefault();
    handlers.onFocusPrompt?.();
    return true;
  }

  // Ctrl+N / Cmd+N or single-key 'c'/'C': New conversation
  if (isModifier && !event.shiftKey && key === "n") {
    event.preventDefault();
    handlers.onNewConversation?.();
    return true;
  }
  if (!isModifier && !event.altKey && key === "c" && !editable) {
    event.preventDefault();
    handlers.onNewConversation?.();
    return true;
  }

  // Ctrl+Shift+S or Ctrl+Shift+O: Toggle sidebar view (files / chats)
  if (isModifier && event.shiftKey && (key === "s" || key === "o")) {
    event.preventDefault();
    handlers.onToggleSidebarView?.();
    return true;
  }

  // Ctrl+, / Cmd+,: Open settings
  if (isModifier && event.key === ",") {
    event.preventDefault();
    handlers.onOpenSettings?.();
    return true;
  }

  // '?' / Shift+/: Open keyboard shortcuts cheat sheet
  if (!isModifier && !event.altKey && event.key === "?" && !editable) {
    event.preventDefault();
    handlers.onOpenShortcuts?.();
    return true;
  }

  // Escape: Close modals
  if (event.key === "Escape") {
    handlers.onCloseModals?.();
  }

  return false;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      handleKeyboardShortcut(event, handlersRef.current);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
