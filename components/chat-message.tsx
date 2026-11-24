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
import { Badge } from "@/components/ui/badge"
import type { ChatBotItem } from "@/components/chat-view"

export interface ChatMessageProps {
  message: UIMessage
  messageIndex: number
  isGroup?: boolean
  bots?: ChatBotItem[]
}

interface MessageSection {
  author?: ChatBotItem
  parts: UIMessage["parts"]
}

function isHandoffPart(part: unknown): boolean {
  const p = part as { type?: string; toolName?: string }
  return (
    p.type === "tool-handoff" ||
    (p.type === "dynamic-tool" && p.toolName === "handoff")
  )
}

function isHandoffOutputPart(part: unknown): part is {
  type: string
  state: "output-available"
  output: { botId?: string; name?: string }
} {
  const p = part as {
    state?: string
    output?: { botId?: string; name?: string }
  }
  return (
    isHandoffPart(part) &&
    p.state === "output-available" &&
    Boolean(p.output?.botId)
  )
}

function getSectionParts(parts: UIMessage["parts"]): UIMessage["parts"] {
  // If a handoff occurred in this section, only render the toolcall part and remove all unnecessary text
  const hasHandoff = parts.some(isHandoffPart)
  return hasHandoff ? parts.filter((p) => p.type !== "text") : parts
}

function splitByAuthor(
  message: UIMessage,
  bots: ChatBotItem[]
): MessageSection[] {
  const findBot = (botId?: string) => bots.find((b) => b.id === botId)
  const initialBotId = (message.metadata as { botId?: string } | undefined)
    ?.botId

  let section: MessageSection = {
    author: findBot(initialBotId) ?? bots[0],
    parts: [],
  }
  const sections: MessageSection[] = [section]

  for (const part of message.parts) {
    section.parts.push(part)
    if (isHandoffOutputPart(part)) {
      section = { author: findBot(part.output.botId), parts: [] }
      sections.push(section)
    }
  }

  return sections.filter((s) => s.parts.length > 0)
}

function renderMessagePart(
  part: UIMessage["parts"][number],
  key: string,
  bots: ChatBotItem[]
) {
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
}

export function ChatMessage({
  message,
  messageIndex,
  isGroup = false,
  bots = [],
}: ChatMessageProps) {
  const isAssistant = message.role === "assistant"
  const targetBotId = (message.metadata as { botId?: string } | undefined)
    ?.botId
  const targetBot =
    isGroup && !isAssistant && targetBotId
      ? bots.find((b) => b.id === targetBotId)
      : undefined

  const sections = React.useMemo(() => {
    if (!isGroup || !isAssistant) return null
    return splitByAuthor(message, bots)
  }, [isGroup, isAssistant, message, bots])

  // Ignore legacy synthetic handoff prompt triggers if present in transcripts
  if (
    message.role === "user" &&
    message.parts.some(
      (p) => p.type === "text" && p.text?.startsWith("[Handoff from ")
    )
  ) {
    return null
  }

  if (isGroup && isAssistant && sections) {
    return (
      <div className="flex flex-col gap-4">
        {sections.map((section, secIdx) => {
          const parts = getSectionParts(section.parts)
          if (parts.length === 0) return null

          const author = section.author

          return (
            <Message
              key={`${message.id}-sec-${secIdx}`}
              from={message.role}
              className="flex-row items-start gap-3"
            >
              {author && (
                <ChatAvatar
                  seed={author.avatar || author.id}
                  alt={author.name}
                  className="mt-0.5 size-7 shrink-0"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {author?.name && (
                  <span className="text-xs font-medium text-muted-foreground select-none">
                    {author.name}
                  </span>
                )}
                <MessageContent>
                  {parts.map((part, partIdx) =>
                    renderMessagePart(
                      part,
                      `${message.id}-${messageIndex}-${secIdx}-${partIdx}`,
                      bots
                    )
                  )}
                </MessageContent>
              </div>
            </Message>
          )
        })}
      </div>
    )
  }

  return (
    <Message from={message.role}>
      <MessageContent>
        {targetBot ? (
          <div className="flex items-start gap-2">
            <Badge
              variant="outline"
              className="shrink-0 gap-1.5 bg-background/30 pr-2 pl-1"
            >
              <ChatAvatar
                seed={targetBot.avatar || targetBot.id}
                alt={targetBot.name}
                className="size-4"
              />
              <span>{targetBot.name}</span>
            </Badge>
            <div className="flex min-w-0 flex-col gap-2">
              {message.parts.map((part, partIdx) =>
                renderMessagePart(
                  part,
                  `${message.id}-${messageIndex}-${partIdx}`,
                  bots
                )
              )}
            </div>
          </div>
        ) : (
          message.parts.map((part, partIdx) =>
            renderMessagePart(
              part,
              `${message.id}-${messageIndex}-${partIdx}`,
              bots
            )
          )
        )}
      </MessageContent>
    </Message>
  )
}

export default ChatMessage
