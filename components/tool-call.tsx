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
import { ChatAvatar } from "@/components/chat-avatar"
import type { ChatBotItem } from "@/components/chat-view"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"

export interface ScreenOutput {
  screenshot?: string
  width?: number
  height?: number
  mediaType?: string
  error?: string
}

export interface HandoffOutput {
  botId?: string
  name?: string
  job?: string
  success?: boolean
  targetBotId?: string
  targetBotName?: string
  targetBotJob?: string
  reason?: string
  message?: string
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

export const TOOL_TITLES: Record<string, string> = {
  bash: "Run Command",
  readFile: "Read File",
  writeFile: "Write File",
  listFiles: "List Files",
  mouseClick: "Mouse Click",
  mouseMove: "Mouse Move",
  mouseScroll: "Mouse Scroll",
  keyboardType: "Keyboard Type",
  keyboardPress: "Keyboard Press",
  showScreen: "Screen Capture",
  handoff: "Handoff to Teammate",
}

export function HandoffToolPart({
  part,
  bots = [],
}: {
  part: GenericToolPart
  bots?: ChatBotItem[]
}) {
  const isLoading =
    part.state === "input-available" || part.state === "input-streaming"
  const output = part.output as HandoffOutput | undefined
  const input = part.input as
    | { botId?: string; botName?: string; reason?: string; note?: string }
    | undefined
  const isError =
    part.state === "output-error" ||
    Boolean(part.errorText) ||
    Boolean(output && output.success === false)

  const targetId = output?.botId || output?.targetBotId || input?.botId
  const targetBot = bots.find(
    (b) =>
      (targetId && b.id === targetId) ||
      (output?.name && b.name.toLowerCase() === output.name.toLowerCase()) ||
      (output?.targetBotName &&
        b.name.toLowerCase() === output.targetBotName.toLowerCase())
  )

  const targetName =
    targetBot?.name ||
    output?.name ||
    output?.targetBotName ||
    input?.botName ||
    "Teammate"

  const targetJob =
    targetBot?.job || output?.job || output?.targetBotJob

  const targetAvatarSeed =
    targetBot?.avatar || targetBot?.id || targetId || targetName

  const reason =
    output?.reason ||
    input?.reason ||
    input?.note

  if (isLoading) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Spinner className="size-4 text-primary" />
        <span>Handing off to {targetName}...</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <ArrowRightLeftIcon className="size-4 shrink-0" />
        <span>
          Handoff failed:{" "}
          {part.errorText || output?.error || "Unable to transfer conversation"}
        </span>
      </div>
    )
  }

  return (
    <div className="my-2 flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {targetAvatarSeed ? (
            <ChatAvatar seed={targetAvatarSeed} className="size-5 shrink-0" />
          ) : (
            <div className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ArrowRightLeftIcon className="size-3" />
            </div>
          )}
          <span className="font-medium text-foreground">
            Handed off to{" "}
            <span className="font-semibold text-primary">{targetName}</span>
          </span>
        </div>
        {targetJob && (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {targetJob}
          </Badge>
        )}
      </div>

      {reason && (
        <p className="pl-7 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/80">Reason:</span>{" "}
          {reason}
        </p>
      )}
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

export function ToolCallPart({ part }: { part: GenericToolPart }) {
  const toolName =
    part.type === "dynamic-tool"
      ? (part.toolName ?? "tool")
      : part.type.replace(/^tool-/, "")
  const title = TOOL_TITLES[toolName] ?? toolName

  return (
    <Tool
      defaultOpen={
        part.state === "input-available" || part.state === "output-error"
      }
      className="my-2 bg-card"
    >
      <ToolHeader
        type={part.type as "dynamic-tool"}
        state={part.state}
        toolName={part.type === "dynamic-tool" ? toolName : ""}
        title={title}
      />
      <ToolContent>
        {part.input && Object.keys(part.input).length > 0 && (
          <ToolInput input={part.input} />
        )}
        {(Boolean(part.output) || Boolean(part.errorText)) && (
          <ToolOutput output={part.output} errorText={part.errorText} />
        )}
      </ToolContent>
    </Tool>
  )
}

export function ToolCall({
  part,
  bots = [],
}: {
  part: GenericToolPart
  bots?: ChatBotItem[]
}) {
  const toolName =
    part.type === "dynamic-tool"
      ? (part.toolName ?? "")
      : part.type.replace(/^tool-/, "")

  switch (toolName) {
    case "viewScreen":
    case "view_screen":
      return null
    case "showScreen":
    case "show_screen":
      return <ScreenViewPart part={part} />
    case "handoff":
      return <HandoffToolPart part={part} bots={bots} />
    default:
      return <ToolCallPart part={part} />
  }
}

export default ToolCall

