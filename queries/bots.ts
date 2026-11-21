import { auth } from "@clerk/nextjs/server"
import { db } from "@/db"

export async function getUserChats() {
  const { userId } = await auth()

  if (!userId) {
    return []
  }

  return await db.query.chats.findMany({
    where: (chats, { eq }) => eq(chats.userId, userId),
    orderBy: (chats, { desc }) => [desc(chats.lastMessageAt)],
    with: {
      members: {
        with: {
          bot: true,
        },
      },
    },
  })
}

export async function getUserBots() {
  const { userId } = await auth()

  if (!userId) {
    return []
  }

  return await db.query.bots.findMany({
    where: (bots, { eq }) => eq(bots.userId, userId),
    orderBy: (bots, { desc }) => [desc(bots.createdAt)],
  })
}

export type UserChat = Awaited<ReturnType<typeof getUserChats>>[number]
export type UserBot = Awaited<ReturnType<typeof getUserBots>>[number]
