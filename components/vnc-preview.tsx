"use client"

import * as React from "react"
import { Maximize2Icon, MonitorIcon, RotateCwIcon, XIcon } from "lucide-react"

import { getChatVncUrl } from "@/action/daytona"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export interface VncPreviewProps {
  chatId: string
  botName?: string | null
  className?: string
}

export function VncPreview({
  chatId,
  botName = "Assistant",
  className,
}: VncPreviewProps) {
  const [vncUrl, setVncUrl] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [resolvedBotName, setResolvedBotName] = React.useState(botName || "Assistant")

  const iframeRef = React.useRef<HTMLIFrameElement | null>(null)

  React.useEffect(() => {
    let isCancelled = false

    getChatVncUrl(chatId)
      .then((result) => {
        if (isCancelled) return
        if (result.error) {
          setError(result.error)
        } else if (result.url) {
          setVncUrl(result.url)
          if (result.botName) {
            setResolvedBotName(result.botName)
          }
        }
      })
      .catch((err) => {
        if (isCancelled) return
        setError(
          err instanceof Error ? err.message : "Failed to load VNC preview"
        )
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [chatId])

  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true)
    setError(null)
    try {
      const result = await getChatVncUrl(chatId)
      if (result.error) {
        setError(result.error)
      } else if (result.url) {
        setVncUrl(result.url)
        if (result.botName) {
          setResolvedBotName(result.botName)
        }
        if (iframeRef.current) {
          iframeRef.current.src = result.url
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh VNC preview"
      )
    } finally {
      setIsRefreshing(false)
    }
  }, [chatId])

  const handleOpenChange = React.useCallback(
    (open: boolean, details?: { reason?: string }) => {
      // Prevent dialog from being closed by any hotkeys (Escape, etc.) or outside inputs
      if (!open && details && details.reason !== "closePress") {
        return
      }
      setIsFullscreen(open)
    },
    []
  )

  const displayName = resolvedBotName || botName || "Assistant"

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-y-auto bg-background p-4 text-foreground",
        className
      )}
    >
      {/* Top action bar with Refresh button */}
      <div className="flex h-10 w-full shrink-0 items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing}
          className="size-8 text-muted-foreground hover:text-foreground"
          title="Refresh screen"
        >
          <RotateCwIcon
            className={cn("size-4", isRefreshing && "animate-spin")}
          />
          <span className="sr-only">Refresh preview</span>
        </Button>
      </div>

      {/* Main Preview Container - Aligned to top */}
      <div className="flex flex-1 flex-col items-center justify-start px-2 pt-2 pb-6">
        {isLoading && !vncUrl ? (
          <div className="flex aspect-4/3 w-full max-w-sm flex-col items-center justify-center gap-3 rounded-2xl border border-border/40 bg-muted/20 p-6 text-center shadow-inner">
            <Spinner className="size-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Connecting to {displayName}&apos;s screen...
            </span>
          </div>
        ) : error && !vncUrl ? (
          <div className="flex aspect-4/3 w-full max-w-sm flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center shadow-inner">
            <MonitorIcon className="size-8 text-muted-foreground/60" />
            <p className="line-clamp-2 text-xs text-muted-foreground">{error}</p>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleRefresh}
            >
              Retry connection
            </Button>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center">
            {/* Placeholder when iframe is positioned in fullscreen modal to prevent layout jump */}
            {isFullscreen && (
              <div className="aspect-4/3 w-full max-w-sm rounded-2xl border border-dashed border-border/40 bg-muted/10 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">
                  Preview opened in fullscreen
                </span>
              </div>
            )}

            {/* Backdrop behind fullscreen modal */}
            {isFullscreen && (
              <div
                className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm animate-in fade-in-0 duration-200"
                aria-hidden="true"
                onClick={(e) => {
                  // Prevent clicks outside from dismissing the VNC session
                  e.stopPropagation()
                }}
              />
            )}

            {/* Persistent VNC Container - seamlessly transitions between inline preview and fullscreen dialog */}
            <div
              role={isFullscreen ? "dialog" : "button"}
              aria-modal={isFullscreen ? "true" : undefined}
              aria-label={`${displayName}'s screen preview`}
              tabIndex={isFullscreen ? -1 : 0}
              onClick={() => {
                if (!isFullscreen) setIsFullscreen(true)
              }}
              onKeyDown={(e) => {
                if (!isFullscreen && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault()
                  setIsFullscreen(true)
                }
                // Stop hotkeys like Escape from closing the dialog or bubbling up
                if (isFullscreen) {
                  e.stopPropagation()
                }
              }}
              className={cn(
                isFullscreen
                  ? "fixed inset-3 z-50 flex flex-col rounded-xl border border-border bg-background shadow-2xl overflow-hidden outline-none sm:inset-6 md:inset-8 animate-in zoom-in-95 duration-200"
                  : "group relative aspect-4/3 w-full max-w-sm cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-black shadow-lg transition-all hover:border-primary/50 hover:shadow-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              )}
            >
              {/* Fullscreen Header */}
              {isFullscreen && (
                <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/60 bg-muted/40 px-4">
                  <div className="flex items-center gap-2.5">
                    <MonitorIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {displayName}&apos;s screen
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      title="Refresh screen"
                    >
                      <RotateCwIcon
                        className={cn("size-3.5", isRefreshing && "animate-spin")}
                      />
                      <span className="sr-only">Refresh</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsFullscreen(false)
                      }}
                      title="Close fullscreen"
                    >
                      <XIcon className="size-4" />
                      <span className="sr-only">Close</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* VNC Iframe - Mounted once and persistent */}
              <div className="relative flex-1 w-full h-full bg-black">
                {vncUrl && (
                  <iframe
                    ref={iframeRef}
                    src={vncUrl}
                    title={`${displayName}'s screen`}
                    className={cn(
                      "h-full w-full border-0 select-none",
                      isFullscreen ? "pointer-events-auto" : "pointer-events-none"
                    )}
                    allow="clipboard-read; clipboard-write; fullscreen"
                  />
                )}

                {/* Hover overlay hint when in inline preview mode */}
                {!isFullscreen && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                    <div className="flex items-center gap-1.5 rounded-lg bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow backdrop-blur">
                      <Maximize2Icon className="size-3.5" />
                      <span>Click for fullscreen</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Label below preview as shown in screenshot */}
            <span className="mt-3 text-center text-sm font-medium text-muted-foreground select-none">
              {displayName}&apos;s screen
            </span>
          </div>
        )}
      </div>

      {/* Accessible Dialog Primitive wrapper for screen reader announcements */}
      <Dialog
        open={isFullscreen}
        onOpenChange={handleOpenChange}
        modal={false}
        disablePointerDismissal
      >
        <DialogTitle className="sr-only">
          {displayName}&apos;s desktop screen
        </DialogTitle>
        <DialogDescription className="sr-only">
          Interactive Daytona VNC sandbox preview in fullscreen
        </DialogDescription>
      </Dialog>
    </div>
  )
}
