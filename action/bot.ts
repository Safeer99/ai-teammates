"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { and, eq, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"

import { db } from "@/db"
import { getDaytonaClient } from "@/lib/daytona"
import {
  bots,
  chats,
  chatMembers,
  insertBotSchema,
  insertChatSchema,
  insertChatMemberSchema,
} from "@/db/schema"

export type CreateBotInput = {
  name: string
  job: string
  instructions?: string | null
  avatar?: string
}

export async function createBot(data: CreateBotInput) {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  const daytona = getDaytonaClient()
  const sandbox = await daytona.create()

  // Ensure sandbox is started and initialize blank MEMORY.md file on creation via bash touch
  try {
    if (sandbox.state !== "started") {
      await sandbox.start()
    }
    await sandbox.process.executeCommand("touch MEMORY.md")
  } catch (error) {
    console.error("Failed to create blank MEMORY.md in sandbox:", error)
  }

  const botId = nanoid()
  const chatId = nanoid()

  const validatedBot = insertBotSchema.parse({
    ...data,
    id: botId,
    avatar: data.avatar || nanoid(),
    userId,
    sandboxId: sandbox.id,
  })

  const validatedChat = insertChatSchema.parse({
    id: chatId,
    userId,
    kind: "direct",
    name: null,
  })

  const validatedMember = insertChatMemberSchema.parse({
    chatId,
    botId,
  })

  let botRows, chatRows, memberRows
  try {
    ;[botRows, chatRows, memberRows] = await db.batch([
      db.insert(bots).values(validatedBot).returning(),
      db.insert(chats).values(validatedChat).returning(),
      db.insert(chatMembers).values(validatedMember).returning(),
    ])
  } catch (error) {
    try {
      await sandbox.delete()
    } catch (cleanupError) {
      console.error(
        "Failed to clean up sandbox after db insertion failure:",
        cleanupError
      )
    }
    throw error
  }

  const newBot = botRows[0]
  const newChat = chatRows[0]
  const newMember = memberRows[0]

  revalidatePath("/")

  return {
    bot: newBot,
    chat: newChat,
    member: newMember,
  }
}

export type UpdateBotInput = {
  id: string
  name: string
  job: string
  instructions?: string | null
  avatar?: string
}

export async function updateBot(data: UpdateBotInput) {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  const validatedBot = insertBotSchema.parse({
    ...data,
    userId,
  })

  const [updatedBot] = await db
    .update(bots)
    .set({
      name: validatedBot.name,
      job: validatedBot.job,
      instructions: validatedBot.instructions,
      avatar: validatedBot.avatar,
    })
    .where(and(eq(bots.id, data.id), eq(bots.userId, userId)))
    .returning()

  if (!updatedBot) {
    throw new Error("Bot not found or unauthorized")
  }

  revalidatePath("/", "layout")

  return updatedBot
}

export async function deleteBot(botId: string) {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  // Find direct chats where this bot is a member
  const members = await db.query.chatMembers.findMany({
    where: (cm, { eq }) => eq(cm.botId, botId),
  })

  const chatIds = members.map((m) => m.chatId)

  // Delete the bot scoped to userId
  const [deletedBot] = await db
    .delete(bots)
    .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
    .returning()

  if (!deletedBot) {
    throw new Error("Bot not found or unauthorized")
  }

  // Delete associated Daytona sandbox if one exists
  if (deletedBot.sandboxId) {
    try {
      const daytona = getDaytonaClient()
      const sandbox = await daytona.get(deletedBot.sandboxId)
      await sandbox.delete()
    } catch (error) {
      console.error("Failed to delete Daytona sandbox:", error)
    }
  }

  // Also delete associated direct chats belonging to this user
  if (chatIds.length > 0) {
    await db
      .delete(chats)
      .where(
        and(
          inArray(chats.id, chatIds),
          eq(chats.userId, userId),
          eq(chats.kind, "direct")
        )
      )
  }

  revalidatePath("/", "layout")

  return deletedBot
}
