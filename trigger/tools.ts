import type { Sandbox } from "@daytona/sdk"
import { tool } from "ai"
import { z } from "zod"

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

export const createBashTool = (sandbox?: Sandbox | null) =>
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
      if (!sandbox) return { error: "No active sandbox environment available." }
      try {
        await ensureSandboxReady(sandbox)
        const response = await sandbox.process.executeCommand(command)
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

export const createReadFileTool = (sandbox?: Sandbox | null) =>
  tool({
    description: "Read the contents of a file from the sandbox filesystem.",
    inputSchema: z.object({
      path: z.string().describe("Path to the file to read in the sandbox"),
    }),
    execute: async ({ path }) => {
      if (!sandbox) return { error: "No active sandbox environment available." }
      try {
        await ensureSandboxReady(sandbox)
        const buffer = await sandbox.fs.downloadFile(path)
        return {
          content: buffer.toString("utf8"),
          path,
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

export const createWriteFileTool = (sandbox?: Sandbox | null) =>
  tool({
    description:
      "Create or overwrite a file with the given content in the sandbox filesystem.",
    inputSchema: z.object({
      path: z.string().describe("Path to the file to write in the sandbox"),
      content: z.string().describe("The text content to write into the file"),
    }),
    execute: async ({ path, content }) => {
      if (!sandbox) return { error: "No active sandbox environment available." }
      try {
        await ensureSandboxReady(sandbox)
        await sandbox.fs.uploadFile(Buffer.from(content, "utf8"), path)
        return {
          success: true,
          path,
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

export const createListFilesTool = (sandbox?: Sandbox | null) =>
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
      if (!sandbox) return { error: "No active sandbox environment available." }
      try {
        await ensureSandboxReady(sandbox)
        const files = await sandbox.fs.listFiles(path || "")
        return {
          path: path || ".",
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

export const createMouseClickTool = (sandbox?: Sandbox | null) =>
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
      if (!sandbox) return { error: "No active sandbox environment available." }
      try {
        await ensureComputerUse(sandbox)
        const res = await sandbox.computerUse.mouse.click(x, y, button, double)
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

export const createMouseMoveTool = (sandbox?: Sandbox | null) =>
  tool({
    description:
      "Move the mouse cursor to the specified (x, y) coordinates on the desktop screen.",
    inputSchema: z.object({
      x: z.number().describe("X coordinate to move to"),
      y: z.number().describe("Y coordinate to move to"),
    }),
    execute: async ({ x, y }) => {
      if (!sandbox) return { error: "No active sandbox environment available." }
      try {
        await ensureComputerUse(sandbox)
        const res = await sandbox.computerUse.mouse.move(x, y)
        return { success: true, x: res.x, y: res.y }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to move mouse"
        return { error: message }
      }
    },
  })

export const createMouseScrollTool = (sandbox?: Sandbox | null) =>
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
      if (!sandbox) return { error: "No active sandbox environment available." }
      try {
        await ensureComputerUse(sandbox)
        await sandbox.computerUse.mouse.scroll(x, y, direction, amount)
        return { success: true, x, y, direction, amount }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to scroll mouse"
        return { error: message }
      }
    },
  })

export const createKeyboardTypeTool = (sandbox?: Sandbox | null) =>
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
      if (!sandbox) return { error: "No active sandbox environment available." }
      try {
        await ensureComputerUse(sandbox)
        await sandbox.computerUse.keyboard.type(text, delay)
        return { success: true, text }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to type text"
        return { error: message }
      }
    },
  })

export const createKeyboardPressTool = (sandbox?: Sandbox | null) =>
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
      if (!sandbox) return { error: "No active sandbox environment available." }
      try {
        await ensureComputerUse(sandbox)
        await sandbox.computerUse.keyboard.press(key, modifiers)
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

export const createViewScreenTool = (sandbox?: Sandbox | null) =>
  tool({
    description:
      "Take a screenshot to view what is currently on the screen. Use this when YOU (the agent) need to inspect the screen to decide what to do next. This is for your internal inspection only and is never rendered in chat.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!sandbox) return { error: "No active sandbox environment available." }
      try {
        await ensureComputerUse(sandbox)
        const screenshot = await sandbox.computerUse.screenshot.takeFullScreen()
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

export const createShowScreenTool = (sandbox?: Sandbox | null) =>
  tool({
    description:
      "Take a screenshot of the current screen to show to the user in the chat. Use this when the user asks what is on the screen or asks to see the screen. This is rendered in the chat for the user.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!sandbox) return { error: "No active sandbox environment available." }
      try {
        await ensureComputerUse(sandbox)
        const screenshot = await sandbox.computerUse.screenshot.takeFullScreen()
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
  }>,
  onHandoff?: (targetBot: {
    id: string
    name: string
    job: string
    instructions?: string | null
    avatar?: string | null
  }) => void
) {
  return tool({
    description:
      "Hand off the conversation to another teammate bot in this group chat who is better suited to answer the user's prompt based on their domain, specialty, and role. Once called, the target teammate will take over and answer the prompt.",
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

      return {
        success: true,
        targetBotId: targetBot.id,
        targetBotName: targetBot.name,
        targetBotJob: targetBot.job,
        reason,
        directive: `Handoff successful! You have handed off the conversation to ${targetBot.name} (${targetBot.job}). In the immediate next step, respond directly to the user's prompt as ${targetBot.name}. Adopt ${targetBot.name}'s persona, instructions, and domain expertise (${targetBot.instructions || targetBot.job}). Provide the complete, high-quality answer to the user. Do not call handoff again.`,
      }
    },
  })
}

export function createComputerUseTools(sandbox?: Sandbox | null) {
  return {
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
