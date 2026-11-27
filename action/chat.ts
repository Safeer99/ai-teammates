"use server"

import { auth as clerkAuth } from "@clerk/nextjs/server"
import { auth as triggerAuth } from "@trigger.dev/sdk"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { and, eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/db"
import { requireAuthAndPaidPlan } from "@/lib/billing-server"
import {
  chats,
  chatMembers,
  insertChatMemberSchema,
  insertChatSchema,
} from "@/db/schema"
import { getChat } from "@/queries/chats"

const rawStartChatSession = chat.createStartSessionAction("chat-agent")
const rawLoadTranscript = chat.createLoadTranscriptAction(defaultStorage, {
  limit: 50,
})

const createGroupChatSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  botIds: z.array(z.string()).min(1, "Please select at least one bot"),
})

export type CreateGroupChatInput = z.infer<typeof createGroupChatSchema>

export async function createGroupChat(data: CreateGroupChatInput) {
  const { userId } = await requireAuthAndPaidPlan()

  const validated = createGroupChatSchema.parse(data)

  // Verify all botIds belong to userId
  const userBots = await db.query.bots.findMany({
    where: (b, { and, eq, inArray }) =>
      and(eq(b.userId, userId), inArray(b.id, validated.botIds)),
  })

  if (userBots.length !== validated.botIds.length) {
    throw new Error("Some selected bots were not found or unauthorized")
  }

  const chatId = nanoid()

  const validatedChat = insertChatSchema.parse({
    id: chatId,
    userId,
    kind: "group",
    name: validated.name,
  })

  const memberInserts = validated.botIds.map((botId) =>
    insertChatMemberSchema.parse({
      chatId,
      botId,
    })
  )

  await db.batch([
    db.insert(chats).values(validatedChat),
    ...memberInserts.map((m) => db.insert(chatMembers).values(m)),
  ])

  revalidatePath("/", "layout")

  return { chatId }
}

const updateGroupChatSchema = z.object({
  chatId: z.string().min(1, "Chat ID is required"),
  name: z.string().min(1, "Group name is required"),
  botIds: z.array(z.string()).min(1, "Please select at least one bot"),
})

export type UpdateGroupChatInput = z.infer<typeof updateGroupChatSchema>

export async function updateGroupChat(data: UpdateGroupChatInput) {
  const { isAuthenticated, userId } = await clerkAuth()
  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  const validated = updateGroupChatSchema.parse(data)
  const uniqueBotIds = Array.from(new Set(validated.botIds))

  const existingChat = await db.query.chats.findFirst({
    where: (c, { and: andOp, eq: eqOp }) =>
      andOp(
        eqOp(c.id, validated.chatId),
        eqOp(c.userId, userId),
        eqOp(c.kind, "group")
      ),
  })

  if (!existingChat) {
    throw new Error("Group chat not found or unauthorized")
  }

  const userBots = await db.query.bots.findMany({
    where: (b, { and: andOp, eq: eqOp, inArray }) =>
      andOp(eqOp(b.userId, userId), inArray(b.id, uniqueBotIds)),
  })

  if (userBots.length !== uniqueBotIds.length) {
    throw new Error("Some selected bots were not found or unauthorized")
  }

  const memberInserts = uniqueBotIds.map((botId) =>
    insertChatMemberSchema.parse({
      chatId: validated.chatId,
      botId,
    })
  )

  await db.batch([
    db
      .update(chats)
      .set({ name: validated.name })
      .where(
        and(
          eq(chats.id, validated.chatId),
          eq(chats.userId, userId),
          eq(chats.kind, "group")
        )
      ),
    db.delete(chatMembers).where(eq(chatMembers.chatId, validated.chatId)),
    ...memberInserts.map((m) => db.insert(chatMembers).values(m)),
  ])

  revalidatePath("/", "layout")
  revalidatePath(`/chats/${validated.chatId}`)

  return { chatId: validated.chatId }
}

export async function deleteGroupChat(chatId: string) {
  const { isAuthenticated, userId } = await clerkAuth()
  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  const [deletedChat] = await db
    .delete(chats)
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.userId, userId),
        eq(chats.kind, "group")
      )
    )
    .returning()

  if (!deletedChat) {
    throw new Error("Group chat not found or unauthorized")
  }

  revalidatePath("/", "layout")

  return deletedChat
}

export async function startChatSession(params: {
  chatId: string
  clientData?: unknown
}) {
  await requireAuthAndPaidPlan()

  const existingChat = await getChat(params.chatId)
  if (!existingChat) {
    throw new Error("Chat not found")
  }

  return rawStartChatSession(params)
}

export async function mintChatAccessToken(chatId: string) {
  await requireAuthAndPaidPlan()

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
