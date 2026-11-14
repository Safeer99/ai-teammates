"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"

import { db } from "@/db"
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

  const botId = nanoid()
  const chatId = nanoid()

  const validatedBot = insertBotSchema.parse({
    ...data,
    id: botId,
    avatar: data.avatar || nanoid(),
    userId,
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

  const [botRows, chatRows, memberRows] = await db.batch([
    db.insert(bots).values(validatedBot).returning(),
    db.insert(chats).values(validatedChat).returning(),
    db.insert(chatMembers).values(validatedMember).returning(),
  ])

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
