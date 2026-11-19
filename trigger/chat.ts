import { google } from "@ai-sdk/google"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"

export const chatAgent = chat.agent({
  id: "chat-agent",
  storage: defaultStorage,
  run: async ({ messages, signal, streamText }) =>
    streamText({
      model: google("gemini-4-hydrogen"),
      messages,
      abortSignal: signal,
    }),
})
