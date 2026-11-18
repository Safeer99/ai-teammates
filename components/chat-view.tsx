"use client"

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
    <div className="flex flex-1 flex-col overflow-hidden">
      <Conversation className="flex-1">
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
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, index) => {
                    switch (part.type) {
                      case "text":
                        return (
                          <MessageResponse key={`${message.id}-${index}`}>
                            {part.text}
                          </MessageResponse>
                        )
                      default:
                        return null
                    }
                  })}
                </MessageContent>
              </Message>
            ))
          )}

          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Spinner className="size-4" />
                  <span>Thinking...</span>
                </div>
              </MessageContent>
            </Message>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error.message || "An error occurred while generating a response."}
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
                onChange={(e) => setInput(e.target.value)}
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
