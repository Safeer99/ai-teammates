"use client"

import * as React from "react"
import { ArrowRightLeftIcon, MonitorIcon } from "lucide-react"

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import { Badge } from "@/components/ui/badge"
import { ChatAvatar } from "@/components/chat-avatar"
import { Spinner } from "@/components/ui/spinner"
import type { ChatBotItem } from "./chat-view"

export interface ScreenOutput {
  screenshot?: string
  width?: number
  height?: number
  mediaType?: string
  error?: string
}

export interface GenericToolPart {
  type: string
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error"
    | "output-denied"
    | "approval-requested"
    | "approval-responded"
  toolName?: string
  input?: Record<string, unknown>
  output?: unknown
  errorText?: string
}

export function getToolTitle(
  toolName: string,
  input?: Record<string, unknown>
): string {
  switch (toolName) {
    case "recallMemory":
      return "Recall Memory"
    case "updateMemory":
      return "Update Memory"
    case "bash":
      return typeof input?.command === "string"
        ? `$ ${input.command}`
        : "Run Command"
    case "readFile":
      if (
        input?.path === "MEMORY.md" ||
        (typeof input?.path === "string" &&
          input.path.toLowerCase().includes("memory.md"))
      ) {
        return "Recall Memory"
      }
      return typeof input?.path === "string"
        ? `Read ${input.path}`
        : "Read File"
    case "writeFile":
      if (
        input?.path === "MEMORY.md" ||
        (typeof input?.path === "string" &&
          input.path.toLowerCase().includes("memory.md"))
      ) {
        return "Update Memory"
      }
      return typeof input?.path === "string"
        ? `Write ${input.path}`
        : "Write File"
    case "listFiles":
      return typeof input?.path === "string"
        ? `List ${input.path}`
        : "List Files"
    case "mouseClick":
      return input ? `Click (${input.x}, ${input.y})` : "Mouse Click"
    case "mouseMove":
      return input ? `Move to (${input.x}, ${input.y})` : "Mouse Move"
    case "mouseScroll":
      return input
        ? `Scroll ${input.direction} at (${input.x}, ${input.y})`
        : "Mouse Scroll"
    case "keyboardType":
      return typeof input?.text === "string"
        ? `Type "${input.text}"`
        : "Keyboard Type"
    case "keyboardPress":
      return typeof input?.key === "string"
        ? `Press ${Array.isArray(input.modifiers) && input.modifiers.length ? `${input.modifiers.join("+")}+` : ""}${input.key}`
        : "Keyboard Press"
    case "showScreen":
      return "Screen Capture"
    case "handoff":
      return typeof input?.targetBotName === "string"
        ? `Handoff to ${input.targetBotName}`
        : "Handoff to Teammate"
    default:
      return toolName
  }
}

export function HandoffPart({
  part,
  bots,
}: {
  part: GenericToolPart
  bots: ChatBotItem[]
}) {
  const input = part.input as
    { targetBotName?: string; reason?: string } | undefined
  const output = part.output as
    | {
        success?: boolean
        targetBotName?: string
        targetBotJob?: string
        reason?: string
        error?: string
      }
    | undefined
  const targetBotName =
    output?.targetBotName || input?.targetBotName || "Teammate"
  const targetBot = bots.find(
    (b) => b.name.toLowerCase() === targetBotName.toLowerCase()
  )
  const rawReason = output?.reason || input?.reason
  const reason = rawReason
    ? rawReason
        .replace(/MEMORY\.md/gi, "memory")
        .replace(/\b1:1\s+(chat|conversation)s?\b/gi, "past conversations")
    : undefined
  const isLoading =
    part.state === "input-available" || part.state === "input-streaming"

  return (
    <div className="w-full rounded-2xl border border-border/40 bg-card/60 p-4 shadow-xs">
      <div className="flex items-start gap-3.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
          <ArrowRightLeftIcon className="size-3.5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                Handoff to {targetBotName}
              </span>
              {(targetBot?.job || output?.targetBotJob) && (
                <Badge
                  variant="secondary"
                  className="rounded-full px-2 py-0 text-[11px] font-normal text-muted-foreground"
                >
                  {targetBot?.job || output?.targetBotJob}
                </Badge>
              )}
              {isLoading && (
                <Spinner className="size-3 text-muted-foreground" />
              )}
            </div>
            {targetBot && (
              <ChatAvatar
                seed={targetBot.avatar || targetBot.id}
                className="size-6 shrink-0 rounded-full ring-1 ring-border/50"
                alt={targetBot.name}
              />
            )}
          </div>
          {reason && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {reason}
            </p>
          )}
          {output?.error && (
            <p className="text-xs font-medium text-destructive">
              {output.error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function ScreenViewPart({ part }: { part: GenericToolPart }) {
  const isLoading =
    part.state === "input-available" || part.state === "input-streaming"
  const output = part.output as ScreenOutput | undefined
  const isError =
    part.state === "output-error" || !!part.errorText || !!output?.error

  if (isLoading) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Spinner className="size-4 text-primary" />
        <span>Capturing screen...</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="my-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
        Failed to capture screen:{" "}
        {part.errorText || output?.error || "Unknown error"}
      </div>
    )
  }

  if (output?.screenshot) {
    return (
      <div className="my-2 flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <MonitorIcon className="size-4 text-primary" />
            <span>Screen Snapshot</span>
          </div>
          {output.width && output.height && (
            <Badge
              variant="outline"
              className="text-[10px] text-muted-foreground"
            >
              {output.width} × {output.height}
            </Badge>
          )}
        </div>
        <div className="overflow-hidden rounded-md border bg-black/5 dark:bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:${output.mediaType || "image/png"};base64,${output.screenshot}`}
            alt="Screen capture"
            className="h-auto max-h-125 w-full object-contain"
          />
        </div>
      </div>
    )
  }

  return null
}

function sanitizeToolData(data: unknown): unknown {
  if (typeof data === "string") {
    return data
      .replace(/MEMORY\.md/gi, "memory")
      .replace(/\b1:1\s+(chat|conversation)s?\b/gi, "past conversations")
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeToolData)
  }
  if (data !== null && typeof data === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(data)) {
      if (
        key === "path" &&
        typeof val === "string" &&
        val.toLowerCase().includes("memory.md")
      ) {
        continue
      }
      result[key] = sanitizeToolData(val)
    }
    return result
  }
  return data
}

export function ToolCallPart({ part }: { part: GenericToolPart }) {
  const toolName =
    part.type === "dynamic-tool"
      ? (part.toolName ?? "tool")
      : part.type.replace(/^tool-/, "")
  const title = getToolTitle(toolName, part.input)

  const sanitizedInput = sanitizeToolData(part.input) as
    Record<string, unknown> | undefined
  const sanitizedOutput = sanitizeToolData(part.output)

  return (
    <Tool defaultOpen={false} className="my-2 w-full bg-card">
      <ToolHeader
        type={part.type as "dynamic-tool"}
        state={part.state}
        toolName={part.type === "dynamic-tool" ? toolName : ""}
        title={title}
      />
      <ToolContent>
        {sanitizedInput && Object.keys(sanitizedInput).length > 0 && (
          <ToolInput input={sanitizedInput} />
        )}
        {(Boolean(sanitizedOutput) || Boolean(part.errorText)) && (
          <ToolOutput output={sanitizedOutput} errorText={part.errorText} />
        )}
      </ToolContent>
    </Tool>
  )
}
