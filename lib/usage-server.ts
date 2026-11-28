import { clerkClient } from "@clerk/nextjs/server"
import { and, desc, eq, gte, lt, sql } from "drizzle-orm"

import { db } from "@/db"
import { bots, subscriptionPeriods, usageLedger } from "@/db/schema"
import {
  AI_TOKEN_LIMIT_MICRODOLLARS,
  calculateAiTokenCostMicrodollars,
  calculateSandboxCostMicrodollars,
  MAX_ACTIVE_SANDBOXES,
  SANDBOX_COMPUTE_LIMIT_MICRODOLLARS,
  USAGE_LIMIT_ERROR_CODE,
} from "@/lib/usage"

export interface BillingPeriodWindow {
  periodStart: Date
  periodEnd: Date
  planSlug: string | null
  status: string | null
  source: "clerk" | "cached" | "calendar_fallback"
}

function getCalendarMonthWindow(now = new Date()): {
  periodStart: Date
  periodEnd: Date
} {
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  )
  const periodEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)
  )
  return { periodStart, periodEnd }
}

export async function upsertSubscriptionPeriod({
  userId,
  subscriptionId,
  planSlug,
  status,
  periodStart,
  periodEnd,
}: {
  userId: string
  subscriptionId?: string | null
  planSlug?: string | null
  status?: string | null
  periodStart: Date
  periodEnd: Date
}) {
  await db
    .insert(subscriptionPeriods)
    .values({
      userId,
      subscriptionId: subscriptionId ?? null,
      planSlug: planSlug ?? null,
      status: status ?? null,
      periodStart,
      periodEnd,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: subscriptionPeriods.userId,
      set: {
        subscriptionId: subscriptionId ?? null,
        planSlug: planSlug ?? null,
        status: status ?? null,
        periodStart,
        periodEnd,
        updatedAt: new Date(),
      },
    })
}

export async function getCurrentBillingPeriod(
  userId: string
): Promise<BillingPeriodWindow> {
  const now = new Date()

  const cached = await db.query.subscriptionPeriods.findFirst({
    where: eq(subscriptionPeriods.userId, userId),
  })

  if (cached && cached.periodEnd > now) {
    return {
      periodStart: cached.periodStart,
      periodEnd: cached.periodEnd,
      planSlug: cached.planSlug,
      status: cached.status,
      source: "cached",
    }
  }

  try {
    const client = await clerkClient()
    const subscription = await client.billing.getUserBillingSubscription(userId)
    const activeItem =
      subscription.subscriptionItems.find(
        (item) => item.status === "active" && item.periodEnd
      ) ?? subscription.subscriptionItems[0]

    if (activeItem?.periodStart && activeItem?.periodEnd) {
      const periodStart = new Date(activeItem.periodStart)
      const periodEnd = new Date(activeItem.periodEnd)
      const planSlug = activeItem.plan?.slug ?? null
      const status = activeItem.status ?? subscription.status ?? null

      await upsertSubscriptionPeriod({
        userId,
        subscriptionId: subscription.id,
        planSlug,
        status,
        periodStart,
        periodEnd,
      })

      return {
        periodStart,
        periodEnd,
        planSlug,
        status,
        source: "clerk",
      }
    }
  } catch (error) {
    // Expected in accountless/unlinked dev or when user has no Clerk subscription object yet
    console.debug("Falling back to calendar billing window:", error)
  }

  const fallback = getCalendarMonthWindow(now)
  return {
    periodStart: fallback.periodStart,
    periodEnd: fallback.periodEnd,
    planSlug: null,
    status: null,
    source: "calendar_fallback",
  }
}

export async function getUsageSummary(userId: string) {
  const period = await getCurrentBillingPeriod(userId)

  const [totalsRows, botCountRows, recentEntries] = await Promise.all([
    db
      .select({
        kind: usageLedger.kind,
        costMicrodollars: sql<number>`coalesce(sum(${usageLedger.costMicrodollars}), 0)::int`,
        inputTokens: sql<number>`coalesce(sum(${usageLedger.inputTokens}), 0)::int`,
        cachedInputTokens: sql<number>`coalesce(sum(${usageLedger.cachedInputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${usageLedger.outputTokens}), 0)::int`,
        sandboxSeconds: sql<number>`coalesce(sum(${usageLedger.sandboxSeconds}), 0)::int`,
      })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.userId, userId),
          gte(usageLedger.createdAt, period.periodStart),
          lt(usageLedger.createdAt, period.periodEnd)
        )
      )
      .groupBy(usageLedger.kind),
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(bots)
      .where(eq(bots.userId, userId)),
    db
      .select()
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.userId, userId),
          gte(usageLedger.createdAt, period.periodStart),
          lt(usageLedger.createdAt, period.periodEnd)
        )
      )
      .orderBy(desc(usageLedger.createdAt))
      .limit(20),
  ])

  const aiRow = totalsRows.find((r) => r.kind === "ai_tokens")
  const sandboxRow = totalsRows.find((r) => r.kind === "sandbox_compute")

  const aiCostMicrodollars = aiRow?.costMicrodollars ?? 0
  const sandboxCostMicrodollars = sandboxRow?.costMicrodollars ?? 0
  const activeSandboxes = botCountRows[0]?.count ?? 0

  return {
    period,
    ai: {
      costMicrodollars: aiCostMicrodollars,
      limitMicrodollars: AI_TOKEN_LIMIT_MICRODOLLARS,
      inputTokens: aiRow?.inputTokens ?? 0,
      cachedInputTokens: aiRow?.cachedInputTokens ?? 0,
      outputTokens: aiRow?.outputTokens ?? 0,
    },
    sandbox: {
      costMicrodollars: sandboxCostMicrodollars,
      limitMicrodollars: SANDBOX_COMPUTE_LIMIT_MICRODOLLARS,
      seconds: sandboxRow?.sandboxSeconds ?? 0,
      activeCount: activeSandboxes,
      maxCount: MAX_ACTIVE_SANDBOXES,
    },
    recentEntries,
  }
}

export async function assertWithinAiLimit(userId: string) {
  const summary = await getUsageSummary(userId)
  if (summary.ai.costMicrodollars >= summary.ai.limitMicrodollars) {
    throw new Error(
      `${USAGE_LIMIT_ERROR_CODE}: Monthly AI token allowance reached. Usage resets at ${summary.period.periodEnd.toISOString()}.`
    )
  }
}

export async function assertWithinSandboxLimit(
  userId: string,
  { checkMaxCount = false }: { checkMaxCount?: boolean } = {}
) {
  const summary = await getUsageSummary(userId)
  if (checkMaxCount && summary.sandbox.activeCount >= summary.sandbox.maxCount) {
    throw new Error(
      `${USAGE_LIMIT_ERROR_CODE}: Maximum of ${summary.sandbox.maxCount} active bots/sandboxes reached on your current plan.`
    )
  }
  if (summary.sandbox.costMicrodollars >= summary.sandbox.limitMicrodollars) {
    throw new Error(
      `${USAGE_LIMIT_ERROR_CODE}: Monthly Daytona sandbox compute allowance reached. Usage resets at ${summary.period.periodEnd.toISOString()}.`
    )
  }
}

export async function recordAiTokenUsage({
  userId,
  botId,
  chatId,
  model,
  inputTokens,
  cachedInputTokens,
  outputTokens,
  description,
}: {
  userId: string
  botId?: string | null
  chatId?: string | null
  model?: string | null
  inputTokens: number
  cachedInputTokens?: number
  outputTokens: number
  description?: string | null
}) {
  const costMicrodollars = calculateAiTokenCostMicrodollars({
    inputTokens,
    cachedInputTokens,
    outputTokens,
  })
  if (costMicrodollars <= 0) return

  const period = await getCurrentBillingPeriod(userId)
  await db.insert(usageLedger).values({
    userId,
    kind: "ai_tokens",
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    botId: botId ?? null,
    chatId: chatId ?? null,
    model: model ?? null,
    inputTokens: Math.max(0, inputTokens),
    cachedInputTokens: Math.max(0, cachedInputTokens ?? 0),
    outputTokens: Math.max(0, outputTokens),
    sandboxSeconds: 0,
    costMicrodollars,
    description: description ?? "AI chat turn",
  })
}

export async function recordSandboxComputeUsage({
  userId,
  botId,
  chatId,
  sandboxId,
  seconds,
  cpu,
  memoryGiB,
  diskGiB,
  description,
}: {
  userId: string
  botId?: string | null
  chatId?: string | null
  sandboxId?: string | null
  seconds: number
  cpu?: number
  memoryGiB?: number
  diskGiB?: number
  description?: string | null
}) {
  const costMicrodollars = calculateSandboxCostMicrodollars({
    seconds,
    cpu,
    memoryGiB,
    diskGiB,
  })
  if (costMicrodollars <= 0) return

  const period = await getCurrentBillingPeriod(userId)
  await db.insert(usageLedger).values({
    userId,
    kind: "sandbox_compute",
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    botId: botId ?? null,
    chatId: chatId ?? null,
    sandboxId: sandboxId ?? null,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    sandboxSeconds: Math.max(1, Math.round(seconds)),
    costMicrodollars,
    description: description ?? "Daytona sandbox compute",
  })
}
