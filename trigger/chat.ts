import type { Sandbox } from "@daytona/sdk"
import { google } from "@ai-sdk/google"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { stepCountIs, type ToolSet } from "ai"

import { db } from "../db"
import { getDaytonaClient } from "../lib/daytona"
import {
  assertWithinAiLimit,
  recordAiTokenUsage,
  recordSandboxComputeUsage,
} from "../lib/usage-server"
import {
  createComputerUseTools,
  createHandoffTool,
  createRecallMemoryTool,
  createUpdateMemoryTool,
  ensureSandboxReady,
  type Handoff,
} from "./tools"

export interface BotInfo {
  id: string
  name: string
  job: string
  instructions?: string | null
  sandboxId?: string | null
}

export interface ChatInfo {
  id: string
  kind: "direct" | "group"
  name?: string | null
}

function buildSystemPrompt({
  bot,
  chatInfo,
  allBots = [],
}: {
  bot?: BotInfo | null
  chatInfo?: ChatInfo | null
  allBots?: BotInfo[]
}) {
  const name = bot?.name || "AI Teammate"
  const job = bot?.job || "AI Assistant"
  const customInstructions =
    bot?.instructions?.trim() ||
    `Assist the user effectively in your role as ${job}.`

  const isGroup = chatInfo?.kind === "group"

  if (isGroup) {
    const groupName = chatInfo?.name?.trim() || "Group Chat"
    const teammates = allBots
      .filter((b) => b.id !== bot?.id)
      .map(
        (t) =>
          `- ${t.name} (id: ${t.id}): ${t.job}${
            t.instructions ? `. Focus: ${t.instructions.slice(0, 150)}` : ""
          }`
      )
      .join("\n")

    return [
      `You are ${name}, an AI teammate. Your job: ${job}`,
      `You are in a group chat called "${groupName}", together with the user and these other teammates:\n\n${teammates}`,
      "The user addresses each message to one teammate, and this one is yours: either they picked you, or a teammate handed it to you. Earlier replies in this conversation may have been written by other teammates rather than by you. Use them as context, and do not present their work as your own.",
      "Besides any other tools you have a handoff tool. Call it when a request clearly belongs to a teammate's job rather than yours, with their id and a short note on what is needed. That teammate then takes over and answers in your place, so write nothing more once you have called it. Do not hand off what you can do well yourself, or because a request is merely hard, and never pass a request back to a teammate who handed it to you. When nobody fits better, answer it yourself.",
      `Memory:
You have \`recallMemory\` and \`updateMemory\` tools connected to your personal persistent memory ("MEMORY.md"), which is shared with your private 1:1 chats.
- Always check memory: Whenever the user asks about something you might know from a private 1:1 chat (such as their preferences, favorite things, personal details, past discussions, or prior decisions) or asks what you remember, call \`recallMemory\` BEFORE answering or handing off.
- Update memory: When the user shares important new preferences, personal details, facts, or decisions, call \`updateMemory\` to save them.`,
      `Your personal instructions:\n${customInstructions}`,
    ].join("\n\n")
  }

  // Direct (1-on-1) chat
  const sandboxInfo = bot?.sandboxId
    ? `You are situated in an isolated Daytona cloud sandbox environment with ID: ${bot.sandboxId}.`
    : `You are situated in an isolated Daytona cloud sandbox environment.`

  return [
    `You are ${name}.`,
    `Your job is: ${job}.`,
    `Your Purpose:
You are a dedicated AI teammate collaborating directly with the user in a private 1:1 chat. Your core purpose is to:
- Act as a trusted expert and partner in your domain as ${job}, delivering thoughtful, accurate, and high-quality work.
- Collaborate actively with the user to solve problems, achieve project goals, and make informed decisions.
- Communicate with clarity, precision, and professionalism, adjusting your tone and detail level to suit the context.
- Think through tasks systematically, provide well-structured guidance, and anticipate relevant edge cases or follow-up needs.
- Maintain a proactive, solution-oriented mindset while respecting user preferences and project constraints.`,
    `Your Instructions:
${customInstructions}`,
    `Environment context:
${sandboxInfo}`,
    `Computer Use & Tools:
You have access to a full computer use toolkit connected to your Daytona sandbox environment:
- bash: Execute bash shell commands, inspect system info, run scripts, install tools.
- readFile: Read file contents from the sandbox filesystem.
- writeFile: Create or update files in the sandbox filesystem.
- listFiles: Explore directory structures and files in the sandbox.
- recallMemory: Recall your persistent long-term memory ("MEMORY.md") shared across 1:1 and group chats.
- updateMemory: Save or update persistent long-term memories in "MEMORY.md".
- mouseClick: Click anywhere on the desktop screen (left, right, or double-click).
- mouseMove: Move the cursor to any coordinates on the screen.
- mouseScroll: Scroll up, down, left, or right at specific coordinates.
- keyboardType: Type text into the active/focused application or input field.
- keyboardPress: Press specific keys or hotkey combinations (e.g., 'enter', 'tab', 'escape', 'c' with ['ctrl']).
- viewScreen: Take a screenshot to inspect the desktop display yourself. Use this whenever you need to check the current screen state to decide what to do next. This is internal for your inspection only and is never shown in chat.
- showScreen: Capture a screenshot and present it to the user. Use this when the user asks to see what is on the screen or asks for visual confirmation. This is rendered directly in chat for the user.

Guidelines:
- When asked to perform desktop tasks or interact with GUI applications, use viewScreen first if you need to know the visual state or coordinates.
- Use showScreen whenever the user explicitly requests to see the screen or visual output.
- When performing terminal or code operations, use bash and filesystem tools as appropriate.

Memory:
Your persistent long-term memory ("MEMORY.md") is shared across both this private 1:1 chat and any group chats you participate in.
- Reference memory: Call \`recallMemory\` at the start of a conversation or whenever past context, user preferences, personal details, project facts, or prior decisions might be relevant.
- Proactively write memory: Whenever the user shares any personal detail, preference, like or dislike (e.g. favorite movie, hobbies, tools, style), goal, project fact, or decision — even in casual conversation and even if they do not explicitly ask you to remember it — immediately call \`updateMemory\` (with \`mode: "append"\`) to save it. Only use \`mode: "replace"\` if you need to reorganize or deduplicate after calling \`recallMemory\`.`,
  ].join("\n\n")
}

export const chatAgent = chat.agent({
  id: "chat-agent",
  storage: defaultStorage,
  tools: async ({ chatId, clientData }): Promise<ToolSet> => {
    try {
      const chatRecord = await db.query.chats.findFirst({
        where: (chats, { eq }) => eq(chats.id, chatId),
        with: {
          members: {
            with: {
              bot: true,
            },
          },
        },
      })

      if (!chatRecord) return {}

      const allBots = chatRecord.members.map((m) => m.bot)
      const metadata = clientData as { botId?: string } | undefined
      const botId = metadata?.botId
      const bot =
        (botId ? allBots.find((b) => b.id === botId) : null) ??
        allBots[0] ??
        null

      const held = new Set(bot ? [bot.id] : [])

      if (chatRecord.kind === "group") {
        let currentBot = bot
        const sandboxCache = new Map<string, Sandbox>()

        const getCurrentSandbox = async (): Promise<Sandbox | null> => {
          if (!currentBot?.sandboxId) return null
          let sandbox = sandboxCache.get(currentBot.sandboxId)
          if (!sandbox) {
            const daytona = getDaytonaClient()
            sandbox = await daytona.get(currentBot.sandboxId)
            sandboxCache.set(currentBot.sandboxId, sandbox)
          }
          await ensureSandboxReady(sandbox)
          return sandbox
        }

        return {
          recallMemory: createRecallMemoryTool(getCurrentSandbox),
          updateMemory: createUpdateMemoryTool(getCurrentSandbox),
          handoff: createHandoffTool((targetId) => {
            const target = allBots.find(
              (b) =>
                b.id === targetId ||
                b.name.toLowerCase().trim() === targetId.toLowerCase().trim()
            )
            if (!target) {
              throw new Error("No teammate in this chat has that id.")
            }
            if (held.has(target.id)) {
              throw new Error(
                `${target.name} already had this request. Answer it yourself.`
              )
            }
            held.add(target.id)
            currentBot = target
            return { botId: target.id, name: target.name, job: target.job }
          }),
        }
      }

      if (!bot?.sandboxId) {
        return createComputerUseTools(null)
      }
      const daytona = getDaytonaClient()
      const sandbox = await daytona.get(bot.sandboxId)
      if (sandbox.state !== "started") {
        await sandbox.start()
      }
      return createComputerUseTools(sandbox)
    } catch (error) {
      console.error("Failed to retrieve tools for chat:", error)
      return {}
    }
  },
  run: async ({ messages, tools, signal, streamText, chatId, clientData }) => {
    const runStartedAt = Date.now()
    let userId: string | null = null
    let bot: BotInfo | null = null
    let allBots: BotInfo[] = []
    let chatInfo: ChatInfo | null = null

    const metadata = clientData as { botId?: string } | undefined
    const botId = metadata?.botId

    try {
      const chatRecord = await db.query.chats.findFirst({
        where: (chats, { eq }) => eq(chats.id, chatId),
        with: {
          members: {
            with: {
              bot: true,
            },
          },
        },
      })
      if (chatRecord) {
        userId = chatRecord.userId
        chatInfo = {
          id: chatRecord.id,
          kind: chatRecord.kind,
          name: chatRecord.name,
        }

        allBots = chatRecord.members.map((m) => m.bot)

        if (chatRecord.kind === "group") {
          bot =
            (botId ? allBots.find((b) => b.id === botId) : null) ??
            allBots[0] ??
            null
        } else {
          bot = allBots[0] ?? null
        }
      }
    } catch (error) {
      console.error("Failed to fetch bot details for system prompt:", error)
    }

    if (userId) {
      await assertWithinAiLimit(userId)
    }

    if (bot) {
      chat.setUIMessageStreamOptions({
        messageMetadata: () => ({
          botId: bot.id,
        }),
      })
    }

    const system = buildSystemPrompt({
      bot,
      chatInfo,
      allBots,
    })
    const modelName =
      process.env.GOOGLE_GENERATIVE_AI_MODEL ||
      process.env.AI_MODEL ||
      "gemini-3.5-flash-lite"

    return streamText({
      model: google(modelName),
      system,
      messages,
      tools,
      prepareStep: ({ steps }) => {
        if (chatInfo?.kind !== "group") return undefined

        const handoff = steps
          .flatMap((step) => step.toolResults)
          .findLast((result) => result.toolName === "handoff")

        if (!handoff || !handoff.output) return undefined

        const handoffOutput = handoff.output as Handoff
        const current = allBots.find((b) => b.id === handoffOutput.botId)

        if (!current) return undefined

        return {
          instructions: buildSystemPrompt({
            bot: current,
            chatInfo,
            allBots,
          }),
        }
      },
      abortSignal: signal,
      stopWhen: stepCountIs(15),
      onEnd: async ({ usage, steps }) => {
        if (!userId) return

        try {
          await recordAiTokenUsage({
            userId,
            botId: bot?.id,
            chatId,
            model: modelName,
            inputTokens: usage.inputTokens ?? 0,
            cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            description: `Chat turn (${bot?.name ?? "Assistant"})`,
          })
        } catch (usageError) {
          console.error("Failed to record AI token usage:", usageError)
        }

        const usedSandboxTools = steps.some((step) =>
          step.toolCalls.some((call) => call.toolName !== "handoff")
        )
        if (usedSandboxTools && bot?.sandboxId) {
          const elapsedSeconds = Math.max(
            1,
            Math.round((Date.now() - runStartedAt) / 1000)
          )
          try {
            await recordSandboxComputeUsage({
              userId,
              botId: bot.id,
              chatId,
              sandboxId: bot.sandboxId,
              seconds: elapsedSeconds,
              description: `Agent sandbox execution (${bot.name})`,
            })
          } catch (sandboxUsageError) {
            console.error(
              "Failed to record agent sandbox usage:",
              sandboxUsageError
            )
          }
        }
      },
    })
  },
})
