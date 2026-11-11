import { auth } from "@clerk/nextjs/server"
import { PlusIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export default async function Page() {
  await auth.protect()

  return (
    <Empty className="min-h-[calc(100vh-3.5rem)]">
      <EmptyHeader>
        <EmptyMedia>
          <Avatar size="lg" className="size-10">
            <AvatarImage src="/favicon.ico" alt="Bot avatar" />
            <AvatarFallback>🤖</AvatarFallback>
          </Avatar>
        </EmptyMedia>
        <EmptyTitle className="text-base font-medium">
          Meet your first bot
        </EmptyTitle>
        <EmptyDescription>
          Every bot gets its own personality, memory, and face. Spin one up and
          start the conversation.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="secondary">
          <PlusIcon data-icon="inline-start" />
          Create a new bot
        </Button>
      </EmptyContent>
    </Empty>
  )
}
