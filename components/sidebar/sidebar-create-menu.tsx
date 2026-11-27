"use client"

import * as React from "react"
import { PlusIcon, UsersIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useBillingGate } from "@/hooks/use-billing-toast"
import type { UserBot } from "@/queries/bots"

interface SidebarCreateMenuProps {
  bots: UserBot[]
}

export function SidebarCreateMenu({ bots }: SidebarCreateMenuProps) {
  const { ensurePaidPlan } = useBillingGate()
  const [botDialogOpen, setBotDialogOpen] = React.useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = React.useState(false)

  return (
    <>
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
              <DropdownMenuItem
                onClick={() => {
                  if (
                    ensurePaidPlan(
                      "A paid plan is required to create bots and sandboxes."
                    )
                  ) {
                    setBotDialogOpen(true)
                  }
                }}
              >
                <PlusIcon />
                <span>Create new bot</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (
                    ensurePaidPlan(
                      "A paid plan is required to create group chats with bots."
                    )
                  ) {
                    setGroupDialogOpen(true)
                  }
                }}
              >
                <UsersIcon />
                <span>Create group chat</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <BotDialog open={botDialogOpen} onOpenChange={setBotDialogOpen} />
      <GroupChatDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        bots={bots}
      />
    </>
  )
}
