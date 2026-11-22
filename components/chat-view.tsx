"use client"

import * as React from "react"
import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import type { UIMessage } from "ai"
import {
  ArrowRightLeftIcon,
  MessageSquareIcon,
  MonitorIcon,
} from "lucide-react"

import {
  loadTranscript,
  mintChatAccessToken,
  startChatSession,
} from "@/action/chat"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import { Badge } from "@/components/ui/badge"
import { ChatAvatar } from "@/components/chat-avatar"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { Spinner } from "@/components/ui/spinner"
import type { chatAgent } from "@/trigger/chat"

export interface ChatBotItem {
  id: string
  name: string
  job?: string | null
  instructions?: string | null
  avatar?: string | null
}

export interface ChatViewProps {
  chatId: string
  name?: string | null
  avatarSeed?: string
  isGroup?: boolean
  bots?: ChatBotItem[]
}

export function ChatView({
  chatId,
  name,
  avatarSeed,
  isGroup = false,
  bots = [],
}: ChatViewProps) {
  const [selectedBotId, setSelectedBotId] = useState<string>(bots[0]?.id ?? "")

  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat-agent",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
    clientData: selectedBotId ? { selectedBotId } : {},
  })

  React.useEffect(() => {
    if (
      selectedBotId &&
      typeof (
        transport as unknown as { setClientData?: (data: unknown) => void }
      ).setClientData === "function"
    ) {
      ;(
        transport as unknown as { setClientData: (data: unknown) => void }
      ).setClientData({
        selectedBotId,
      })
    }
  }, [selectedBotId, transport])

  const { messages: initialMessages, isLoading } = useLoadTranscript(
    chatId,
    loadTranscript,
    { transport }
  )

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <ChatContent
      key={chatId}
      chatId={chatId}
      name={name}
      avatarSeed={avatarSeed}
      isGroup={isGroup}
      bots={bots}
      selectedBotId={selectedBotId}
      onSelectBot={setSelectedBotId}
      initialMessages={initialMessages}
      transport={transport}
    />
  )
}

interface ChatContentProps {
  chatId: string
  name?: string | null
  avatarSeed?: string
  isGroup?: boolean
  bots?: ChatBotItem[]
  selectedBotId: string
  onSelectBot: (botId: string) => void
  initialMessages: UIMessage[]
  transport: ReturnType<typeof useTriggerChatTransport<typeof chatAgent>>
}

interface ScreenOutput {
  screenshot?: string
  width?: number
  height?: number
  mediaType?: string
  error?: string
}

interface GenericToolPart {
  type: string
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error"
    | "output-denied"
    | "approval-requested"
    | "approval-responded"
  toolName?: string
  input?: Record<string, unknown>
  output?: unknown
  errorText?: string
}

function getToolTitle(
  toolName: string,
  input?: Record<string, unknown>
): string {
  switch (toolName) {
    case "bash":
      return typeof input?.command === "string"
        ? `$ ${input.command}`
        : "Run Command"
    case "readFile":
      return typeof input?.path === "string"
        ? `Read ${input.path}`
        : "Read File"
    case "writeFile":
      return typeof input?.path === "string"
        ? `Write ${input.path}`
        : "Write File"
    case "listFiles":
      return typeof input?.path === "string"
        ? `List ${input.path}`
        : "List Files"
    case "mouseClick":
      return input ? `Click (${input.x}, ${input.y})` : "Mouse Click"
    case "mouseMove":
      return input ? `Move to (${input.x}, ${input.y})` : "Mouse Move"
    case "mouseScroll":
      return input
        ? `Scroll ${input.direction} at (${input.x}, ${input.y})`
        : "Mouse Scroll"
    case "keyboardType":
      return typeof input?.text === "string"
        ? `Type "${input.text}"`
        : "Keyboard Type"
    case "keyboardPress":
      return typeof input?.key === "string"
        ? `Press ${Array.isArray(input.modifiers) && input.modifiers.length ? `${input.modifiers.join("+")}+` : ""}${input.key}`
        : "Keyboard Press"
    case "showScreen":
      return "Screen Capture"
    case "handoff":
      return typeof input?.targetBotName === "string"
        ? `Handoff to ${input.targetBotName}`
        : "Handoff to Teammate"
    default:
      return toolName
  }
}

function HandoffPart({
  part,
  bots,
}: {
  part: GenericToolPart
  bots: ChatBotItem[]
}) {
  const input = part.input as
    { targetBotName?: string; reason?: string } | undefined
  const output = part.output as
    | {
        success?: boolean
        targetBotName?: string
        targetBotJob?: string
        reason?: string
        error?: string
      }
    | undefined
  const targetBotName =
    output?.targetBotName || input?.targetBotName || "Teammate"
  const targetBot = bots.find(
    (b) => b.name.toLowerCase() === targetBotName.toLowerCase()
  )
  const reason = output?.reason || input?.reason
  const isLoading =
    part.state === "input-available" || part.state === "input-streaming"

  return (
    <div className="w-full rounded-2xl border border-border/40 bg-card/60 p-4 shadow-xs">
      <div className="flex items-start gap-3.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
          <ArrowRightLeftIcon className="size-3.5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                Handoff to {targetBotName}
              </span>
              {(targetBot?.job || output?.targetBotJob) && (
                <Badge
                  variant="secondary"
                  className="rounded-full px-2 py-0 text-[11px] font-normal text-muted-foreground"
                >
                  {targetBot?.job || output?.targetBotJob}
                </Badge>
              )}
              {isLoading && (
                <Spinner className="size-3 text-muted-foreground" />
              )}
            </div>
            {targetBot && (
              <ChatAvatar
                seed={targetBot.avatar || targetBot.id}
                className="size-6 shrink-0 rounded-full ring-1 ring-border/50"
                alt={targetBot.name}
              />
            )}
          </div>
          {reason && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {reason}
            </p>
          )}
          {output?.error && (
            <p className="text-xs font-medium text-destructive">
              {output.error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ScreenViewPart({ part }: { part: GenericToolPart }) {
  const isLoading =
    part.state === "input-available" || part.state === "input-streaming"
  const output = part.output as ScreenOutput | undefined
  const isError =
    part.state === "output-error" || !!part.errorText || !!output?.error

  if (isLoading) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Spinner className="size-4 text-primary" />
        <span>Capturing screen...</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="my-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
        Failed to capture screen:{" "}
        {part.errorText || output?.error || "Unknown error"}
      </div>
    )
  }

  if (output?.screenshot) {
    return (
      <div className="my-2 flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <MonitorIcon className="size-4 text-primary" />
            <span>Screen Snapshot</span>
          </div>
          {output.width && output.height && (
            <Badge
              variant="outline"
              className="text-[10px] text-muted-foreground"
            >
              {output.width} × {output.height}
            </Badge>
          )}
        </div>
        <div className="overflow-hidden rounded-md border bg-black/5 dark:bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:${output.mediaType || "image/png"};base64,${output.screenshot}`}
            alt="Screen capture"
            className="h-auto max-h-125 w-full object-contain"
          />
        </div>
      </div>
    )
  }

  return null
}

function ToolCallPart({ part }: { part: GenericToolPart }) {
  const toolName =
    part.type === "dynamic-tool"
      ? (part.toolName ?? "tool")
      : part.type.replace(/^tool-/, "")
  const title = getToolTitle(toolName, part.input)

  return (
    <Tool
      defaultOpen={
        part.state === "input-available" || part.state === "output-error"
      }
      className="my-2 bg-card"
    >
      <ToolHeader
        type={part.type as "dynamic-tool"}
        state={part.state}
        toolName={part.type === "dynamic-tool" ? toolName : ""}
        title={title}
      />
      <ToolContent>
        {part.input && Object.keys(part.input).length > 0 && (
          <ToolInput input={part.input} />
        )}
        {(Boolean(part.output) || Boolean(part.errorText)) && (
          <ToolOutput output={part.output} errorText={part.errorText} />
        )}
      </ToolContent>
    </Tool>
  )
}

function getUserMessageTargetBot(
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

function ChatContent({
  chatId,
  name,
  avatarSeed,
  isGroup = false,
  bots = [],
  selectedBotId,
  onSelectBot,
  initialMessages,
  transport,
}: ChatContentProps) {
  const [input, setInput] = useState("")
  const { messages, sendMessage, status, stop, error } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    resume: initialMessages.length > 0,
  })

  const selectedBot = bots.find((b) => b.id === selectedBotId) ?? bots[0]

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text?.trim()
    if (!text) return

    sendMessage(
      { text },
      isGroup && selectedBotId ? { metadata: { selectedBotId } } : undefined
    )
    setInput("")
  }

  const isGenerating = status === "submitted" || status === "streaming"

  const renderMessageParts = (
    parts: UIMessage["parts"],
    messageId: string,
    keySuffix: string | number
  ) => {
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

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <Conversation className="min-h-0 w-full min-w-0 flex-1 overflow-hidden">
        <ConversationContent className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={
                isGroup && bots.length > 0 ? (
                  <GroupChatAvatar bots={bots} className="size-12" />
                ) : avatarSeed ? (
                  <ChatAvatar seed={avatarSeed} className="size-12" />
                ) : (
                  <MessageSquareIcon className="size-10 text-muted-foreground" />
                )
              }
              title={name ? `Chat with ${name}` : "Start a conversation"}
              description="Type a message below to begin chatting."
            />
          ) : (
            messages.map((message, messageIndex) => {
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
                      (p as unknown as GenericToolPart).toolName ===
                        "handoff") ||
                    p.type === "tool-handoff"
                )

                if (handoffIndex !== -1) {
                  // Handoff occurred: display first bot's message, then second bot's message
                  let firstBot: ChatBotItem | undefined
                  if (meta?.handedOffFromBotId) {
                    firstBot = bots.find(
                      (b) => b.id === meta.handedOffFromBotId
                    )
                  }
                  if (!firstBot) {
                    for (let i = messageIndex - 1; i >= 0; i--) {
                      if (messages[i].role === "user") {
                        const userMeta = (
                          messages[i] as {
                            metadata?: { selectedBotId?: string }
                          }
                        ).metadata
                        if (userMeta?.selectedBotId) {
                          firstBot = bots.find(
                            (b) => b.id === userMeta.selectedBotId
                          )
                          break
                        }
                      }
                    }
                  }
                  if (!firstBot) {
                    firstBot = bots[0]
                  }

                  const handoffPart = message.parts[
                    handoffIndex
                  ] as GenericToolPart
                  const input = handoffPart.input as
                    { targetBotName?: string } | undefined
                  const output = handoffPart.output as
                    { targetBotId?: string; targetBotName?: string } | undefined
                  const targetName =
                    output?.targetBotName || input?.targetBotName
                  const targetId = output?.targetBotId
                  let secondBot = bots.find(
                    (b) =>
                      (targetId && b.id === targetId) ||
                      (targetName &&
                        b.name.toLowerCase() === targetName.toLowerCase())
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
                            <MessageContent>
                              {renderMessageParts(
                                firstBotParts,
                                message.id,
                                "first"
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
                              <MessageContent>
                                {renderMessageParts(
                                  secondBotParts,
                                  message.id,
                                  "second"
                                )}
                              </MessageContent>
                            </div>
                          </div>
                        </Message>
                      )}

                      {/* Second bot: Thinking state if currently generating */}
                      {secondBotParts.length === 0 &&
                        isGenerating &&
                        messageIndex === messages.length - 1 && (
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
                                <MessageContent>
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
                    if (messages[i].role === "user") {
                      const userMeta = (
                        messages[i] as {
                          metadata?: { selectedBotId?: string }
                        }
                      ).metadata
                      if (userMeta?.selectedBotId) {
                        messageBot = bots.find(
                          (b) => b.id === userMeta.selectedBotId
                        )
                        break
                      }
                    }
                  }
                }
                if (!messageBot) {
                  messageBot = bots[0]
                }

                return (
                  <Message
                    from={message.role}
                    key={`${message.id}-${messageIndex}`}
                  >
                    <div className="flex w-full items-start gap-3">
                      <ChatAvatar
                        seed={messageBot.avatar || messageBot.id}
                        className="mt-0.5 size-7 shrink-0 rounded-full ring-1 ring-border/50"
                        alt={messageBot.name}
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-xs leading-none font-semibold text-foreground/80">
                          {messageBot.name}
                        </span>
                        <MessageContent>
                          {renderMessageParts(
                            message.parts,
                            message.id,
                            messageIndex
                          )}
                        </MessageContent>
                      </div>
                    </div>
                  </Message>
                )
              }

              if (message.role === "user") {
                const userTargetBot = isGroup
                  ? getUserMessageTargetBot(
                      message,
                      messageIndex,
                      messages,
                      bots
                    )
                  : undefined

                const textParts = message.parts.filter(
                  (p) => p.type === "text"
                ) as Array<{ type: "text"; text: string }>
                const otherParts = message.parts.filter(
                  (p) => p.type !== "text"
                )

                return (
                  <Message
                    from={message.role}
                    key={`${message.id}-${messageIndex}`}
                  >
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
                          messageIndex
                        )}
                    </MessageContent>
                  </Message>
                )
              }

              return (
                <Message
                  from={message.role}
                  key={`${message.id}-${messageIndex}`}
                >
                  <MessageContent>
                    {renderMessageParts(
                      message.parts,
                      message.id,
                      messageIndex
                    )}
                  </MessageContent>
                </Message>
              )
            })
          )}

          {status === "submitted" && (
            <Message from="assistant">
              {isGroup && selectedBot ? (
                <div className="flex w-full items-start gap-3">
                  <ChatAvatar
                    seed={selectedBot.avatar || selectedBot.id}
                    className="mt-0.5 size-7 shrink-0 rounded-full ring-1 ring-border/50"
                    alt={selectedBot.name}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-xs leading-none font-semibold text-foreground/80">
                      {selectedBot.name}
                    </span>
                    <MessageContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner className="size-4" />
                        <span>Thinking...</span>
                      </div>
                    </MessageContent>
                  </div>
                </div>
              ) : (
                <MessageContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner className="size-4" />
                    <span>Thinking...</span>
                  </div>
                </MessageContent>
              )}
            </Message>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error.message ||
                "An error occurred while generating a response."}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="p-4 pt-0">
        <div className="mx-auto max-w-3xl">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea
                value={input}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setInput(e.target.value)
                }
                placeholder={
                  isGroup && selectedBot
                    ? `Message ${selectedBot.name}...`
                    : name
                      ? `Message ${name}...`
                      : "Type a message..."
                }
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                {isGroup && bots.length > 0 && (
                  <PromptInputSelect
                    value={selectedBotId}
                    onValueChange={(val: unknown) => {
                      if (typeof val === "string") {
                        onSelectBot(val)
                      }
                    }}
                  >
                    <PromptInputSelectTrigger className="h-7 gap-1.5 rounded-md px-2 text-xs font-normal">
                      {selectedBot && (
                        <ChatAvatar
                          seed={selectedBot.avatar || selectedBot.id}
                          className="size-4 shrink-0"
                        />
                      )}
                      <PromptInputSelectValue placeholder="Select bot">
                        {selectedBot?.name ?? "Select bot"}
                      </PromptInputSelectValue>
                    </PromptInputSelectTrigger>
                    <PromptInputSelectContent>
                      {bots.map((bot) => (
                        <PromptInputSelectItem key={bot.id} value={bot.id}>
                          <div className="flex items-center gap-2">
                            <ChatAvatar
                              seed={bot.avatar || bot.id}
                              className="size-4 shrink-0"
                            />
                            <span>{bot.name}</span>
                          </div>
                        </PromptInputSelectItem>
                      ))}
                    </PromptInputSelectContent>
                  </PromptInputSelect>
                )}
              </PromptInputTools>
              <PromptInputSubmit
                status={status}
                onStop={stop}
                disabled={!input.trim() && !isGenerating}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  )
}

export default ChatView
