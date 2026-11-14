import { cookies } from "next/headers"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { getUserChats } from "@/queries/bots"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const sidebarCookie = cookieStore.get("sidebar_state")?.value
  const defaultOpen = sidebarCookie ? sidebarCookie === "true" : true

  const chats = await getUserChats()

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar chats={chats} />
      {children}
    </SidebarProvider>
  )
}
