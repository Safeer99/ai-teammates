"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, usePathname, useRouter } from "next/navigation"
import { formatDistanceToNowStrict } from "date-fns"
import { PlusIcon, SearchIcon, UsersIcon } from "lucide-react"
import { UserButton } from "@clerk/nextjs"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
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
  SidebarRail,
} from "@/components/ui/sidebar"
import type { UserChat } from "@/queries/bots"

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  chats?: UserChat[]
}

export function AppSidebar({ chats = [], ...props }: AppSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const [botDialogOpen, setBotDialogOpen] = React.useState(false)
  const [commandOpen, setCommandOpen] = React.useState(false)
  const activeItemRef = React.useRef<HTMLLIElement | null>(null)

  const activeChatId =
    (params?.chatId as string | undefined) ||
    (pathname?.startsWith("/chats/") ? pathname.split("/")[2] : undefined)

  React.useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: "nearest" })
    }
  }, [activeChatId])

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="flex flex-col gap-2 p-2">
        <div className="flex w-full items-center justify-end group-data-[collapsible=icon]:justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="size-8" />}
            >
              <PlusIcon className="size-4" />
              <span className="sr-only">Create</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="bottom"
              sideOffset={4}
              className="w-48"
            >
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
        </div>
        <div className="w-full group-data-[collapsible=icon]:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCommandOpen(true)}
            className="h-8 w-full min-w-0 justify-between rounded-lg border-input bg-transparent px-2.5 py-1 text-sm font-normal text-muted-foreground shadow-none hover:bg-muted hover:text-foreground dark:bg-input/30 dark:hover:bg-input/50"
          >
            <div className="flex items-center gap-2">
              <SearchIcon className="size-4 shrink-0" />
              <span>Search</span>
            </div>
            <Kbd>⌘K</Kbd>
          </Button>
        </div>
        <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setCommandOpen(true)}
            className="size-8"
          >
            <SearchIcon className="size-4" />
            <span className="sr-only">Search chats</span>
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="group-data-[collapsible=icon]:p-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-2 group-data-[collapsible=icon]:gap-2">
              {chats.map((chat) => {
                const firstBot = chat.members[0]?.bot
                const displayName =
                  chat.name || firstBot?.name || "Untitled Chat"
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
                      <ChatAvatar
                        seed={avatarSeed}
                        className="size-8 shrink-0 group-data-[collapsible=icon]:size-6"
                      />
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
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<div />}
              className="h-auto p-0 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:p-0! hover:bg-transparent"
            >
              <UserButton
                showName
                appearance={{
                  elements: {
                    rootBox:
                      "flex! w-full! group-data-[collapsible=icon]:justify-center!",
                    userButtonTrigger:
                      "flex! h-8! w-full! items-center! justify-start! gap-2! overflow-hidden! rounded-md! p-2! text-left! text-sm! text-sidebar-foreground! shadow-none! ring-sidebar-ring! outline-hidden! hover:bg-sidebar-accent! hover:text-sidebar-accent-foreground! focus-visible:ring-2! active:bg-sidebar-accent! active:text-sidebar-accent-foreground! aria-expanded:bg-sidebar-accent! aria-expanded:text-sidebar-accent-foreground! group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center!",
                    userButtonBox:
                      "min-w-0! flex-1! gap-2! group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:flex-none! group-data-[collapsible=icon]:justify-center!",
                    userButtonAvatarBox: "order-first! size-6! shrink-0!",
                    userButtonOuterIdentifier:
                      "truncate! ps-0! text-left! text-sm! font-normal! text-inherit! group-data-[collapsible=icon]:hidden!",
                  },
                }}
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
      <BotDialog open={botDialogOpen} onOpenChange={setBotDialogOpen} />
      <CommandDialog
        open={commandOpen}
        onOpenChange={setCommandOpen}
        title="Search chats"
        description="Search your conversations and bots"
      >
        <Command>
          <CommandInput placeholder="Search chats..." />
          <CommandList>
            <CommandEmpty>No chats found.</CommandEmpty>
            <CommandGroup heading="Chats">
              {chats.map((chat) => {
                const firstBot = chat.members[0]?.bot
                const displayName =
                  chat.name || firstBot?.name || "Untitled Chat"
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
                  <CommandItem
                    key={chat.id}
                    value={`${displayName} ${chat.lastMessagePreview ?? ""}`}
                    onSelect={() => {
                      setCommandOpen(false)
                      router.push(`/chats/${chat.id}`)
                    }}
                    className="flex cursor-pointer items-center gap-2 p-2"
                  >
                    <ChatAvatar seed={avatarSeed} className="size-8 shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-sm font-semibold text-foreground">
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
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </Sidebar>
  )
}
