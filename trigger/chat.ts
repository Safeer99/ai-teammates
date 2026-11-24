import { google } from "@ai-sdk/google"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { stepCountIs, type ToolSet } from "ai"

import { db } from "../db"
import { getDaytonaClient } from "../lib/daytona"
import {
  createComputerUseTools,
  createHandoffTool,
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
    `Long-Term Memory Management:
You have a persistent long-term memory system across all conversations.
The goal of this memory is to remember key facts, user preferences, projects, and decisions across all conversations, including group chats.
- MANDATORY Tool Calling Rule (Save Immediately):
  - Whenever the user shares ANY personal preference (e.g. favorite movie, food, drinks, hobbies), personal background, project details, architecture decisions, or specific instructions:
    YOU MUST ACTUALLY CALL "updateMemory" in this exact turn to save it.
    DO NOT simply say in text "I have noted that down" or "I will remember that" without executing the tool call! A text promise does not save anything to memory.
  - To save without losing existing memories:
    First call "recallMemory" to inspect existing notes, combine them with the new information, and call "updateMemory" to save it immediately.
- When to Recall Memory:
  - Whenever the user asks you to recall something ("What movie do I like?", "Do you remember...", "What did I say..."), or whenever prior context would improve your answer, call "recallMemory" and answer from it.
- ABSOLUTE PROHIBITIONS (NEVER LEAK SYSTEM INTERNALS):
  - NEVER output the word "MEMORY.md" under any circumstances.
  - NEVER mention files, file paths, extensions, sandboxes, filesystems, tools, or technical storage.
  - NEVER mention technical concepts like "1:1 chat", "private conversation", "session", or "application structure".
  - Always speak naturally using everyday phrasing with words like "my memory":
    - "I'll keep that in mind!"
    - "Noted! Good to know you like Dune."
    - "From my memory, you mentioned that you like Dune!"
    - "My memory is drawing a blank on that—remind me what you prefer?"
  - Act as if you have natural human memory, keeping the technical saving mechanism completely behind the scenes.`,
    `Computer Use & Tools:
You have access to a full computer use toolkit connected to your Daytona sandbox environment:
- bash: Execute bash shell commands, inspect system info, run scripts, install tools.
- readFile: Read file contents from the sandbox filesystem (including "MEMORY.md").
- writeFile: Create or update files in the sandbox filesystem (including "MEMORY.md").
- listFiles: Explore directory structures and files in the sandbox.
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
- Actively maintain and reference your memory using the tools, keeping all technical storage details invisible to the user.`,
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
        return {
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
    let bot: BotInfo | null = null
    let allBots: BotInfo[] = []
    let chatInfo: ChatInfo | null = null

    const metadata = clientData as { botId?: string } | undefined
    const botId = metadata?.botId

    try {
      chatRecord = await db.query.chats.findFirst({
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

    let activeBot = bot
    let handedOffFrom: typeof bot = null

    const botSandboxCache = new Map<string, Sandbox>()
    const getActiveBotSandbox = async (): Promise<Sandbox | null> => {
      const currentBot = activeBot
      if (!currentBot?.sandboxId) return null
      const cached = botSandboxCache.get(currentBot.sandboxId)
      if (cached) {
        if (cached.state !== "started") {
          await cached.start()
        }
        return cached
      }
      const s = await getSandboxForBot(currentBot.sandboxId)
      if (s) {
        botSandboxCache.set(currentBot.sandboxId, s)
      }
      return s
    }

    const handoffTool = isGroup
      ? createHandoffTool(allBots, (target) => {
          handedOffFrom = activeBot
          activeBot = target
        })
      : undefined

    const runTools = isGroup
      ? {
          handoff: handoffTool!,
          recallMemory: createRecallMemoryTool(getActiveBotSandbox),
          updateMemory: createUpdateMemoryTool(getActiveBotSandbox),
          readFile: createReadFileTool(getActiveBotSandbox),
          writeFile: createWriteFileTool(getActiveBotSandbox),
          listFiles: createListFilesTool(getActiveBotSandbox),
          bash: createBashTool(getActiveBotSandbox),
        }
      : {
          ...createComputerUseTools(getActiveBotSandbox),
          ...(handoffTool ? { handoff: handoffTool } : {}),
        }

    if (activeBot) {
      chat.setUIMessageStreamOptions({
        messageMetadata: () => ({
          botId: activeBot?.id,
          botName: activeBot?.name,
          botAvatar: activeBot?.avatar,
          ...(handedOffFrom
            ? {
                handedOffFromBotId: handedOffFrom.id,
                handedOffFromBotName: handedOffFrom.name,
              }
            : {}),
        }),
      })
    }

    const modelMessages = [...messages]
    if (isGroup && bot && modelMessages.length > 0) {
      const lastIdx = modelMessages.length - 1
      const lastMsg = modelMessages[lastIdx]
      if (lastMsg && lastMsg.role === "user") {
        if (typeof lastMsg.content === "string") {
          if (!lastMsg.content.includes(`@${bot.name}`)) {
            modelMessages[lastIdx] = {
              ...lastMsg,
              content: `[@${bot.name}] ${lastMsg.content}`,
            }
          }
        } else if (Array.isArray(lastMsg.content)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const firstTextPart = (lastMsg.content as any[]).find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (p: any) => p.type === "text"
          ) as { type: "text"; text: string } | undefined
          if (
            firstTextPart &&
            typeof firstTextPart.text === "string" &&
            !firstTextPart.text.includes(`@${bot.name}`)
          ) {
            modelMessages[lastIdx] = {
              ...lastMsg,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content: (lastMsg.content as any[]).map((p: any) =>
                p === firstTextPart
                  ? { ...p, text: `[@${bot.name}] ${firstTextPart.text}` }
                  : p
              ),
            }
          }
        }
      }
    }

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
    })
  },
})
