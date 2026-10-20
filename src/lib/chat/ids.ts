/**
 * Identifiers for chat messages.
 *
 * These live outside the component so that generating one is never part of a
 * render: the ids are created when a message is sent, never while the tree is
 * being drawn.
 */

export function createMessageId(): string {
  return `msg-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** The timestamp stamped on a message. */
export function now(): number {
  return Date.now();
}
