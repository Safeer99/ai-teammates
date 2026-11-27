import Link from "next/link"
import { Suspense } from "react"
import { PricingTable } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { PAID_PLAN_SLUG } from "@/lib/billing"

async function PricingContent() {
  const { isAuthenticated, has } = await auth()
  const isPro = isAuthenticated ? has({ plan: PAID_PLAN_SLUG }) : false

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/" />}
        >
          <ArrowLeftIcon className="mr-1.5 size-4" />
          Back to app
        </Button>
      </div>

      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Choose your plan
        </h1>
        <p className="text-sm text-muted-foreground">
          {isPro
            ? "You are currently on a paid plan with full access to bots and sandboxes."
            : "Upgrade to a paid plan to create and use bots and cloud sandboxes."}
        </p>
      </div>

      <PricingTable newSubscriptionRedirectUrl="/" />
    </div>
  )
}

export default function PricingPage() {
  return (
    <div className="h-svh w-full overflow-y-auto bg-background">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        }
      >
        <PricingContent />
      </Suspense>
    </div>
  )
}
