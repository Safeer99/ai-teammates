import { formatDistanceToNowStrict } from "date-fns"

import type { UserChat } from "@/queries/bots"

export interface ChatDisplayMeta {
  isGroup: boolean
  bots: UserChat["members"][number]["bot"][]
  displayName: string
  avatarSeed: string
  formattedTime: string
}

/**
 * Derives display metadata (name, avatar seed, group flag, and relative timestamp)
 * for a chat entry in the sidebar and search dialog.
 */
export function getChatDisplayMeta(chat: UserChat): ChatDisplayMeta {
  const isGroup = chat.kind === "group"
  const bots = chat.members.map((member) => member.bot)
  const firstBot = bots[0]
  const displayName = chat.name || firstBot?.name || "Untitled Chat"
  const avatarSeed = firstBot?.avatar || firstBot?.id || chat.id

  let formattedTime = ""
  if (chat.lastMessageAt) {
    try {
      formattedTime = formatDistanceToNowStrict(new Date(chat.lastMessageAt))
    } catch {
      formattedTime = ""
    }
  }

  return {
    isGroup,
    bots,
    displayName,
    avatarSeed,
    formattedTime,
  }
}
