import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function Header() {
  return (
    <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-backdrop-filter:bg-background/60">
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
        <span>AI Teammates</span>
      </Link>
      <div className="flex items-center gap-3">
        <Suspense
          fallback={
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          }
        >
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm">Sign up</Button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </Suspense>
      </div>
    </header>
  )
}
