"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { SearchIcon } from "lucide-react"

import { ChatAvatar } from "@/components/chat-avatar"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { getChatDisplayMeta } from "@/components/sidebar/chat-meta"
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
import { Kbd } from "@/components/ui/kbd"
import type { UserChat } from "@/queries/bots"

interface SidebarSearchProps {
  chats: UserChat[]
}

export function SidebarSearch({ chats }: SidebarSearchProps) {
  const router = useRouter()
  const [commandOpen, setCommandOpen] = React.useState(false)

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <>
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
                const {
                  isGroup,
                  bots,
                  displayName,
                  avatarSeed,
                  formattedTime,
                } = getChatDisplayMeta(chat)

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
                    {isGroup ? (
                      <GroupChatAvatar
                        bots={bots}
                        className="size-8 shrink-0"
                      />
                    ) : (
                      <ChatAvatar
                        seed={avatarSeed}
                        className="size-8 shrink-0"
                      />
                    )}
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
    </>
  )
}
