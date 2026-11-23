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

  const metadata = message.metadata as
    | { botId?: string; isHandoffTrigger?: boolean }
    | undefined

  // Hide synthetic internal handoff triggers from rendering in the chat UI
  const isHandoffTrigger =
    metadata?.isHandoffTrigger ||
    (message.role === "user" &&
      message.parts.some(
        (p) => p.type === "text" && p.text?.startsWith("[Handoff from ")
      ))

  if (isHandoffTrigger) {
    return null
  }

  // If a handoff occurred in this message, only render the toolcall part and remove all unnecessary text
  const hasHandoff = message.parts.some(
    (p) =>
      p.type === "tool-handoff" ||
      (p.type === "dynamic-tool" &&
        (p as { toolName?: string }).toolName === "handoff")
  )

  const partsToRender = hasHandoff
    ? message.parts.filter((p) => p.type !== "text")
    : message.parts

  const messageContent = (
    <MessageContent>
      {partsToRender.map((part, partIndex) => {
        const key = `${message.id}-${messageIndex}-${partIndex}`

        if (part.type === "text") {
          return <MessageResponse key={key}>{part.text}</MessageResponse>
        }

        if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
          return (
            <ToolCall
              key={key}
              part={part as unknown as GenericToolPart}
              bots={bots}
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
