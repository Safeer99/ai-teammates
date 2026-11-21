import * as React from "react"
import { UsersIcon } from "lucide-react"
import { ChatAvatar } from "@/components/chat-avatar"
import { cn } from "@/lib/utils"

export interface GroupChatAvatarProps
  extends React.HTMLAttributes<HTMLDivElement> {
  bots?: Array<{ id?: string; avatar?: string | null; name?: string }>
  seeds?: string[]
  className?: string
}

export function GroupChatAvatar({
  bots,
  seeds: providedSeeds,
  className,
  ...props
}: GroupChatAvatarProps) {
  const seeds = React.useMemo(() => {
    if (providedSeeds) return providedSeeds
    if (bots) {
      return bots
        .map((b) => b.avatar || b.id || "")
        .filter((s): s is string => Boolean(s))
    }
    return []
  }, [providedSeeds, bots])

  const count = seeds.length

  // Case 0: empty
  if (count === 0) {
    return (
      <div
        className={cn(
          "relative flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
          className
        )}
        {...props}
      >
        <UsersIcon className="size-4" />
      </div>
    )
  }

  // Case 1: single avatar
  if (count === 1) {
    return (
      <div
        className={cn(
          "relative flex size-8 shrink-0 items-center justify-center",
          className
        )}
        {...props}
      >
        <ChatAvatar seed={seeds[0]} className="size-full rounded-full" />
      </div>
    )
  }

  // Case 2: two items sit side by side, overlapping
  if (count === 2) {
    return (
      <div
        className={cn(
          "relative size-8 shrink-0 overflow-hidden rounded-md",
          className
        )}
        {...props}
      >
        <div className="absolute top-1/2 left-0 size-[65%] -translate-y-1/2 rounded-full ring-1 ring-background">
          <ChatAvatar seed={seeds[0]} className="size-full rounded-full" />
        </div>
        <div className="absolute top-1/2 right-0 size-[65%] -translate-y-1/2 rounded-full ring-1 ring-background">
          <ChatAvatar seed={seeds[1]} className="size-full rounded-full" />
        </div>
      </div>
    )
  }

  // Case 3: three form a triangle
  if (count === 3) {
    return (
      <div
        className={cn(
          "relative size-8 shrink-0 overflow-hidden rounded-md",
          className
        )}
        {...props}
      >
        {/* Top center */}
        <div className="absolute top-0 left-1/2 size-[52%] -translate-x-1/2 rounded-full ring-1 ring-background">
          <ChatAvatar seed={seeds[0]} className="size-full rounded-full" />
        </div>
        {/* Bottom left */}
        <div className="absolute bottom-0 left-0 size-[52%] rounded-full ring-1 ring-background">
          <ChatAvatar seed={seeds[1]} className="size-full rounded-full" />
        </div>
        {/* Bottom right */}
        <div className="absolute right-0 bottom-0 size-[52%] rounded-full ring-1 ring-background">
          <ChatAvatar seed={seeds[2]} className="size-full rounded-full" />
        </div>
      </div>
    )
  }

  // Case 4+: four fill a 2x2 grid (up to 3 visible bot avatars, and the rest is shown with a number)
  const remainingCount = count - 3
  return (
    <div
      className={cn(
        "relative grid size-8 shrink-0 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-md p-0.5",
        className
      )}
      {...props}
    >
      <div className="relative size-full overflow-hidden rounded-full ring-0.5 ring-background">
        <ChatAvatar seed={seeds[0]} className="size-full rounded-full" />
      </div>
      <div className="relative size-full overflow-hidden rounded-full ring-0.5 ring-background">
        <ChatAvatar seed={seeds[1]} className="size-full rounded-full" />
      </div>
      <div className="relative size-full overflow-hidden rounded-full ring-0.5 ring-background">
        <ChatAvatar seed={seeds[2]} className="size-full rounded-full" />
      </div>
      <div className="relative flex size-full items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-0.5 ring-background">
        +{remainingCount}
      </div>
    </div>
  )
}

export default GroupChatAvatar
