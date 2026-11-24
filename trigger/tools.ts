import type { Sandbox } from "@daytona/sdk"
import { tool } from "ai"
import { z } from "zod"

export type SandboxProvider =
  | Sandbox
  | null
  | undefined
  | (() => Promise<Sandbox | null | undefined> | Sandbox | null | undefined)

export async function resolveSandbox(
  provider?: SandboxProvider
): Promise<Sandbox | null> {
  if (!provider) return null
  if (typeof provider === "function") {
    const res = await provider()
    return res ?? null
  }
  return provider
}

export async function ensureSandboxReady(sandbox: Sandbox) {
  if (sandbox.state !== "started") {
    await sandbox.start()
  }
}

export async function ensureComputerUse(sandbox: Sandbox) {
  await ensureSandboxReady(sandbox)
  if (!sandbox?.computerUse) return
  try {
    const status = await sandbox.computerUse.getStatus()
    if (status?.status !== "running") {
      await sandbox.computerUse.start()
    }
  } catch {
    try {
      await sandbox.computerUse.start()
    } catch (e) {
      console.warn("Could not start computerUse on sandbox:", e)
    }
  }
}

export const createRecallMemoryTool = (sandbox?: SandboxProvider) =>
  tool({
    description:
      "Recall information from your persistent memory (e.g. user preferences, favorite things, past decisions). Call this whenever the user asks if you remember something or when past user context is relevant.",
    inputSchema: z.object({}),
    execute: async () => {
      const activeSandbox = await resolveSandbox(sandbox)
      if (!activeSandbox) return { memory: "" }
      try {
        await ensureSandboxReady(activeSandbox)
        try {
          const buffer = await activeSandbox.fs.downloadFile("MEMORY.md")
          return {
            memory: buffer.toString("utf8"),
          }
        } catch {
          try {
            await activeSandbox.process.executeCommand("touch MEMORY.md")
          } catch {}
          return {
            memory: "",
          }
        }
      } catch {
        return { memory: "" }
      }
    },
  })

export const createUpdateMemoryTool = (sandbox?: SandboxProvider) =>
  tool({
    description:
      "Save or update facts, preferences, or notes into your persistent memory. Call this immediately whenever the user shares personal details, preferences (favorite food, movies, hobbies), or project decisions.",
    inputSchema: z.object({
      content: z
        .string()
        .describe("The updated memory content to remember in clean Markdown format"),
    }),
    execute: async ({ content }) => {
      const activeSandbox = await resolveSandbox(sandbox)
      if (!activeSandbox) return { error: "Memory is currently unavailable." }
      try {
        await ensureSandboxReady(activeSandbox)
        await activeSandbox.fs.uploadFile(
          Buffer.from(content, "utf8"),
          "MEMORY.md"
        )
        return {
          success: true,
        }
      } catch (error) {
        return {
          error:
            error instanceof Error ? error.message : "Failed to update memory",
        }
      }
    },
  })

export const createBashTool = (sandbox?: SandboxProvider) =>
  tool({
    description:
      "Execute a bash shell command in the Daytona sandbox environment.",
    inputSchema: z.object({
      command: z
        .string()
        .describe(
          "The bash command to run (e.g. 'ls -la', 'python script.py', 'cat file.txt')"
        ),
    }),
    execute: async ({ command }) => {
      const activeSandbox = await resolveSandbox(sandbox)
      if (!activeSandbox)
        return { error: "No active sandbox environment available." }
      try {
        await ensureSandboxReady(activeSandbox)
        const response = await activeSandbox.process.executeCommand(command)
        return {
          stdout: response.result || "",
          exitCode: response.exitCode,
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to execute command"
        return { error: message }
      }
    },
  })

export const createReadFileTool = (sandbox?: SandboxProvider) =>
  tool({
    description: "Read the contents of a file from the sandbox filesystem.",
    inputSchema: z.object({
      path: z.string().describe("Path to the file to read in the sandbox"),
    }),
    execute: async ({ path }) => {
      const activeSandbox = await resolveSandbox(sandbox)
      if (!activeSandbox)
        return { error: "No active sandbox environment available." }
      try {
        await ensureSandboxReady(activeSandbox)
        const cleanPath = path.replace(/^\.\//, "")
        try {
          const buffer = await activeSandbox.fs.downloadFile(cleanPath)
          if (cleanPath === "MEMORY.md" || cleanPath.endsWith("/MEMORY.md")) {
            return {
              memory: buffer.toString("utf8"),
            }
          }
          return {
            content: buffer.toString("utf8"),
            path: cleanPath,
          }
        } catch (downloadError) {
          // If MEMORY.md does not exist yet, auto-create it with touch and return empty string
          if (cleanPath === "MEMORY.md" || cleanPath.endsWith("/MEMORY.md")) {
            try {
              await activeSandbox.process.executeCommand(`touch ${cleanPath}`)
              return {
                memory: "",
              }
            } catch {
              // fallback
            }
          }
          throw downloadError
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `Failed to read file: ${path}`
        return { error: message }
      }
    },
  })

export const createWriteFileTool = (sandbox?: SandboxProvider) =>
  tool({
    description:
      "Create or overwrite a file with the given content in the sandbox filesystem.",
    inputSchema: z.object({
      path: z.string().describe("Path to the file to write in the sandbox"),
      content: z.string().describe("The text content to write into the file"),
    }),
    execute: async ({ path, content }) => {
      const activeSandbox = await resolveSandbox(sandbox)
      if (!activeSandbox)
        return { error: "No active sandbox environment available." }
      try {
        await ensureSandboxReady(activeSandbox)
        const cleanPath = path.replace(/^\.\//, "")
        await activeSandbox.fs.uploadFile(
          Buffer.from(content, "utf8"),
          cleanPath
        )
        if (cleanPath === "MEMORY.md" || cleanPath.endsWith("/MEMORY.md")) {
          return {
            success: true,
          }
        }
        return {
          success: true,
          path: cleanPath,
          bytesWritten: Buffer.byteLength(content, "utf8"),
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `Failed to write file: ${path}`
        return { error: message }
      }
    },
  })

export const createListFilesTool = (sandbox?: SandboxProvider) =>
  tool({
    description:
      "List files and directories at the given path in the sandbox filesystem.",
    inputSchema: z.object({
      path: z
        .string()
        .default("")
        .describe("Directory path to list (defaults to workspace root)"),
    }),
    execute: async ({ path }) => {
      const activeSandbox = await resolveSandbox(sandbox)
      if (!activeSandbox)
        return { error: "No active sandbox environment available." }
      try {
        await ensureSandboxReady(activeSandbox)
        const cleanPath = (path || "").replace(/^\.\//, "")
        const files = await activeSandbox.fs.listFiles(cleanPath || "")
        return {
          path: cleanPath || ".",
          files: files.map((f) => ({
            name: f.name,
            isDir: f.isDir,
            size: f.size,
            modified: f.modTime,
          })),
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `Failed to list files at path: ${path}`
        return { error: message }
      }
    },
  })

export const createMouseClickTool = (sandbox?: SandboxProvider) =>
  tool({
    description:
      "Click the mouse at the specified (x, y) coordinates on the desktop screen.",
    inputSchema: z.object({
      x: z.number().describe("X coordinate to click at"),
      y: z.number().describe("Y coordinate to click at"),
      button: z
        .enum(["left", "right", "middle"])
        .default("left")
        .describe("Mouse button to click"),
      double: z
        .boolean()
        .default(false)
        .describe("Whether to perform a double-click"),
    }),
    execute: async ({ x, y, button, double }) => {
      const activeSandbox = await resolveSandbox(sandbox)
      if (!activeSandbox)
        return { error: "No active sandbox environment available." }
      try {
        await ensureComputerUse(activeSandbox)
        const res = await activeSandbox.computerUse.mouse.click(
          x,
          y,
          button,
          double
        )
        return { success: true, x, y, button, double, result: res }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to perform mouse click"
        return { error: message }
      }
    },
  })

export const createMouseMoveTool = (sandbox?: SandboxProvider) =>
  tool({
    description:
      "Move the mouse cursor to the specified (x, y) coordinates on the desktop screen.",
    inputSchema: z.object({
      x: z.number().describe("X coordinate to move to"),
      y: z.number().describe("Y coordinate to move to"),
    }),
    execute: async ({ x, y }) => {
      const activeSandbox = await resolveSandbox(sandbox)
      if (!activeSandbox)
        return { error: "No active sandbox environment available." }
      try {
        await ensureComputerUse(activeSandbox)
        const res = await activeSandbox.computerUse.mouse.move(x, y)
        return { success: true, x: res.x, y: res.y }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to move mouse"
        return { error: message }
      }
    },
  })

export const createMouseScrollTool = (sandbox?: SandboxProvider) =>
  tool({
    description: "Scroll the mouse wheel at the specified (x, y) coordinates.",
    inputSchema: z.object({
      x: z.number().describe("X coordinate to scroll at"),
      y: z.number().describe("Y coordinate to scroll at"),
      direction: z
        .enum(["up", "down", "left", "right"])
        .describe("Direction to scroll"),
      amount: z.number().default(1).describe("Number of scroll wheel ticks"),
    }),
    execute: async ({ x, y, direction, amount }) => {
      const activeSandbox = await resolveSandbox(sandbox)
      if (!activeSandbox)
        return { error: "No active sandbox environment available." }
      try {
        await ensureComputerUse(activeSandbox)
        await activeSandbox.computerUse.mouse.scroll(x, y, direction, amount)
        return { success: true, x, y, direction, amount }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to scroll mouse"
        return { error: message }
      }
    },
  })

export const createKeyboardTypeTool = (sandbox?: SandboxProvider) =>
  tool({
    description:
      "Type text using the keyboard into the currently active or focused input.",
    inputSchema: z.object({
      text: z.string().describe("The text to type"),
      delay: z
        .number()
        .optional()
        .describe("Optional delay between keystrokes in ms"),
    }),
    execute: async ({ text, delay }) => {
      const activeSandbox = await resolveSandbox(sandbox)
      if (!activeSandbox)
        return { error: "No active sandbox environment available." }
      try {
        await ensureComputerUse(activeSandbox)
        await activeSandbox.computerUse.keyboard.type(text, delay)
        return { success: true, text }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to type text"
        return { error: message }
      }
    },
  })

export const createKeyboardPressTool = (sandbox?: SandboxProvider) =>
  tool({
    description:
      "Press a key or key combination with modifiers (e.g. 'enter', 'tab', 'escape', 'c' with ['ctrl']).",
    inputSchema: z.object({
      key: z
        .string()
        .describe("Key name to press (e.g. 'enter', 'tab', 'escape', 'c')"),
      modifiers: z
        .array(z.string())
        .optional()
        .describe("Optional modifier keys like ['ctrl', 'shift', 'alt']"),
    }),
    execute: async ({ key, modifiers }) => {
      const activeSandbox = await resolveSandbox(sandbox)
      if (!activeSandbox)
        return { error: "No active sandbox environment available." }
      try {
        await ensureComputerUse(activeSandbox)
        await activeSandbox.computerUse.keyboard.press(key, modifiers)
        return { success: true, key, modifiers }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to press key"
        return { error: message }
      }
    },
  })

function getImageDimensions(base64?: string): {
  width?: number
  height?: number
} {
  if (!base64) return {}
  try {
    const head = Buffer.from(base64.slice(0, 48), "base64")
    if (
      head.length >= 24 &&
      head[0] === 0x89 &&
      head[1] === 0x50 &&
      head[2] === 0x4e &&
      head[3] === 0x47
    ) {
      return {
        width: head.readUInt32BE(16),
        height: head.readUInt32BE(20),
      }
    }
  } catch {
    // fallback if unparseable
  }
  return {}
}

export const createViewScreenTool = (sandbox?: SandboxProvider) =>
  tool({
    description:
      "Take a screenshot to view what is currently on the screen. Use this when YOU (the agent) need to inspect the screen to decide what to do next. This is for your internal inspection only and is never rendered in chat.",
    inputSchema: z.object({}),
    execute: async () => {
      const activeSandbox = await resolveSandbox(sandbox)
      if (!activeSandbox)
        return { error: "No active sandbox environment available." }
      try {
        await ensureComputerUse(activeSandbox)
        const screenshot =
          await activeSandbox.computerUse.screenshot.takeFullScreen()
        const dimensions = getImageDimensions(screenshot.screenshot)
        return {
          screenshot: screenshot.screenshot, // base64
          width: dimensions.width,
          height: dimensions.height,
          sizeBytes: screenshot.sizeBytes,
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to capture screen"
        return { error: message }
      }
    },
    toModelOutput: ({
      output,
    }: {
      output?: {
        screenshot?: string
        width?: number
        height?: number
        error?: string
      }
    }) => {
      if (!output || output.error || !output.screenshot) {
        return {
          type: "text",
          value: output?.error || "Failed to capture screen",
        }
      }
      const dimensionsText =
        output.width && output.height
          ? ` (${output.width}x${output.height})`
          : ""
      return {
        type: "content",
        value: [
          {
            type: "text",
            text: `Current screen screenshot${dimensionsText}:`,
          },
          {
            type: "image-data",
            mediaType: "image/png",
            data: output.screenshot,
          },
        ],
      }
    },
  })

export const createShowScreenTool = (sandbox?: SandboxProvider) =>
  tool({
    description:
      "Take a screenshot of the current screen to show to the user in the chat. Use this when the user asks what is on the screen or asks to see the screen. This is rendered in the chat for the user.",
    inputSchema: z.object({}),
    execute: async () => {
      const activeSandbox = await resolveSandbox(sandbox)
      if (!activeSandbox)
        return { error: "No active sandbox environment available." }
      try {
        await ensureComputerUse(activeSandbox)
        const screenshot =
          await activeSandbox.computerUse.screenshot.takeFullScreen()
        const dimensions = getImageDimensions(screenshot.screenshot)
        return {
          screenshot: screenshot.screenshot,
          width: dimensions.width,
          height: dimensions.height,
          sizeBytes: screenshot.sizeBytes,
          mediaType: "image/png",
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to capture screen for user"
        return { error: message }
      }
    },
    toModelOutput: ({
      output,
    }: {
      output?: {
        screenshot?: string
        width?: number
        height?: number
        error?: string
      }
    }) => {
      if (!output || output.error || !output.screenshot) {
        return {
          type: "text",
          value: output?.error || "Failed to capture screen for user",
        }
      }
      const dimensionsText =
        output.width && output.height
          ? ` (${output.width}x${output.height})`
          : ""
      return {
        type: "text",
        value: `Screen screenshot captured and displayed to user${dimensionsText}.`,
      }
    },
  })

export function createHandoffTool(
  availableBots: Array<{
    id: string
    name: string
    job: string
    instructions?: string | null
    avatar?: string | null
    sandboxId?: string | null
  }>,
  onHandoff?: (targetBot: {
    id: string
    name: string
    job: string
    instructions?: string | null
    avatar?: string | null
    sandboxId?: string | null
  }) => void
) {
  return tool({
    description:
      "Hand off the conversation to another teammate bot in this group chat ONLY when the user's prompt specifically belongs to that teammate's domain specialty, or if the user explicitly addresses that teammate. DO NOT use handoff if your memory is empty or missing information—answer directly yourself.",
    inputSchema: z.object({
      targetBotName: z
        .string()
        .describe(
          "The exact name of the teammate bot in this group chat to hand off the conversation to"
        ),
      reason: z
        .string()
        .describe(
          "The clear reason explaining why this teammate is better suited to handle the user's prompt"
        ),
    }),
    execute: async ({ targetBotName, reason }) => {
      const normalizedTarget = targetBotName.trim().toLowerCase()
      const targetBot = availableBots.find(
        (b) =>
          b.name.trim().toLowerCase() === normalizedTarget ||
          b.id === targetBotName.trim()
      )

      if (!targetBot) {
        const botList = availableBots
          .map((b) => `"${b.name}" (${b.job})`)
          .join(", ")
        return {
          success: false,
          error: `Teammate "${targetBotName}" was not found in this group chat. Available teammates are: ${botList}.`,
        }
      }

      if (onHandoff) {
        onHandoff(targetBot)
      }

      const cleanReason = reason
        .replace(/MEMORY\.md/gi, "memory")
        .replace(/\b1:1\s+(chat|conversation)s?\b/gi, "past conversations")

      return {
        success: true,
        targetBotId: targetBot.id,
        targetBotName: targetBot.name,
        targetBotJob: targetBot.job,
        reason: cleanReason,
        directive: `Handoff successful! You have handed off the conversation to ${targetBot.name} (${targetBot.job}). In the immediate next step, respond directly to the user's prompt as ${targetBot.name}. Adopt ${targetBot.name}'s persona, instructions, and domain expertise (${targetBot.instructions || targetBot.job}). If the user asks about personal preferences, past discussions, or prior work, consult your memory by calling recallMemory. Speak naturally (e.g. "From my memory...", "I recall...") and NEVER mention "MEMORY.md", files, sandboxes, or technical details to the user. Provide the complete, high-quality answer to the user. Do not call handoff again.`,
      }
    },
  })
}

export function createComputerUseTools(sandbox?: SandboxProvider) {
  return {
    recallMemory: createRecallMemoryTool(sandbox),
    updateMemory: createUpdateMemoryTool(sandbox),
    bash: createBashTool(sandbox),
    readFile: createReadFileTool(sandbox),
    writeFile: createWriteFileTool(sandbox),
    listFiles: createListFilesTool(sandbox),
    mouseClick: createMouseClickTool(sandbox),
    mouseMove: createMouseMoveTool(sandbox),
    mouseScroll: createMouseScrollTool(sandbox),
    keyboardType: createKeyboardTypeTool(sandbox),
    keyboardPress: createKeyboardPressTool(sandbox),
    viewScreen: createViewScreenTool(sandbox),
    showScreen: createShowScreenTool(sandbox),
  }
}

export interface Handoff {
  botId: string
  name: string
  job?: string
}

export function createHandoffTool(
  handoff: (botId: string) => Handoff | Promise<Handoff>
) {
  return tool({
    description:
      "Hand the person's request to another teammate in this group chat, when it belongs to their job rather than yours. They take over and answer in your place, so call this instead of answering.",
    inputSchema: z.object({
      botId: z
        .string()
        .describe(
          "The id of the teammate to hand off to, from the list of teammates in this chat"
        ),
      note: z
        .string()
        .optional()
        .describe("What the teammate should do, in a sentence or two"),
    }),
    execute: async ({ botId }) => handoff(botId),
  })
}
