"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"

import { ChatAvatar } from "@/components/chat-avatar"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { getChatDisplayMeta } from "@/components/sidebar/chat-meta"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useIsHydrated } from "@/hooks/use-is-hydrated"
import type { UserChat } from "@/queries/bots"

interface SidebarChatListProps {
  chats: UserChat[]
}

export function SidebarChatList({ chats }: SidebarChatListProps) {
  const pathname = usePathname()
  const params = useParams()
  const isHydrated = useIsHydrated()
  const activeItemRef = React.useRef<HTMLLIElement | null>(null)

  const activeChatId =
    (params?.chatId as string | undefined) ||
    (pathname?.startsWith("/chats/") ? pathname.split("/")[2] : undefined)

  React.useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: "nearest" })
    }
  }, [activeChatId])

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:p-2">
      <SidebarGroupContent>
        <SidebarMenu className="gap-2 group-data-[collapsible=icon]:gap-2">
          {chats.map((chat) => {
            const { isGroup, bots, displayName, avatarSeed, formattedTime } =
              getChatDisplayMeta(chat)
            const isActive = chat.id === activeChatId

            return (
              <SidebarMenuItem
                key={chat.id}
                ref={isActive ? activeItemRef : undefined}
              >
                <SidebarMenuButton
                  size="lg"
                  tooltip={displayName}
                  isActive={isActive}
                  className="h-auto p-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:p-0!"
                  render={
                    <Link
                      href={`/chats/${chat.id}`}
                      aria-current={isActive ? "page" : undefined}
                    />
                  }
                >
                  {isGroup ? (
                    <GroupChatAvatar
                      bots={bots}
                      className="size-8 shrink-0 group-data-[collapsible=icon]:size-6"
                    />
                  ) : (
                    <ChatAvatar
                      seed={avatarSeed}
                      className="size-8 shrink-0 group-data-[collapsible=icon]:size-6"
                    />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-sm font-semibold text-sidebar-foreground">
                        {displayName}
                      </span>
                      {isHydrated && formattedTime && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formattedTime}
                        </span>
                      )}
                    </div>
                    {chat.lastMessagePreview && (
                      <span className="truncate text-xs text-muted-foreground">
                        {chat.lastMessagePreview}
                      </span>
                    )}
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
