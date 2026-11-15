import * as React from "react"
import { MonitorIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import type { ChatWithMembers } from "@/queries/chats"

export interface ChatHeaderProps {
  chat: ChatWithMembers
}

export function ChatHeader({ chat }: ChatHeaderProps) {
  const firstBot = chat.members[0]?.bot
  const displayName = chat.name || firstBot?.name || "Untitled Chat"
  const avatarSeed = firstBot?.avatar || firstBot?.id || chat.id

  return (
    <header className="flex h-12 w-full items-center justify-between border-b border-border/50 bg-background px-4">
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
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
        >
          <MonitorIcon className="size-4" />
          <span className="sr-only">Desktop</span>
        </Button>
      </div>
    </header>
  )
}

export default ChatHeader
