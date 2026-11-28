"use client"

import * as React from "react"
import { ClockIcon } from "lucide-react"

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "Resetting now"

  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  return `${minutes}m ${seconds}s`
}

export function UsageResetCountdown({
  periodEndIso,
}: {
  periodEndIso: string
}) {
  const [remaining, setRemaining] = React.useState<string>(() =>
    formatTimeRemaining(new Date(periodEndIso).getTime() - Date.now())
  )

  React.useEffect(() => {
    const target = new Date(periodEndIso).getTime()
    const update = () => {
      setRemaining(formatTimeRemaining(target - Date.now()))
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [periodEndIso])

  return (
    <span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
      <ClockIcon className="size-3.5 text-muted-foreground" />
      <span>Resets in {remaining}</span>
    </span>
  )
}
