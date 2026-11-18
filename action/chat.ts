"use server"

import { auth as clerkAuth } from "@clerk/nextjs/server"
import { auth as triggerAuth } from "@trigger.dev/sdk"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"

import { getChat } from "@/queries/chats"

const rawStartChatSession = chat.createStartSessionAction("chat-agent")
const rawLoadTranscript = chat.createLoadTranscriptAction(defaultStorage, {
  limit: 50,
})

export async function startChatSession(params: {
  chatId: string
  clientData?: unknown
}) {
  const { isAuthenticated, userId } = await clerkAuth()
  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  const existingChat = await getChat(params.chatId)
  if (!existingChat) {
    throw new Error("Chat not found")
  }

  return rawStartChatSession(params)
}

export async function mintChatAccessToken(chatId: string) {
  const { isAuthenticated, userId } = await clerkAuth()
  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  const existingChat = await getChat(chatId)
  if (!existingChat) {
    throw new Error("Chat not found")
  }

  return triggerAuth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  })
}

export async function loadTranscript(params: {
  chatId: string
  clientData?: unknown
  limit?: number
  before?: string
}) {
  const { isAuthenticated, userId } = await clerkAuth()
  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  const existingChat = await getChat(params.chatId)
  if (!existingChat) {
    throw new Error("Chat not found")
  }

  return rawLoadTranscript(params)
}
