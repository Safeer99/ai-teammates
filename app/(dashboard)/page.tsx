import { auth } from "@clerk/nextjs/server"
import { PlusIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

export const dynamic = "force-dynamic"

export default async function Page() {
  await auth.protect()

  const seed = crypto.randomUUID()

  return (
    <Empty className="min-h-[calc(100vh-3.5rem)]">
      <EmptyHeader>
        <ChatAvatar seed={seed} className="mb-2 size-10" />
        <EmptyTitle className="text-base font-medium">
          Meet your first bot
        </EmptyTitle>
        <EmptyDescription>
          Every bot gets its own personality, memory, and face. Spin one up and
          start the conversation.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <BotDialog>
          <Button variant="secondary">
            <PlusIcon data-icon="inline-start" />
            Create a new bot
          </Button>
        </BotDialog>
      </EmptyContent>
    </Empty>
  )
}
