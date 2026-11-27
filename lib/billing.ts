export const PAID_PLAN_SLUG = "pro"
export const PLAN_REQUIRED_ERROR_CODE = "PLAN_REQUIRED"
export const PLAN_REQUIRED_MESSAGE =
  "A paid plan is required to use bots and sandboxes."

export function isPlanRequiredError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes(PLAN_REQUIRED_ERROR_CODE) ||
    error.message.includes(PLAN_REQUIRED_MESSAGE)
  )
}
