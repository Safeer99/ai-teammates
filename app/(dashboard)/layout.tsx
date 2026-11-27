import { cookies } from "next/headers"

import { AppSidebar } from "@/components/sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getUserBots, getUserChats } from "@/queries/bots"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const sidebarCookie = cookieStore.get("sidebar_state")?.value
  const defaultOpen = sidebarCookie ? sidebarCookie === "true" : true

  const [chats, bots] = await Promise.all([getUserChats(), getUserBots()])

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="h-svh max-h-svh overflow-hidden"
    >
      <AppSidebar chats={chats} bots={bots} />
      <SidebarInset className="h-svh max-h-svh min-w-0 overflow-hidden">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
