import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Whether the viewport is narrower than the mobile breakpoint.
 *
 * The value is read through `useSyncExternalStore` so the first paint already
 * knows the width, instead of rendering as if it were a desktop and then
 * correcting itself once the listener fires.
 */
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
