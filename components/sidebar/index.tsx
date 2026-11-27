"use client"

import * as React from "react"

import { SidebarChatList } from "@/components/sidebar/sidebar-chat-list"
import { SidebarCreateMenu } from "@/components/sidebar/sidebar-create-menu"
import { SidebarSearch } from "@/components/sidebar/sidebar-search"
import { SidebarUserButton } from "@/components/sidebar/sidebar-user-button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import type { UserBot, UserChat } from "@/queries/bots"

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  chats?: UserChat[]
  bots?: UserBot[]
}

export function AppSidebar({
  chats = [],
  bots = [],
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="flex flex-col gap-2 p-2">
        <SidebarCreateMenu bots={bots} />
        <SidebarSearch chats={chats} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarChatList chats={chats} />
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarUserButton />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
