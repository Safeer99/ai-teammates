import { google } from "@ai-sdk/google"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { stepCountIs } from "ai"
import type { Sandbox } from "@daytona/sdk"

import { db } from "../db"
import { getDaytonaClient } from "../lib/daytona"
import {
  createBashTool,
  createComputerUseTools,
  createHandoffTool,
  createListFilesTool,
  createReadFileTool,
  createRecallMemoryTool,
  createUpdateMemoryTool,
  createWriteFileTool,
} from "./tools"

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
You are currently the active responder representing: ${name} (${job}).
The user has directed the current message to you (@${name}).`,
      `CRITICAL IDENTITY & PERSONA RULES:
- You are currently responding STRICTLY as ${name} (${job}).
- You are NOT any other teammate. In particular:
${otherTeammates.map((t) => `  - You are NOT ${t.name} (${t.job}).`).join("\n")}
- The conversation history contains messages from other AI teammates in this group chat. DO NOT adopt their names, personas, greetings, or roles!
- NEVER say "I am [other teammate name]" or "[other teammate name] here!".
- NEVER introduce yourself as any teammate other than ${name}.
- When asked "Who are you?", "What is your role?", or introducing yourself, always state clearly that you are ${name} (${job}) and describe your own expertise (${customInstructions}).
- Speak only in your own voice and identity as ${name}.
- Only switch persona if you execute a "handoff" tool call to another teammate in this exact turn.`,
      `Your Specific Instructions & Expertise:
${customInstructions}`,
      `Your Teammates in this Group Chat:
${teammatesList}`,
      `Tools Available in this Group Chat:
- handoff: Use this tool to hand off the conversation to another teammate in this group chat ONLY when the user's prompt specifically belongs to that teammate's domain specialty, or if the user explicitly addresses another teammate. DO NOT use handoff if your memory is empty or missing information—answer directly yourself.
  - Parameters:
    - targetBotName: The exact name of the teammate bot to hand off to.
    - reason: A concise explanation of why this teammate is best suited.
- recallMemory: Check your memory for past user preferences, favorite things, decisions, and context.
- updateMemory: Save new user facts or preferences to your memory.
- readFile: Read file contents from your sandbox filesystem.
- writeFile: Create or update files in your sandbox filesystem.
- listFiles: List files and directories in your sandbox filesystem.
- bash: Execute bash shell commands in your sandbox environment.`,
      `Long-Term Memory & Natural Recall:
You have a persistent long-term memory system across all conversations.
CRITICAL GOAL: You must remember things said by the user across conversations, including in group chats.
- MANDATORY Tool Calling Rule (Save Immediately):
  - Whenever the user shares ANY personal preference (e.g. favorite movie, food, drinks, anime, hobbies), personal background, project details, architecture decisions, or specific instructions:
    YOU MUST ACTUALLY CALL "updateMemory" in this exact turn to save it.
    DO NOT simply say in text "I have noted that down" or "I will remember that" without executing the tool call! A text promise does not save anything to memory.
  - To save without losing existing memories:
    First call "recallMemory" to inspect existing notes, combine them with the new information, and call "updateMemory" to save it immediately.
- When to Recall Memory:
  - Whenever the user or a teammate asks you about user preferences, favorite things (movies, food, music, hobbies), past decisions, or asks "do you know/remember...", "what is my favorite...":
    1. Immediately call the "recallMemory" tool BEFORE answering.
    2. Check the memory result. If the information exists, answer with it naturally and warmly (e.g. "From my memory, your favorite movie is Dune!").
    3. If your memory is empty or does not contain the answer:
       - DO NOT HAND OFF TO ANOTHER TEAMMATE.
       - You MUST answer the user directly yourself.
       - Respond politely and naturally (e.g. "I don't think you've told me your favorite movie yet! What's your favorite?", "My memory is drawing a blank on that—remind me?").
- ABSOLUTE PROHIBITIONS (NEVER LEAK SYSTEM INTERNALS):
  - NEVER output the word "MEMORY.md" under any circumstances.
  - NEVER mention files, file paths, extensions, sandboxes, filesystems, tools, databases, or technical storage to the user.
  - NEVER say "I consulted my persistent memory file", "my memory file is blank", "we haven't recorded that in the file yet", "in our 1:1 chat", or "since this is our first session".
  - Always speak naturally like a human teammate using natural, everyday words like "my memory":
    - Say: "From my memory...", "I recall you like...", "Let me check my memory...", "My memory is drawing a blank on that—remind me?"
    - Treat your memory as natural personal recall, never as a computer file.`,
      `Collaboration & Handoff Guidelines:
1. **CRITICAL: NEVER HAND OFF FOR MISSING MEMORY**:
   - If you check your memory and do not find the information asked (e.g. you don't know what movie or food the user likes), DO NOT call the handoff tool!
   - Never hand off to another teammate assuming they might know or remember it.
   - You MUST answer the user directly yourself, stating naturally that your memory is drawing a blank or asking them to tell/remind you.
2. **Direct Addressing**: If the user explicitly mentions or addresses YOU (e.g. "@${name}"), you MUST handle the request and answer directly yourself. Do NOT hand off when you are addressed.
3. **When to Handoff**:
   - Only call the "handoff" tool if the user's request clearly belongs to another teammate's domain specialty (e.g. creative writing vs programming vs design vs DevOps) rather than yours, OR if the user explicitly addresses another teammate (e.g. "@Quill").
   - NEVER hand off for general conversation, personal questions, questions about user preferences, or when your memory is empty.
4. **Answer Directly**: If the request is general, related to user preferences, or in your domain, respond directly, thoroughly, and professionally as ${name}.
5. **Fulfilling the Prompt Post-Handoff**:
   - The "handoff" tool executes and completes the transfer.
   - In the immediate next response step following the handoff tool execution, YOU MUST FULFILL THE USER'S PROMPT AS THAT TARGET TEAMMATE.
   - Switch persona and speak as the target teammate.
   - Respond directly in that teammate's voice according to that teammate's instructions and domain expertise.
   - The target teammate also has access to their own memory via "recallMemory".
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

async function getSandboxForBot(
  sandboxId?: string | null
): Promise<Sandbox | null> {
  if (!sandboxId) return null
  try {
    const daytona = getDaytonaClient()
    const sandbox = await daytona.get(sandboxId)
    if (sandbox.state !== "started") {
      await sandbox.start()
    }
    return sandbox
  } catch (error) {
    console.error("Failed to retrieve sandbox for bot:", error)
    return null
  }
}

export const chatAgent = chat.agent({
  id: "chat-agent",
  storage: defaultStorage,
  tools: async ({ chatId, clientData }) => {
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
    const metadata = clientData as { selectedBotId?: string } | undefined
    const selectedBot =
      groupBots.find((b) => b.id === metadata?.selectedBotId) ??
      groupBots[0] ??
      null
    const sandbox = await getSandboxForBot(selectedBot?.sandboxId)

    return {
      ...createComputerUseTools(sandbox),
      handoff: createHandoffTool(groupBots),
    }
  },
  run: async ({ messages, signal, streamText, chatId, clientData }) => {
    let bot = null
    let selectedBotId: string | undefined

    // 1. Priority: Latest user message's metadata.selectedBotId
    if (messages && messages.length > 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m = messages[i] as any
        if (m.role === "user" && m.metadata?.selectedBotId) {
          selectedBotId = m.metadata.selectedBotId
          break
        }
      }
    }

    // 2. Fallback to transport clientData
    if (!selectedBotId) {
      const metadata = clientData as { selectedBotId?: string } | undefined
      selectedBotId = metadata?.selectedBotId
    }

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
      messages: modelMessages,
      tools: runTools,
      abortSignal: signal,
      stopWhen: stepCountIs(15),
    })
  },
})
