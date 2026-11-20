"use client"

import * as React from "react"
import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import type { UIMessage } from "ai"
import { MessageSquareIcon, MonitorIcon } from "lucide-react"

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
import { Spinner } from "@/components/ui/spinner"
import type { chatAgent } from "@/trigger/chat"

export interface ChatViewProps {
  chatId: string
  name?: string | null
  avatarSeed?: string
}

export function ChatView({ chatId, name, avatarSeed }: ChatViewProps) {
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat-agent",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
  })

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
      initialMessages={initialMessages}
      transport={transport}
    />
  )
}

interface ChatContentProps {
  chatId: string
  name?: string | null
  avatarSeed?: string
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
    default:
      return toolName
  }
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

function ChatContent({
  chatId,
  name,
  avatarSeed,
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

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text?.trim()
    if (!text) return

    sendMessage({ text })
    setInput("")
  }

  const isGenerating = status === "submitted" || status === "streaming"

  return (
    <div className="flex h-full w-full flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
      <Conversation className="flex-1 min-h-0 min-w-0 w-full overflow-hidden">
        <ConversationContent className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={
                avatarSeed ? (
                  <ChatAvatar seed={avatarSeed} className="size-12" />
                ) : (
                  <MessageSquareIcon className="size-10 text-muted-foreground" />
                )
              }
              title={name ? `Chat with ${name}` : "Start a conversation"}
              description="Type a message below to begin chatting."
            />
          ) : (
            messages.map((message, messageIndex) => (
              <Message from={message.role} key={`${message.id}-${messageIndex}`}>
                <MessageContent>
                  {message.parts.map((part, partIndex) => {
                    if (part.type === "text") {
                      return (
                        <MessageResponse
                          key={`${message.id}-${messageIndex}-${partIndex}`}
                        >
                          {part.text}
                        </MessageResponse>
                      )
                    }

                    const isToolPart =
                      part.type === "dynamic-tool" ||
                      part.type.startsWith("tool-")

                    if (isToolPart) {
                      const genericPart = part as unknown as GenericToolPart
                      const toolName =
                        genericPart.type === "dynamic-tool"
                          ? (genericPart.toolName ?? "")
                          : genericPart.type.replace(/^tool-/, "")

                      // viewScreen: agent internal screen inspection - never rendered in chat
                      if (
                        toolName === "viewScreen" ||
                        toolName === "view_screen"
                      ) {
                        return null
                      }

                      // showScreen: user-facing screen capture - rendered in chat
                      if (
                        toolName === "showScreen" ||
                        toolName === "show_screen"
                      ) {
                        return (
                          <ScreenViewPart
                            key={`${message.id}-${messageIndex}-${partIndex}`}
                            part={genericPart}
                          />
                        )
                      }

                      // Generic tool call rendering
                      return (
                        <ToolCallPart
                          key={`${message.id}-${messageIndex}-${partIndex}`}
                          part={genericPart}
                        />
                      )
                    }

                    return null
                  })}
                </MessageContent>
              </Message>
            ))
          )}

          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-4" />
                  <span>Thinking...</span>
                </div>
              </MessageContent>
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
                placeholder={name ? `Message ${name}...` : "Type a message..."}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools />
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
