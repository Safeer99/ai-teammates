"use client"

import type * as React from "react"
import { UserButton } from "@clerk/nextjs"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader />
      <SidebarContent />
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
    </Sidebar>
  )
}
