import { notFound } from "next/navigation"
import { auth } from "@clerk/nextjs/server"

import { getUserBots } from "@/queries/bots"
import { getChat } from "@/queries/chats"
import { ChatHeader } from "@/components/chat-header"
import { ChatView } from "@/components/chat-view"
import { VncPreview } from "@/components/vnc-preview"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{
    chatId: string
  }>
}

export default async function Page({ params }: PageProps) {
  await auth.protect()

  const { chatId } = await params
  const [chat, userBots] = await Promise.all([getChat(chatId), getUserBots()])

  if (!chat) {
    notFound()
  }

  const isGroup = chat.kind === "group"
  const firstBot = chat.members[0]?.bot
  const displayName = chat.name || firstBot?.name || "Untitled Chat"
  const avatarSeed = firstBot?.avatar || firstBot?.id || chat.id
  const bots = chat.members.map((m) => m.bot)

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full w-full min-w-0 min-h-0 flex-1 overflow-hidden"
    >
      <ResizablePanel
        id="chat-main"
        defaultSize="100%"
        className="h-full min-w-0 overflow-hidden"
      >
        <div className="flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden">
          <ChatHeader chat={chat} allBots={userBots} />
          <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden">
            <ChatView
              chatId={chatId}
              name={displayName}
              avatarSeed={avatarSeed}
              isGroup={isGroup}
              bots={bots}
            />
          </div>
        </div>
      </ResizablePanel>
      {!isGroup && <ResizableHandle />}
      {!isGroup && (
        <ResizablePanel
          id="chat-desktop"
          collapsible
          defaultSize="0%"
          minSize="20%"
          maxSize="80%"
          className="h-full min-w-0 overflow-hidden"
        >
          <VncPreview chatId={chatId} botName={displayName} />
        </ResizablePanel>
      )}
    </ResizablePanelGroup>
  )
}
