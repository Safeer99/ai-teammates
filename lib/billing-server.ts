import { auth } from "@clerk/nextjs/server"

import {
  PAID_PLAN_SLUG,
  PLAN_REQUIRED_ERROR_CODE,
  PLAN_REQUIRED_MESSAGE,
} from "@/lib/billing"

export async function requireAuthAndPaidPlan() {
  const { isAuthenticated, userId, has } = await auth()

  if (!isAuthenticated || !userId) {
    throw new Error("Unauthorized")
  }

  if (!has({ plan: PAID_PLAN_SLUG })) {
    throw new Error(`${PLAN_REQUIRED_ERROR_CODE}: ${PLAN_REQUIRED_MESSAGE}`)
  }

  return { userId, has }
}

export async function hasPaidPlan(): Promise<boolean> {
  const { isAuthenticated, has } = await auth()
  if (!isAuthenticated) return false
  return has({ plan: PAID_PLAN_SLUG })
}
