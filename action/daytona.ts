"use server"

import { auth } from "@clerk/nextjs/server"
import { db } from "@/db"
import { getDaytonaClient } from "@/lib/daytona"

export interface VncUrlResult {
  url: string | null
  botName: string
  sandboxId?: string | null
  error?: string | null
}

export async function getChatVncUrl(chatId: string): Promise<VncUrlResult> {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  const chat = await db.query.chats.findFirst({
    where: (chats, { and, eq }) =>
      and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: {
      members: {
        with: {
          bot: true,
        },
      },
    },
  })

  if (!chat) {
    throw new Error("Chat not found")
  }

  const bot = chat.members[0]?.bot
  const botName = chat.name || bot?.name || "Assistant"

  if (!bot?.sandboxId) {
    return {
      url: null,
      botName,
      sandboxId: null,
      error: "No sandbox environment associated with this chat.",
    }
  }

  try {
    const daytona = getDaytonaClient()
    const sandbox = await daytona.get(bot.sandboxId)

    if (sandbox.state !== "started") {
      await sandbox.start()
    }

    if (sandbox.computerUse) {
      try {
        const status = await sandbox.computerUse.getStatus()
        if (status?.status !== "running") {
          await sandbox.computerUse.start()
        }
      } catch {
        try {
          await sandbox.computerUse.start()
        } catch (e) {
          console.warn("Could not start computerUse on sandbox:", e)
        }
      }
    }

    // noVNC listens on port 6080 in Daytona sandbox
    const signed = await sandbox.getSignedPreviewUrl(6080, 86400)
    const baseUrl = signed.url.endsWith("/")
      ? signed.url.slice(0, -1)
      : signed.url
    const vncUrl = `${baseUrl}/vnc.html?autoconnect=true&resize=scale&reconnect=true`

    return {
      url: vncUrl,
      botName,
      sandboxId: bot.sandboxId,
      error: null,
    }
  } catch (error) {
    console.error("Failed to generate Daytona VNC preview URL:", error)
    return {
      url: null,
      botName,
      sandboxId: bot.sandboxId,
      error:
        error instanceof Error
          ? error.message
          : "Failed to connect to Daytona VNC sandbox",
    }
  }
}
