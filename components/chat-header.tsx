"use client"

import * as React from "react"
import { MonitorIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import { useParentGroup } from "@/components/ui/resizable"
import type { ChatWithMembers } from "@/queries/chats"

export interface ChatHeaderProps {
  chat: ChatWithMembers
}

export function ChatHeader({ chat }: ChatHeaderProps) {
  const group = useParentGroup()
  const [isOpen, setIsOpen] = React.useState(false)
  const lastSizeRef = React.useRef(35)

  React.useEffect(() => {
    const el = document.getElementById("chat-desktop")
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        const open = width > 10
        setIsOpen(open)
        if (open) {
          const groupEl = el.parentElement
          if (groupEl && groupEl.offsetWidth > 0) {
            const pct = Math.round((width / groupEl.offsetWidth) * 100)
            if (pct >= 15) {
              lastSizeRef.current = pct
            }
          }
        }
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handleToggle = () => {
    if (!group) return
    const layout = group.getLayout()
    const currentSize = layout["chat-desktop"] ?? 0
    if (currentSize > 0) {
      lastSizeRef.current = currentSize
      group.setLayout({ "chat-main": 100, "chat-desktop": 0 })
    } else {
      const nextSize = lastSizeRef.current > 0 ? lastSizeRef.current : 35
      group.setLayout({
        "chat-main": 100 - nextSize,
        "chat-desktop": nextSize,
      })
    }
  }

  const firstBot = chat.members[0]?.bot
  const displayName = chat.name || firstBot?.name || "Untitled Chat"
  const avatarSeed = firstBot?.avatar || firstBot?.id || chat.id

  return (
    <header className="sticky top-0 z-10 flex h-12 w-full shrink-0 items-center justify-between border-b border-border/50 bg-background px-4">
      <div className="flex min-w-0 items-center">
        {firstBot ? (
          <BotDialog bot={firstBot}>
            <button
              type="button"
              className="-ml-1.5 flex min-w-0 cursor-pointer items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ChatAvatar seed={avatarSeed} className="size-6 shrink-0" />
              <span className="truncate text-sm leading-none font-medium text-foreground">
                {displayName}
              </span>
            </button>
          </BotDialog>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            <ChatAvatar seed={avatarSeed} className="size-6 shrink-0" />
            <span className="truncate text-sm leading-none font-medium text-foreground">
              {displayName}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center">
        <Button
          type="button"
          variant={isOpen ? "secondary" : "ghost"}
          size="icon"
          aria-pressed={isOpen}
          onClick={handleToggle}
          className="size-8 text-muted-foreground hover:text-foreground"
        >
          <MonitorIcon />
          <span className="sr-only">Toggle desktop panel</span>
        </Button>
      </div>
    </header>
  )
}

export default ChatHeader
