"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"

import { PAID_PLAN_SLUG, PLAN_REQUIRED_MESSAGE } from "@/lib/billing"
import { toast } from "@/components/ui/toast"

export function useBillingGate() {
  const router = useRouter()
  const { has, isLoaded } = useAuth()

  const hasPaidPlan = isLoaded ? Boolean(has?.({ plan: PAID_PLAN_SLUG })) : false

  const showUpgradeToast = React.useCallback(
    (description: string = PLAN_REQUIRED_MESSAGE) => {
      toast.add({
        title: "Paid plan required",
        description,
        type: "error",
        actionProps: {
          children: "View plans",
          onClick: () => {
            router.push("/pricing")
          },
        },
      })
    },
    [router]
  )

  const showUsageLimitToast = React.useCallback(
    (description: string) => {
      toast.add({
        title: "Usage limit reached",
        description,
        type: "error",
        actionProps: {
          children: "View usage",
          onClick: () => {
            router.push("/usage")
          },
        },
      })
    },
    [router]
  )

  const ensurePaidPlan = React.useCallback(
    (description?: string) => {
      if (!isLoaded) return false
      if (!hasPaidPlan) {
        showUpgradeToast(description)
        return false
      }
      return true
    },
    [isLoaded, hasPaidPlan, showUpgradeToast]
  )

  return {
    isLoaded,
    hasPaidPlan,
    showUpgradeToast,
    showUsageLimitToast,
    ensurePaidPlan,
  }
}
