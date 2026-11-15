import { notFound } from "next/navigation"
import { auth } from "@clerk/nextjs/server"

import { getChat } from "@/queries/chats"
import { ChatHeader } from "@/components/chat-header"

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

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
      <ChatHeader chat={chat} />
    </div>
  )
}
