"use client"

import * as React from "react"
import Link from "next/link"
import { formatDistanceToNowStrict } from "date-fns"
import { PlusIcon, UsersIcon } from "lucide-react"
import { UserButton } from "@clerk/nextjs"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { UserChat } from "@/queries/bots"

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  chats?: UserChat[]
}

export function AppSidebar({ chats = [], ...props }: AppSidebarProps) {
  const [botDialogOpen, setBotDialogOpen] = React.useState(false)

  return (
    <Sidebar {...props}>
      <SidebarHeader className="flex flex-row items-center justify-end group-data-[collapsible=icon]:justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="size-8" />
            }
          >
            <PlusIcon />
            <span className="sr-only">Create</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" sideOffset={4} className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setBotDialogOpen(true)}>
                <PlusIcon />
                <span>Create new bot</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <UsersIcon />
                <span>Create group chat</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {chats.map((chat) => {
                const firstBot = chat.members[0]?.bot
                const displayName = chat.name || firstBot?.name || "Untitled Chat"
                const avatarSeed = firstBot?.avatar || firstBot?.id || chat.id
                let formattedTime = ""
                if (chat.lastMessageAt) {
                  try {
                    formattedTime = formatDistanceToNowStrict(
                      new Date(chat.lastMessageAt)
                    )
                  } catch {
                    formattedTime = ""
                  }
                }

                return (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      size="lg"
                      className="h-auto p-2"
                      render={<Link href={`/chat/${chat.id}`} />}
                    >
                      <ChatAvatar seed={avatarSeed} className="size-8 shrink-0" />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-sm font-semibold text-sidebar-foreground">
                            {displayName}
                          </span>
                          {formattedTime && (
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
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<div />}
              className="h-auto p-0 hover:bg-transparent"
            >
              <UserButton
                showName
                appearance={{
                  elements: {
                    rootBox: "flex! w-full!",
                    userButtonTrigger:
                      "flex! h-8! w-full! items-center! justify-start! gap-2! overflow-hidden! rounded-md! p-2! text-left! text-sm! text-sidebar-foreground! shadow-none! ring-sidebar-ring! outline-hidden! hover:bg-sidebar-accent! hover:text-sidebar-accent-foreground! focus-visible:ring-2! active:bg-sidebar-accent! active:text-sidebar-accent-foreground! aria-expanded:bg-sidebar-accent! aria-expanded:text-sidebar-accent-foreground!",
                    userButtonBox: "min-w-0! flex-1! gap-2!",
                    userButtonAvatarBox: "order-first! size-6! shrink-0!",
                    userButtonOuterIdentifier:
                      "truncate! ps-0! text-left! text-sm! font-normal! text-inherit!",
                  },
                }}
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <BotDialog open={botDialogOpen} onOpenChange={setBotDialogOpen} />
    </Sidebar>
  )
}
