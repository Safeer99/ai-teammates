export const USAGE_LIMIT_ERROR_CODE = "USAGE_LIMIT_EXCEEDED"

/**
 * Monthly allowance caps for the paid plan (in microdollars: 1 USD = 1_000_000).
 * Keeps Daytona sandbox compute and AI provider token costs bounded per billing period.
 */
export const AI_TOKEN_LIMIT_MICRODOLLARS = 2_500_000 // $2.50 / billing period
export const SANDBOX_COMPUTE_LIMIT_MICRODOLLARS = 2_500_000 // $2.50 / billing period
export const MAX_ACTIVE_SANDBOXES = 5

/**
 * Daytona auto-stop interval (in minutes) applied when creating sandboxes
 * so idle sandboxes do not burn compute indefinitely.
 */
export const SANDBOX_AUTO_STOP_MINUTES = 15

/**
 * Minimum billed sandbox session seconds when opening a VNC desktop preview.
 */
export const VNC_SESSION_BILLABLE_SECONDS = 60

/**
 * Minimum billed sandbox seconds when provisioning a new bot sandbox.
 */
export const SANDBOX_PROVISION_BILLABLE_SECONDS = 30

/**
 * Published Gemini Flash-Lite pricing (USD per 1M tokens -> microdollars per token):
 * - Non-cached input: $0.10 / 1M tokens = 0.1 microdollars/token
 * - Cached input:     $0.01 / 1M tokens = 0.01 microdollars/token
 * - Output (+reason): $0.40 / 1M tokens = 0.4 microdollars/token
 */
export const AI_INPUT_MICRODOLLARS_PER_TOKEN = 0.1
export const AI_CACHED_INPUT_MICRODOLLARS_PER_TOKEN = 0.01
export const AI_OUTPUT_MICRODOLLARS_PER_TOKEN = 0.4

/**
 * Published Daytona pay-as-you-go rates (converted to microdollars/sec):
 * - vCPU:    $0.000014   / vCPU-sec = 14 microdollars/vCPU-sec
 * - Memory:  $0.0000045  / GiB-sec  = 4.5 microdollars/GiB-sec
 * - Storage: $0.00000003 / GiB-sec above 5 GiB free = 0.03 microdollars/GiB-sec
 */
export const DAYTONA_VCPU_MICRODOLLARS_PER_SEC = 14
export const DAYTONA_MEMORY_MICRODOLLARS_PER_GIB_SEC = 4.5
export const DAYTONA_DISK_MICRODOLLARS_PER_GIB_SEC = 0.03
export const DAYTONA_FREE_DISK_GIB = 5

export function calculateAiTokenCostMicrodollars({
  inputTokens = 0,
  cachedInputTokens = 0,
  outputTokens = 0,
}: {
  inputTokens?: number
  cachedInputTokens?: number
  outputTokens?: number
}): number {
  const safeInput = Math.max(0, inputTokens)
  const safeCached = Math.min(safeInput, Math.max(0, cachedInputTokens))
  const nonCachedInput = safeInput - safeCached
  const safeOutput = Math.max(0, outputTokens)

  if (safeInput === 0 && safeOutput === 0) return 0

  const raw =
    nonCachedInput * AI_INPUT_MICRODOLLARS_PER_TOKEN +
    safeCached * AI_CACHED_INPUT_MICRODOLLARS_PER_TOKEN +
    safeOutput * AI_OUTPUT_MICRODOLLARS_PER_TOKEN

  return Math.max(1, Math.round(raw))
}

export function calculateSandboxCostMicrodollars({
  seconds,
  cpu = 1,
  memoryGiB = 1,
  diskGiB = 5,
}: {
  seconds: number
  cpu?: number
  memoryGiB?: number
  diskGiB?: number
}): number {
  const safeSeconds = Math.max(0, seconds)
  if (safeSeconds === 0) return 0

  const safeCpu = Math.max(1, cpu)
  const safeMemory = Math.max(1, memoryGiB)
  const billableDisk = Math.max(0, diskGiB - DAYTONA_FREE_DISK_GIB)

  const perSecond =
    safeCpu * DAYTONA_VCPU_MICRODOLLARS_PER_SEC +
    safeMemory * DAYTONA_MEMORY_MICRODOLLARS_PER_GIB_SEC +
    billableDisk * DAYTONA_DISK_MICRODOLLARS_PER_GIB_SEC

  return Math.max(1, Math.round(safeSeconds * perSecond))
}

export function formatMicrodollars(microdollars: number): string {
  const dollars = microdollars / 1_000_000
  if (dollars > 0 && dollars < 0.01) {
    return `$${dollars.toFixed(4)}`
  }
  return `$${dollars.toFixed(2)}`
}

export function formatDurationSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function isUsageLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.message.includes(USAGE_LIMIT_ERROR_CODE)
}
