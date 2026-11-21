import { google } from "@ai-sdk/google"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { stepCountIs } from "ai"

import { db } from "../db"
import { getDaytonaClient } from "../lib/daytona"
import { createComputerUseTools } from "./tools"

function buildSystemPrompt(
  bot?: {
    name: string
    job: string
    instructions?: string | null
    sandboxId?: string | null
  } | null
) {
  const name = bot?.name || "AI Teammate"
  const job = bot?.job || "AI Assistant"
  const customInstructions =
    bot?.instructions?.trim() ||
    `Assist the user effectively in your role as ${job}.`
  const sandboxInfo = bot?.sandboxId
    ? `You are situated in an isolated Daytona cloud sandbox environment with ID: ${bot.sandboxId}.`
    : `You are situated in an isolated Daytona cloud sandbox environment.`

  return [
    `You are ${name}.`,
    `Your job is: ${job}.`,
    `Your Purpose:
You are a dedicated AI teammate collaborating directly with the user. Your core purpose is to:
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
- When performing terminal or code operations, use bash and filesystem tools as appropriate.`,
  ].join("\n\n")
}

async function getSandboxForChat(chatId: string) {
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
    // Group chats do not use desktop panel / sandbox
    if (chatRecord?.kind === "group") {
      return null
    }
    const bot = chatRecord?.members[0]?.bot
    if (!bot?.sandboxId) {
      return null
    }
    const daytona = getDaytonaClient()
    const sandbox = await daytona.get(bot.sandboxId)
    if (sandbox.state !== "started") {
      await sandbox.start()
    }
    return sandbox
  } catch (error) {
    console.error("Failed to retrieve sandbox for chat:", error)
    return null
  }
}

export const chatAgent = chat.agent({
  id: "chat-agent",
  storage: defaultStorage,
  tools: async ({ chatId }) => {
    const sandbox = await getSandboxForChat(chatId)
    return createComputerUseTools(sandbox)
  },
  run: async ({ messages, tools, signal, streamText, chatId, clientData }) => {
    let bot = null
    const metadata = clientData as { selectedBotId?: string } | undefined
    const selectedBotId = metadata?.selectedBotId

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
        if (chatRecord.kind === "group" && selectedBotId) {
          bot =
            chatRecord.members.find((m) => m.botId === selectedBotId)?.bot ??
            chatRecord.members[0]?.bot ??
            null
        } else {
          bot = chatRecord.members[0]?.bot ?? null
        }
      }
    } catch (error) {
      console.error("Failed to fetch bot details for system prompt:", error)
    }

    const system = buildSystemPrompt(bot)
    const modelName =
      process.env.GOOGLE_GENERATIVE_AI_MODEL ||
      process.env.AI_MODEL ||
      "gemini-3.5-flash-lite"

    return streamText({
      model: google(modelName),
      system,
      messages,
      tools,
      abortSignal: signal,
      stopWhen: stepCountIs(15),
    })
  },
})
