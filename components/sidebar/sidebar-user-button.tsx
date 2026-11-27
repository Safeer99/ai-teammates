"use client"

import { UserButton } from "@clerk/nextjs"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useIsHydrated } from "@/hooks/use-is-hydrated"

export function SidebarUserButton() {
  const isHydrated = useIsHydrated()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          render={<div />}
          className="h-auto p-0 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:p-0! hover:bg-transparent"
        >
          {isHydrated ? (
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
          ) : (
            <div className="flex h-8 w-full items-center gap-2 rounded-md p-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:p-0!">
              <div className="size-6 shrink-0 animate-pulse rounded-full bg-sidebar-accent/50" />
              <div className="h-3.5 flex-1 animate-pulse rounded bg-sidebar-accent/50 group-data-[collapsible=icon]:hidden" />
            </div>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
