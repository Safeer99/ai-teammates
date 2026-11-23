"use client"

import * as React from "react"
import type { UIMessage } from "ai"

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import { ChatAvatar } from "@/components/chat-avatar"
import { ToolCall, type GenericToolPart } from "@/components/tool-call"
import type { ChatBotItem } from "@/components/chat-view"

export interface ChatMessageProps {
  message: UIMessage
  messageIndex: number
  isGroup?: boolean
  bots?: ChatBotItem[]
}

export function ChatMessage({
  message,
  messageIndex,
  isGroup = false,
  bots = [],
}: ChatMessageProps) {
  const isAssistant = message.role === "assistant"

  const bot = React.useMemo(() => {
    if (!isGroup || !isAssistant) return undefined

    const metadata = message.metadata as { botId?: string } | undefined
    const directBotId = metadata?.botId

    if (directBotId) {
      const found = bots.find((b) => b.id === directBotId)
      if (found) return found
    }

    return bots[0]
  }, [isGroup, isAssistant, message.metadata, bots])

  const messageContent = (
    <MessageContent>
      {message.parts.map((part, partIndex) => {
        const key = `${message.id}-${messageIndex}-${partIndex}`

        if (part.type === "text") {
          return <MessageResponse key={key}>{part.text}</MessageResponse>
        }

        if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
          return (
            <ToolCall
              key={key}
              part={part as unknown as GenericToolPart}
            />
          )
        }

        return null
      })}
    </MessageContent>
  )

  if (isGroup && isAssistant) {
    return (
      <Message
        from={message.role}
        className="flex-row items-start gap-3"
      >
        {bot && (
          <ChatAvatar
            seed={bot.avatar || bot.id}
            alt={bot.name}
            className="mt-0.5 size-7 shrink-0"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {bot?.name && (
            <span className="text-xs font-medium text-muted-foreground select-none">
              {bot.name}
            </span>
          )}
          {messageContent}
        </div>
      </Message>
    )
  }

  return (
    <Message from={message.role}>
      {messageContent}
    </Message>
  )
}

export default ChatMessage
