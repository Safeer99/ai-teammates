"use client"

import * as React from "react"

const emptySubscribe = () => () => {}

/**
 * Returns `false` during SSR and initial hydration, then `true` on the client.
 * Avoids `useEffect` + `setState` cascading renders and `react-hooks/set-state-in-effect`.
 */
export function useIsHydrated(): boolean {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}
