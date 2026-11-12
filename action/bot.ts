"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"
import { db } from "@/db"
import { bots, insertBotSchema } from "@/db/schema"

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

  const validated = insertBotSchema.parse({
    ...data,
    avatar: data.avatar || nanoid(),
    userId,
  })

  const [newBot] = await db.insert(bots).values(validated).returning()

  revalidatePath("/")
  return newBot
}
