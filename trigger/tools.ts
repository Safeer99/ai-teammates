import type { Sandbox } from "@daytona/sdk"
import { tool } from "ai"
import { z } from "zod"

export type SandboxSource =
  | Sandbox
  | (() => Promise<Sandbox | null>)
  | null
  | undefined

async function resolveSandbox(source: SandboxSource): Promise<Sandbox | null> {
  if (!source) return null
  if (typeof source === "function") {
    return source()
  }
  return source
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

export const createReadFileTool = (sandboxSource?: SandboxSource) =>
  tool({
    description: "Read the contents of a file from the sandbox filesystem.",
    inputSchema: z.object({
      path: z.string().describe("Path to the file to read in the sandbox"),
    }),
    execute: async ({ path }) => {
      const sandbox = await resolveSandbox(sandboxSource)
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

export const createWriteFileTool = (sandboxSource?: SandboxSource) =>
  tool({
    description:
      "Create or overwrite a file with the given content in the sandbox filesystem.",
    inputSchema: z.object({
      path: z.string().describe("Path to the file to write in the sandbox"),
      content: z.string().describe("The text content to write into the file"),
    }),
    execute: async ({ path, content }) => {
      const sandbox = await resolveSandbox(sandboxSource)
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

export const createRecallMemoryTool = (sandboxSource?: SandboxSource) =>
  tool({
    description:
      "Recall your persistent long-term memory from MEMORY.md in your sandbox. Use this to remember facts, user preferences, personal details, project context, and past conversations.",
    inputSchema: z.object({}),
    execute: async () => {
      const sandbox = await resolveSandbox(sandboxSource)
      if (!sandbox) return { error: "No active sandbox environment available." }
      try {
        await ensureSandboxReady(sandbox)
        const buffer = await sandbox.fs.downloadFile("MEMORY.md")
        return {
          memory: buffer.toString("utf8"),
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to recall memory"
        return { error: message }
      }
    },
  })

export const createUpdateMemoryTool = (sandboxSource?: SandboxSource) =>
  tool({
    description:
      "Save or update your persistent long-term memory in MEMORY.md. Call this whenever the user shares preferences, likes/dislikes, personal details, project context, or decisions, or asks you to remember something.",
    inputSchema: z.object({
      content: z
        .string()
        .min(1)
        .describe(
          "The memory entry in concise markdown (e.g. '- Favorite movie: Dune')."
        ),
      mode: z
        .enum(["append", "replace"])
        .default("append")
        .describe(
          "Use 'append' to add new information to existing memory, or 'replace' to overwrite the entire MEMORY.md."
        ),
    }),
    execute: async ({ content, mode }) => {
      const sandbox = await resolveSandbox(sandboxSource)
      if (!sandbox) return { error: "No active sandbox environment available." }
      try {
        await ensureSandboxReady(sandbox)
        let nextContent: string
        if (mode === "append") {
          let existing = ""
          try {
            const buffer = await sandbox.fs.downloadFile("MEMORY.md")
            existing = buffer.toString("utf8")
          } catch {
            existing = ""
          }
          nextContent = existing.trim()
            ? `${existing.trimEnd()}\n${content.trim()}\n`
            : `${content.trim()}\n`
        } else {
          nextContent = `${content.trimEnd()}\n`
        }
        await sandbox.fs.uploadFile(Buffer.from(nextContent, "utf8"), "MEMORY.md")
        return {
          success: true,
          mode,
          bytesWritten: Buffer.byteLength(nextContent, "utf8"),
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update memory"
        return { error: message }
      }
    },
  })

export function createComputerUseTools(sandbox?: Sandbox | null) {
  return {
    bash: createBashTool(sandbox),
    readFile: createReadFileTool(sandbox),
    writeFile: createWriteFileTool(sandbox),
    listFiles: createListFilesTool(sandbox),
    recallMemory: createRecallMemoryTool(sandbox),
    updateMemory: createUpdateMemoryTool(sandbox),
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
