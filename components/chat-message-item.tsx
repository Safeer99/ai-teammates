"use client"

import * as React from "react"
import type { UIMessage } from "ai"

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import { Badge } from "@/components/ui/badge"
import { ChatAvatar } from "@/components/chat-avatar"
import { Spinner } from "@/components/ui/spinner"
import {
  type GenericToolPart,
  HandoffPart,
  ScreenViewPart,
  ToolCallPart,
} from "./chat-tool-parts"
import type { ChatBotItem } from "./chat-view"

export function getUserMessageTargetBot(
  message: UIMessage,
  messageIndex: number,
  allMessages: UIMessage[],
  bots: ChatBotItem[]
): ChatBotItem | undefined {
  const meta = (message as { metadata?: { selectedBotId?: string } }).metadata
  if (meta?.selectedBotId) {
    const found = bots.find((b) => b.id === meta.selectedBotId)
    if (found) return found
  }

  // Check next assistant message metadata
  if (messageIndex + 1 < allMessages.length) {
    const nextMsg = allMessages[messageIndex + 1] as {
      metadata?: {
        botId?: string
        selectedBotId?: string
        handedOffFromBotId?: string
      }
    }
    const nextBotId =
      nextMsg.metadata?.handedOffFromBotId ||
      nextMsg.metadata?.selectedBotId ||
      nextMsg.metadata?.botId
    if (nextBotId) {
      const found = bots.find((b) => b.id === nextBotId)
      if (found) return found
    }
  }

  return bots[0]
}

export function renderMessageParts(
  parts: UIMessage["parts"],
  messageId: string,
  keySuffix: string | number,
  bots: ChatBotItem[]
) {
  return parts.map((part, partIndex) => {
    if (part.type === "text") {
      return (
        <MessageResponse key={`${messageId}-${keySuffix}-${partIndex}`}>
          {part.text}
        </MessageResponse>
      )
    }

    const isToolPart =
      part.type === "dynamic-tool" || part.type.startsWith("tool-")

    if (isToolPart) {
      const genericPart = part as unknown as GenericToolPart
      const toolName =
        genericPart.type === "dynamic-tool"
          ? (genericPart.toolName ?? "")
          : genericPart.type.replace(/^tool-/, "")

      // viewScreen: agent internal screen inspection - never rendered in chat
      if (toolName === "viewScreen" || toolName === "view_screen") {
        return null
      }

      // showScreen: user-facing screen capture - rendered in chat
      if (toolName === "showScreen" || toolName === "show_screen") {
        return (
          <ScreenViewPart
            key={`${messageId}-${keySuffix}-${partIndex}`}
            part={genericPart}
          />
        )
      }

      // handoff: bot-to-bot handoff in group chat
      if (toolName === "handoff") {
        return (
          <HandoffPart
            key={`${messageId}-${keySuffix}-${partIndex}`}
            part={genericPart}
            bots={bots}
          />
        )
      }

      // Generic tool call rendering
      return (
        <ToolCallPart
          key={`${messageId}-${keySuffix}-${partIndex}`}
          part={genericPart}
        />
      )
    }

    return null
  })
}

export interface ChatMessageItemProps {
  message: UIMessage
  messageIndex: number
  allMessages: UIMessage[]
  isGroup?: boolean
  bots?: ChatBotItem[]
  isGenerating?: boolean
}

export function ChatMessageItem({
  message,
  messageIndex,
  allMessages,
  isGroup = false,
  bots = [],
  isGenerating = false,
}: ChatMessageItemProps) {
  if (isGroup && message.role === "assistant") {
    const meta = (
      message as {
        metadata?: {
          botId?: string
          selectedBotId?: string
          handedOffFromBotId?: string
          handedOffFromBotName?: string
        }
      }
    ).metadata

    const handoffIndex = message.parts.findIndex(
      (p) =>
        (p.type === "dynamic-tool" &&
          (p as unknown as GenericToolPart).toolName === "handoff") ||
        p.type === "tool-handoff"
    )

    if (handoffIndex !== -1) {
      // Handoff occurred: display first bot's message, then second bot's message
      let firstBot: ChatBotItem | undefined
      if (meta?.handedOffFromBotId) {
        firstBot = bots.find((b) => b.id === meta.handedOffFromBotId)
      }
      if (!firstBot) {
        for (let i = messageIndex - 1; i >= 0; i--) {
          if (allMessages[i].role === "user") {
            const userMeta = (
              allMessages[i] as {
                metadata?: { selectedBotId?: string }
              }
            ).metadata
            if (userMeta?.selectedBotId) {
              firstBot = bots.find((b) => b.id === userMeta.selectedBotId)
              break
            }
          }
        }
      }
      if (!firstBot) {
        firstBot = bots[0]
      }

      const handoffPart = message.parts[handoffIndex] as GenericToolPart
      const input = handoffPart.input as
        | { targetBotName?: string }
        | undefined
      const output = handoffPart.output as
        | { targetBotId?: string; targetBotName?: string }
        | undefined
      const targetName = output?.targetBotName || input?.targetBotName
      const targetId = output?.targetBotId
      let secondBot = bots.find(
        (b) =>
          (targetId && b.id === targetId) ||
          (targetName && b.name.toLowerCase() === targetName.toLowerCase())
      )
      if (!secondBot && meta?.botId) {
        secondBot = bots.find((b) => b.id === meta.botId)
      }
      if (!secondBot) {
        secondBot = bots.find((b) => b.id !== firstBot?.id)
      }

      const firstBotParts = message.parts.slice(0, handoffIndex + 1)
      const secondBotParts = message.parts.slice(handoffIndex + 1)

      return (
        <React.Fragment key={`${message.id}-${messageIndex}`}>
          {/* First bot: Handoff message in message box */}
          <Message from="assistant">
            <div className="flex w-full items-start gap-3">
              <ChatAvatar
                seed={firstBot?.avatar || firstBot?.id || "bot"}
                className="mt-0.5 size-7 shrink-0 rounded-full ring-1 ring-border/50"
                alt={firstBot?.name}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs leading-none font-semibold text-foreground/80">
                  {firstBot?.name}
                </span>
                <MessageContent className="w-full">
                  {renderMessageParts(
                    firstBotParts,
                    message.id,
                    "first",
                    bots
                  )}
                </MessageContent>
              </div>
            </div>
          </Message>

          {/* Second bot: Reply to user's prompt as a new message */}
          {secondBotParts.length > 0 && (
            <Message from="assistant">
              <div className="flex w-full items-start gap-3">
                <ChatAvatar
                  seed={
                    secondBot?.avatar ||
                    secondBot?.id ||
                    firstBot?.avatar ||
                    "bot"
                  }
                  className="mt-0.5 size-7 shrink-0 rounded-full ring-1 ring-border/50"
                  alt={secondBot?.name}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-xs leading-none font-semibold text-foreground/80">
                    {secondBot?.name}
                  </span>
                  <MessageContent className="w-full">
                    {renderMessageParts(
                      secondBotParts,
                      message.id,
                      "second",
                      bots
                    )}
                  </MessageContent>
                </div>
              </div>
            </Message>
          )}

          {/* Second bot: Thinking state if currently generating */}
          {secondBotParts.length === 0 &&
            isGenerating &&
            messageIndex === allMessages.length - 1 && (
              <Message from="assistant">
                <div className="flex w-full items-start gap-3">
                  <ChatAvatar
                    seed={
                      secondBot?.avatar ||
                      secondBot?.id ||
                      firstBot?.avatar ||
                      "bot"
                    }
                    className="mt-0.5 size-7 shrink-0 rounded-full ring-1 ring-border/50"
                    alt={secondBot?.name}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-xs leading-none font-semibold text-foreground/80">
                      {secondBot?.name}
                    </span>
                    <MessageContent className="w-full">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner className="size-4" />
                        <span>Thinking...</span>
                      </div>
                    </MessageContent>
                  </div>
                </div>
              </Message>
            )}
        </React.Fragment>
      )
    }

    // Standard assistant message in group chat (no handoff)
    let messageBot = bots.find(
      (b) => b.id === (meta?.botId || meta?.selectedBotId)
    )
    if (!messageBot) {
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (allMessages[i].role === "user") {
          const userMeta = (
            allMessages[i] as {
              metadata?: { selectedBotId?: string }
            }
          ).metadata
          if (userMeta?.selectedBotId) {
            messageBot = bots.find((b) => b.id === userMeta.selectedBotId)
            break
          }
        }
      }
    }
    if (!messageBot) {
      messageBot = bots[0]
    }

    return (
      <Message from={message.role} key={`${message.id}-${messageIndex}`}>
        <div className="flex w-full items-start gap-3">
          <ChatAvatar
            seed={messageBot?.avatar || messageBot?.id || "bot"}
            className="mt-0.5 size-7 shrink-0 rounded-full ring-1 ring-border/50"
            alt={messageBot?.name}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs leading-none font-semibold text-foreground/80">
              {messageBot?.name}
            </span>
            <MessageContent className="w-full">
              {renderMessageParts(
                message.parts,
                message.id,
                messageIndex,
                bots
              )}
            </MessageContent>
          </div>
        </div>
      </Message>
    )
  }

  if (message.role === "user") {
    const userTargetBot = isGroup
      ? getUserMessageTargetBot(message, messageIndex, allMessages, bots)
      : undefined

    const textParts = message.parts.filter(
      (p) => p.type === "text"
    ) as Array<{ type: "text"; text: string }>
    const otherParts = message.parts.filter((p) => p.type !== "text")

    return (
      <Message from={message.role} key={`${message.id}-${messageIndex}`}>
        <MessageContent>
          {textParts.map((part, partIndex) => (
            <div
              key={`${message.id}-${messageIndex}-${partIndex}`}
              className="text-sm leading-relaxed wrap-break-word whitespace-pre-wrap"
            >
              {partIndex === 0 && userTargetBot && (
                <Badge
                  variant="outline"
                  className="mr-1.5 inline-flex h-5 max-w-40 -translate-y-px items-center gap-1 rounded-full border-border/50 bg-background/80 py-0 pr-2 pl-1 align-middle text-[11px] font-medium text-foreground shadow-2xs backdrop-blur-xs select-none"
                >
                  <ChatAvatar
                    seed={userTargetBot.avatar || userTargetBot.id}
                    className="size-3.5 shrink-0 rounded-full ring-1 ring-border/50"
                    alt={userTargetBot.name}
                  />
                  <span className="max-w-28 truncate">
                    @{userTargetBot.name}
                  </span>
                </Badge>
              )}
              <span>{part.text}</span>
            </div>
          ))}
          {otherParts.length > 0 &&
            renderMessageParts(
              otherParts,
              message.id,
              messageIndex,
              bots
            )}
        </MessageContent>
      </Message>
    )
  }

  return (
    <Message from={message.role} key={`${message.id}-${messageIndex}`}>
      <MessageContent className={message.role === "assistant" ? "w-full" : undefined}>
        {renderMessageParts(message.parts, message.id, messageIndex, bots)}
      </MessageContent>
    </Message>
  )
}
