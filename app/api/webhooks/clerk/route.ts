import { verifyWebhook } from "@clerk/nextjs/webhooks"
import { NextRequest } from "next/server"

import { upsertSubscriptionPeriod } from "@/lib/usage-server"

export async function POST(req: NextRequest) {
  let evt
  try {
    evt = await verifyWebhook(req)
  } catch (error) {
    console.error("Clerk webhook verification failed:", error)
    return new Response("Verification failed", { status: 400 })
  }

  if (
    evt.type === "subscription.created" ||
    evt.type === "subscription.active" ||
    evt.type === "subscription.updated"
  ) {
    const { id, payer, items, status } = evt.data
    const userId = payer?.user_id
    const activeItem =
      items?.find((item) => item.status === "active" && item.period_end) ??
      items?.[0]

    if (userId && activeItem?.period_start && activeItem?.period_end) {
      await upsertSubscriptionPeriod({
        userId,
        subscriptionId: id,
        planSlug: activeItem.plan?.slug ?? null,
        status: status ?? null,
        periodStart: new Date(activeItem.period_start),
        periodEnd: new Date(activeItem.period_end),
      })
    }
  }

  if (
    evt.type === "subscriptionItem.active" ||
    evt.type === "subscriptionItem.updated" ||
    evt.type === "subscriptionItem.canceled"
  ) {
    const { payer, plan, status, period_start, period_end } = evt.data
    const userId = payer?.user_id

    if (userId && period_start && period_end) {
      await upsertSubscriptionPeriod({
        userId,
        planSlug: plan?.slug ?? null,
        status: status ?? null,
        periodStart: new Date(period_start),
        periodEnd: new Date(period_end),
      })
    }
  }

  return new Response("OK", { status: 200 })
}
