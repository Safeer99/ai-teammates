import { google } from "@ai-sdk/google"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { stepCountIs, type ToolSet } from "ai"

import { db } from "../db"
import { getDaytonaClient } from "../lib/daytona"
import {
  createComputerUseTools,
  createHandoffTool,
  type TeammateBot,
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
  teammates = [],
}: {
  bot?: BotInfo | null
  chatInfo?: ChatInfo | null
  teammates?: TeammateBot[]
}) {
  const name = bot?.name || "AI Teammate"
  const job = bot?.job || "AI Assistant"
  const customInstructions =
    bot?.instructions?.trim() ||
    `Assist the user effectively in your role as ${job}.`

  const isGroup = chatInfo?.kind === "group"

  if (isGroup) {
    const groupName = chatInfo?.name?.trim() || "Group Chat"
    const teammatesList =
      teammates.length > 0
        ? teammates
            .map(
              (t) =>
                `- **${t.name}** (ID: \`${t.id}\`): Role is **${t.job}**${
                  t.instructions
                    ? `. Specialty/Focus: ${t.instructions.slice(0, 200)}`
                    : ""
                }`
            )
            .join("\n")
        : "No other teammates currently in this group chat."

    return [
      `You are **${name}**.`,
      `Your role is: **${job}**.`,
      `Group Chat Environment:
You are participating in a multi-agent group chat named "${groupName}".
In this group chat, you collaborate with the user and other specialized AI teammates.
You are currently the active speaking bot.`,
      `Your Role & Purpose:
- Represent your role as ${job} with deep domain expertise, thoughtfulness, and professionalism.
- When the user's prompt or question directly relates to your specialty (${job}), answer it directly, comprehensively, and proactively.
- If the prompt touches both your domain and another teammate's domain, you may provide your domain's perspective and coordinate with your teammate.`,
      `Your Personal Instructions:
${customInstructions}`,
      `Your Fellow Teammates in this Group Chat:
${teammatesList}`,
      `Tools & Capabilities in Group Chat:
You have access to the **handoff** tool:
- **handoff**: Use this tool when the user's prompt, question, or request is clearly outside your expertise as ${job} and is better suited for one of your teammates listed above.
  - Parameters:
    - \`botId\`: The ID of the teammate bot to transfer to (e.g. from the teammates list above).
    - \`botName\`: The name of the teammate (optional).
    - \`reason\`: A clear, succinct explanation of why this teammate is the ideal person to handle the user's request.

Group Chat Guidelines & Boundaries:
1. **Desktop Sandbox Disabled**: You do NOT have access to bash, filesystem tools (readFile/writeFile), or desktop GUI controls (mouse, keyboard, screen capture) in group chats. Those tools are only present in 1-on-1 direct chats with dedicated virtual desktops. Do NOT attempt to run terminal commands, inspect sandbox files, or capture the screen here. Your contributions should be analytical, strategic, conversational, code examples, review, and collaborative guidance.
2. **When to Handle Directly**: If the user's prompt aligns with your specialty (${job}), or is a general greeting or conversational question, answer directly. DO NOT hand off if you are well-equipped to handle it.
3. **When to Hand Off**: If the user's prompt specifically requests expertise of another teammate (e.g., asking for database schema/indexing when a Database Architect is present, UI styling when a Frontend Specialist is present, cloud infrastructure when a DevOps Engineer is present), call the \`handoff\` tool.
4. **After Calling Handoff**: Once you call the \`handoff\` tool, STOP immediately. Do NOT generate any accompanying text, message, or explanation. The handed-off teammate will take over and reply directly to the user. Only the handoff tool call should be emitted.
5. **Handling Incoming Handoffs**: If you receive a prompt or task that was handed off to you by a teammate (indicated by a handoff message or note in conversation history), immediately take ownership of the user's original request. Answer the user's prompt directly, comprehensively, and enthusiastically using your domain expertise as ${job}. You may warmly acknowledge the handoff (e.g. "Thanks, [Teammate]! I'd be glad to help with this." or "I'll take it from here!"), and then deliver the full answer. Under NO circumstances should you immediately hand the request back to the teammate who handed it to you.`,
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

export const chatAgent = chat.agent({
  id: "chat-agent",
  storage: defaultStorage,
  tools: async ({ chatId }): Promise<ToolSet> => {
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

      if (chatRecord?.kind === "group") {
        const allBots = chatRecord.members.map((m) => m.bot)
        return {
          handoff: createHandoffTool(allBots),
        }
      }

      const bot = chatRecord?.members[0]?.bot
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
    let teammates: TeammateBot[] = []
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
        chatInfo = {
          id: chatRecord.id,
          kind: chatRecord.kind,
          name: chatRecord.name,
        }

        const allBots = chatRecord.members.map((m) => m.bot)

        if (chatRecord.kind === "group") {
          bot =
            (botId ? allBots.find((b) => b.id === botId) : null) ??
            allBots[0] ??
            null
          const currentBotId = bot?.id
          teammates = currentBotId
            ? allBots.filter((b) => b.id !== currentBotId)
            : allBots

          // Ensure handoff tool has currentBotId bound for validation
          tools = {
            ...tools,
            handoff: createHandoffTool(allBots, currentBotId),
          }
        } else {
          bot = allBots[0] ?? null
          teammates = []
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
      teammates,
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
      abortSignal: signal,
      stopWhen: stepCountIs(15),
    })
  },
})
