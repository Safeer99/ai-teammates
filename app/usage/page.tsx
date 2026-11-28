import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { auth } from "@clerk/nextjs/server"
import {
  ArrowLeftIcon,
  BotIcon,
  CpuIcon,
  SparklesIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { UsageResetCountdown } from "@/components/usage-reset-countdown"
import { PAID_PLAN_SLUG } from "@/lib/billing"
import { formatDurationSeconds, formatMicrodollars } from "@/lib/usage"
import { getUsageSummary } from "@/lib/usage-server"

export const dynamic = "force-dynamic"

function calcPercent(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

async function UsageContent() {
  const { isAuthenticated, userId, has } = await auth()

  if (!isAuthenticated || !userId) {
    redirect("/sign-in")
  }

  const isPro = has({ plan: PAID_PLAN_SLUG })
  const summary = await getUsageSummary(userId)

  const aiPct = calcPercent(
    summary.ai.costMicrodollars,
    summary.ai.limitMicrodollars
  )
  const sandboxPct = calcPercent(
    summary.sandbox.costMicrodollars,
    summary.sandbox.limitMicrodollars
  )
  const botsPct = calcPercent(
    summary.sandbox.activeCount,
    summary.sandbox.maxCount
  )

  const totalUsedMicrodollars =
    summary.ai.costMicrodollars + summary.sandbox.costMicrodollars
  const totalLimitMicrodollars =
    summary.ai.limitMicrodollars + summary.sandbox.limitMicrodollars

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/" />}
        >
          <ArrowLeftIcon className="mr-1.5 size-4" />
          Back to app
        </Button>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/pricing" />}
        >
          Manage plan
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-semibold tracking-tight">Usage</h1>
            <Badge variant={isPro ? "default" : "secondary"}>
              {isPro ? "Pro Plan" : "Free Plan"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your AI token and Daytona sandbox usage for the current
            subscription period.
          </p>
        </div>
        <div className="flex flex-col items-start gap-0.5 text-sm sm:items-end">
          <UsageResetCountdown
            periodEndIso={summary.period.periodEnd.toISOString()}
          />
          <span className="text-xs text-muted-foreground">
            Period:{" "}
            {summary.period.periodStart.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}{" "}
            –{" "}
            {summary.period.periodEnd.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <SparklesIcon className="size-3.5" />
              AI Provider Tokens
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMicrodollars(summary.ai.costMicrodollars)}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {formatMicrodollars(summary.ai.limitMicrodollars)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Progress value={aiPct}>
              <ProgressLabel className="text-xs text-muted-foreground">
                Allowance used
              </ProgressLabel>
              <ProgressValue className="text-xs" />
            </Progress>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground tabular-nums">
              <div className="flex justify-between">
                <span>Input tokens</span>
                <span>{summary.ai.inputTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cached input</span>
                <span>{summary.ai.cachedInputTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Output tokens</span>
                <span>{summary.ai.outputTokens.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <CpuIcon className="size-3.5" />
              Daytona Sandbox Compute
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMicrodollars(summary.sandbox.costMicrodollars)}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {formatMicrodollars(summary.sandbox.limitMicrodollars)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Progress value={sandboxPct}>
              <ProgressLabel className="text-xs text-muted-foreground">
                Allowance used
              </ProgressLabel>
              <ProgressValue className="text-xs" />
            </Progress>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground tabular-nums">
              <div className="flex justify-between">
                <span>Billed compute</span>
                <span>{formatDurationSeconds(summary.sandbox.seconds)}</span>
              </div>
              <div className="flex justify-between">
                <span>Idle auto-stop</span>
                <span>15m</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <BotIcon className="size-3.5" />
              Active Bots & Sandboxes
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {summary.sandbox.activeCount}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {summary.sandbox.maxCount}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Progress value={botsPct}>
              <ProgressLabel className="text-xs text-muted-foreground">
                Capacity used
              </ProgressLabel>
              <ProgressValue className="text-xs" />
            </Progress>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground tabular-nums">
              <div className="flex justify-between">
                <span>Combined period spend</span>
                <span>
                  {formatMicrodollars(totalUsedMicrodollars)} /{" "}
                  {formatMicrodollars(totalLimitMicrodollars)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage Ledger</CardTitle>
          <CardDescription>
            Recent metered events recorded during the current subscription
            period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summary.recentEntries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No usage events recorded in this billing period yet.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {summary.recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[11px]">
                        {entry.kind === "ai_tokens"
                          ? "AI Tokens"
                          : "Sandbox Compute"}
                      </Badge>
                      <span className="truncate font-medium">
                        {entry.description || entry.kind}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {entry.createdAt.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {entry.kind === "ai_tokens"
                        ? ` · ${(entry.inputTokens + entry.outputTokens).toLocaleString()} tokens`
                        : ` · ${formatDurationSeconds(entry.sandboxSeconds)}`}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-medium tabular-nums">
                    {formatMicrodollars(entry.costMicrodollars)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function UsagePage() {
  return (
    <div className="h-svh w-full overflow-y-auto bg-background">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        }
      >
        <UsageContent />
      </Suspense>
    </div>
  )
}
