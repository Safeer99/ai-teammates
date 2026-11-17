import { notFound } from "next/navigation"
import { auth } from "@clerk/nextjs/server"

import { getChat } from "@/queries/chats"
import { ChatHeader } from "@/components/chat-header"
import { ChatView } from "@/components/chat-view"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{
    chatId: string
  }>
}

export default async function Page({ params }: PageProps) {
  await auth.protect()

  const { chatId } = await params
  const chat = await getChat(chatId)

  if (!chat) {
    notFound()
  }

  const firstBot = chat.members[0]?.bot
  const displayName = chat.name || firstBot?.name || "Untitled Chat"
  const avatarSeed = firstBot?.avatar || firstBot?.id || chat.id

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
      <ChatHeader chat={chat} />
      <ChatView chatId={chatId} name={displayName} avatarSeed={avatarSeed} />
    </div>
  )
}
