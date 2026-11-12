import * as React from "react"
import Image, { type ImageProps } from "next/image"
import { Avatar, Style } from "@dicebear/core"
import gazeDefinition from "@dicebear/styles/gaze.json"
import { cn } from "cn"

const gazeStyle = new Style(gazeDefinition)
const avatarCache = new Map<string, string>()

function getAvatarDataUri(seed: string, animated?: boolean): string {
  const key = `${seed}:${animated ? "1" : "0"}`
  const cached = avatarCache.get(key)
  if (cached) {
    return cached
  }

  const uri = new Avatar(gazeStyle, {
    seed,
    ...(animated
      ? { animationVariant: ["fast", "medium", "slow"] }
      : { animationVariant: ["none"] }),
  }).toDataUri()

  avatarCache.set(key, uri)
  return uri
}

export interface ChatAvatarProps
  extends Omit<ImageProps, "src" | "alt" | "width" | "height"> {
  seed: string
  animated?: boolean
  className?: string
  alt?: string
}

export function ChatAvatar({
  seed,
  animated = false,
  className,
  alt,
  ...props
}: ChatAvatarProps) {
  const src = getAvatarDataUri(seed, animated)

  return (
    <Image
      src={src}
      alt={alt ?? `${seed}'s avatar`}
      width={32}
      height={32}
      unoptimized
      className={cn("size-8 shrink-0 rounded-full", className)}
      {...props}
    />
  )
}

export default ChatAvatar
