import { google } from "@ai-sdk/google"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { stepCountIs } from "ai"

import { db } from "../db"
import { getDaytonaClient } from "../lib/daytona"
import { createComputerUseTools, createHandoffTool } from "./tools"

function buildSystemPrompt(
  bot?: {
    id?: string
    name: string
    job: string
    instructions?: string | null
    sandboxId?: string | null
  } | null,
  groupContext?: {
    isGroup: boolean
    groupName?: string | null
    teammates: Array<{
      id: string
      name: string
      job: string
      instructions?: string | null
    }>
  } | null
) {
  const name = bot?.name || "AI Teammate"
  const job = bot?.job || "AI Assistant"
  const customInstructions =
    bot?.instructions?.trim() ||
    `Assist the user effectively in your role as ${job}.`

  if (groupContext?.isGroup) {
    const otherTeammates = groupContext.teammates.filter(
      (t) => t.id !== bot?.id && t.name.toLowerCase() !== name.toLowerCase()
    )
    const teammatesList =
      otherTeammates.length > 0
        ? otherTeammates
            .map(
              (t) =>
                `- **${t.name}** (Role: ${t.job})${
                  t.instructions
                    ? `\n  Specialty & Instructions: ${t.instructions.trim()}`
                    : ""
                }`
            )
            .join("\n")
        : "None (you are the only bot member in this group)."

    return [
      `You are ${name}.`,
      `Your job/role is: ${job}.`,
      `Group Chat Environment:
You are participating in a collaborative group chat named "${groupContext.groupName || "Team"}".
In this group chat, you work alongside human user(s) and fellow AI teammates.
You are currently the active responder representing: ${name} (${job}).`,
      `Your Specific Instructions & Expertise:
${customInstructions}`,
      `Your Teammates in this Group Chat:
${teammatesList}`,
      `Tools Available in this Group Chat:
- handoff: Use this tool to hand off the conversation to another teammate in this group chat if the user's prompt or question is better suited for their domain, skills, or job, or if the user explicitly addresses another teammate.
  - Parameters:
    - targetBotName: The exact name of the teammate bot to hand off to.
    - reason: A concise explanation of why this teammate is best suited.`,
      `Collaboration & Handoff Guidelines:
1. **Domain Assessment**: Carefully check if the user's request matches your specialty (${job}) or aligns better with one of your teammates listed above.
2. **Answer Directly**: If the request is in your domain or general enough for you to handle, respond directly, thoroughly, and professionally as ${name}.
3. **When to Handoff**:
   - If the request clearly belongs to another teammate's domain (e.g. creative writing vs programming vs design vs DevOps) rather than yours, DO NOT attempt to answer it yourself. Immediately call the "handoff" tool to transfer the turn to that teammate. Do not output conversational text or answers before calling the handoff tool.
   - If the user explicitly mentions or addresses another teammate (e.g. "@Quill", "Hey Quill, can you..."), immediately hand off to that teammate using the "handoff" tool without conversational preamble.
4. **Fulfilling the Prompt Post-Handoff**:
   - The "handoff" tool executes and completes the transfer.
   - In the immediate next response step following the handoff tool execution, YOU MUST FULFILL THE USER'S PROMPT AS THAT TARGET TEAMMATE.
   - Switch persona and speak as the target teammate.
   - Introduce or announce the takeover naturally in that teammate's voice (for example: "[Teammate Name] here! I'd be glad to help with this...") and provide the complete, high-quality answer to the user's prompt according to that teammate's instructions and expertise.
   - Do NOT call the handoff tool a second time in the same turn.`,
    ].join("\n\n")
  }

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
    const groupBots =
      chatRecord?.members?.map((m) => m.bot).filter(Boolean) ?? []
    const sandbox = await getSandboxForChat(chatId)

    return {
      ...createComputerUseTools(sandbox),
      handoff: createHandoffTool(groupBots),
    }
  },
  run: async ({ messages, tools, signal, streamText, chatId, clientData }) => {
    let bot = null
    const metadata = clientData as { selectedBotId?: string } | undefined
    const selectedBotId = metadata?.selectedBotId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chatRecord: any = null

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
        if (chatRecord.kind === "group" && selectedBotId) {
          bot =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            chatRecord.members.find((m: any) => m.botId === selectedBotId)
              ?.bot ??
            chatRecord.members[0]?.bot ??
            null
        } else {
          bot = chatRecord.members[0]?.bot ?? null
        }
      }
    } catch (error) {
      console.error("Failed to fetch bot details for system prompt:", error)
    }

    const isGroup = chatRecord?.kind === "group"
    const allBots =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chatRecord?.members?.map((m: any) => m.bot).filter(Boolean) ?? []
    const groupContext = isGroup
      ? {
          isGroup: true,
          groupName: chatRecord?.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          teammates: allBots.map((b: any) => ({
            id: b.id,
            name: b.name,
            job: b.job,
            instructions: b.instructions,
          })),
        }
      : null

    const system = buildSystemPrompt(bot, groupContext)
    const modelName =
      process.env.GOOGLE_GENERATIVE_AI_MODEL ||
      process.env.AI_MODEL ||
      "gemini-3.5-flash-lite"

    let activeBot = bot
    let handedOffFrom: typeof bot = null

    const handoffTool = isGroup
      ? createHandoffTool(allBots, (target) => {
          handedOffFrom = activeBot
          activeBot = target
        })
      : undefined

    const runTools = isGroup ? { handoff: handoffTool! } : tools

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

    return streamText({
      model: google(modelName),
      system,
      messages,
      tools: runTools,
      abortSignal: signal,
      stopWhen: stepCountIs(15),
    })
  },
})
