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

function isHandoffOutputPart(part: unknown): part is {
  type: string
  state: "output-available"
  output: { botId?: string; name?: string }
} {
  const p = part as {
    type?: string
    toolName?: string
    state?: string
    output?: { botId?: string; name?: string }
  }
  const isHandoff =
    p.type === "tool-handoff" ||
    (p.type === "dynamic-tool" && p.toolName === "handoff")
  return Boolean(isHandoff && p.state === "output-available" && p.output?.botId)
}

interface MessageSection {
  author?: ChatBotItem
  parts: UIMessage["parts"]
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

export function ChatMessage({
  message,
  messageIndex,
  isGroup = false,
  bots = [],
}: ChatMessageProps) {
  const isAssistant = message.role === "assistant"

  const sections = React.useMemo(() => {
    if (!isGroup || !isAssistant) return null
    return splitByAuthor(message, bots)
  }, [isGroup, isAssistant, message, bots])

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

  if (isGroup && isAssistant && sections) {
    return (
      <div className="flex flex-col gap-4">
        {sections.map((section, secIdx) => {
          const hasHandoffInThisSection = section.parts.some(
            (p) =>
              p.type === "tool-handoff" ||
              (p.type === "dynamic-tool" &&
                (p as { toolName?: string }).toolName === "handoff")
          )

          // If a handoff occurred in this section, only render the toolcall part and remove all unnecessary text
          const partsToRender = hasHandoffInThisSection
            ? section.parts.filter((p) => p.type !== "text")
            : section.parts

          if (partsToRender.length === 0) return null

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
                  {partsToRender.map((part, partIndex) => {
                    const key = `${message.id}-${messageIndex}-${secIdx}-${partIndex}`

                    if (part.type === "text") {
                      return (
                        <MessageResponse key={key}>
                          {part.text}
                        </MessageResponse>
                      )
                    }

                    if (
                      part.type === "dynamic-tool" ||
                      part.type.startsWith("tool-")
                    ) {
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
                bots={bots}
              />
            )
          }

          return null
        })}
      </MessageContent>
    </Message>
  )
}

export default ChatMessage
