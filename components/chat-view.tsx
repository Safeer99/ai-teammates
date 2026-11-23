"use client"

import * as React from "react"
import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import type { UIMessage } from "ai"
import { MessageSquareIcon } from "lucide-react"

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
import { ChatAvatar } from "@/components/chat-avatar"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { Spinner } from "@/components/ui/spinner"
import type { chatAgent } from "@/trigger/chat"
import { ChatMessageItem } from "./chat-message-item"

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
  const activeTargetBotId = isGroup ? (selectedBotId || bots[0]?.id) : undefined

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text?.trim()
    if (!text) return

    sendMessage(
      {
        text,
        ...(activeTargetBotId
          ? { metadata: { selectedBotId: activeTargetBotId } }
          : {}),
      },
      activeTargetBotId
        ? { metadata: { selectedBotId: activeTargetBotId } }
        : undefined
    )
    setInput("")
  }

  const isGenerating = status === "submitted" || status === "streaming"

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
            messages.map((message, messageIndex) => (
              <ChatMessageItem
                key={`${message.id}-${messageIndex}`}
                message={message}
                messageIndex={messageIndex}
                allMessages={messages}
                isGroup={isGroup}
                bots={bots}
                isGenerating={isGenerating}
              />
            ))
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
