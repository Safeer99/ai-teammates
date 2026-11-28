"use client"

import * as React from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { nanoid } from "nanoid"
import { Loader2Icon, ShuffleIcon, Trash2Icon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ChatAvatar } from "@/components/chat-avatar"
import { createBot, deleteBot, updateBot } from "@/action/bot"
import { toast } from "@/components/ui/toast"
import { useBillingGate } from "@/hooks/use-billing-toast"
import { isPlanRequiredError } from "@/lib/billing"
import { isUsageLimitError } from "@/lib/usage"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

export const botFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  job: z.string().min(1, "Job is required"),
  instructions: z.string().optional(),
  avatar: z.string().min(1, "Avatar is required"),
})

export type BotFormValues = z.infer<typeof botFormSchema>

const PRESETS = [
  {
    label: "Research assistant",
    name: "Ada",
    job: "Research assistant",
    instructions:
      "Answer briefly, cite sources, and ask before running anything destructive.",
  },
  {
    label: "Code reviewer",
    name: "Alan",
    job: "Code reviewer",
    instructions:
      "Review code for correctness, security vulnerabilities, edge cases, and architectural best practices.",
  },
  {
    label: "Writing editor",
    name: "Ernest",
    job: "Writing editor",
    instructions:
      "Proofread text, polish tone and flow, fix grammatical errors, and ensure clear, concise communication.",
  },
  {
    label: "Tutor",
    name: "Socrates",
    job: "Tutor",
    instructions:
      "Break down difficult concepts step-by-step, use intuitive analogies, and ask thought-provoking questions.",
  },
] as const

export type BotData = {
  id: string
  name: string
  job: string
  instructions?: string | null
  avatar?: string
}

export interface BotDialogProps {
  bot?: BotData | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  children?: React.ReactNode
  onSuccess?: (chatId?: string) => void
}

export function BotDialog({
  bot,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
  children,
  onSuccess,
}: BotDialogProps) {
  const router = useRouter()
  const { ensurePaidPlan, showUpgradeToast, showUsageLimitToast } =
    useBillingGate()
  const isEdit = Boolean(bot?.id)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = isControlled ? setControlledOpen! : setUncontrolledOpen

  const [serverError, setServerError] = React.useState<string | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const defaultAvatar = React.useMemo(
    () => bot?.avatar || nanoid(),
    [bot?.avatar]
  )

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BotFormValues>({
    resolver: zodResolver(botFormSchema),
    defaultValues: {
      name: bot?.name ?? "",
      job: bot?.job ?? "",
      instructions: bot?.instructions ?? "",
      avatar: bot?.avatar || defaultAvatar,
    },
  })

  const watchedAvatar = useWatch({ control, name: "avatar" })
  const watchedName = useWatch({ control, name: "name" })
  const watchedJob = useWatch({ control, name: "job" })
  const watchedInstructions = useWatch({ control, name: "instructions" })

  const avatarSeed = watchedAvatar || bot?.avatar || defaultAvatar

  const activePreset = React.useMemo(() => {
    const match = PRESETS.find(
      (p) =>
        p.name === watchedName &&
        p.job === watchedJob &&
        (p.instructions ?? "").trim() === (watchedInstructions ?? "").trim()
    )
    return match ? match.label : null
  }, [watchedName, watchedJob, watchedInstructions])

  // Keep form in sync when bot or open state changes
  React.useEffect(() => {
    if (open) {
      if (bot) {
        reset({
          name: bot.name,
          job: bot.job,
          instructions: bot.instructions ?? "",
          avatar: bot.avatar || nanoid(),
        })
      } else {
        reset({
          name: "",
          job: "",
          instructions: "",
          avatar: nanoid(),
        })
      }
    }
  }, [open, bot, reset])

  // Reset form when dialog opens/closes
  const handleOpenChange = (nextOpen: boolean) => {
    if (
      nextOpen &&
      !isEdit &&
      !ensurePaidPlan("A paid plan is required to create bots and sandboxes.")
    ) {
      return
    }
    setServerError(null)
    setConfirmDeleteOpen(false)
    if (!nextOpen) {
      if (bot) {
        reset({
          name: bot.name,
          job: bot.job,
          instructions: bot.instructions ?? "",
          avatar: bot.avatar || nanoid(),
        })
      } else {
        reset({
          name: "",
          job: "",
          instructions: "",
          avatar: nanoid(),
        })
      }
    }
    setOpen(nextOpen)
  }

  const handleDelete = async () => {
    if (!bot?.id) return
    try {
      setIsDeleting(true)
      await deleteBot(bot.id)

      toast.add({
        title: "Bot deleted",
        description: `${bot.name} was successfully deleted.`,
        type: "success",
      })

      setConfirmDeleteOpen(false)
      handleOpenChange(false)
      router.push("/")
      router.refresh()
      onSuccess?.()
    } catch (err) {
      console.error("Failed to delete bot:", err)
      const message =
        err instanceof Error ? err.message : "Failed to delete bot"
      toast.add({
        title: "Failed to delete bot",
        description: message,
        type: "error",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleShuffle = () => {
    setValue("avatar", nanoid(), { shouldValidate: true })
  }

  const handleSelectPreset = (preset: (typeof PRESETS)[number]) => {
    if (activePreset === preset.label) {
      setValue("name", "", { shouldValidate: true })
      setValue("job", "", { shouldValidate: true })
      setValue("instructions", "", { shouldValidate: true })
    } else {
      setValue("name", preset.name, { shouldValidate: true })
      setValue("job", preset.job, { shouldValidate: true })
      setValue("instructions", preset.instructions, { shouldValidate: true })
    }
  }

  const onSubmit = async (values: BotFormValues) => {
    try {
      setServerError(null)
      if (isEdit && bot) {
        await updateBot({
          id: bot.id,
          name: values.name,
          job: values.job,
          instructions: values.instructions || null,
          avatar: values.avatar,
        })

        toast.add({
          title: "Bot updated",
          description: `${values.name} was successfully updated.`,
          type: "success",
        })

        handleOpenChange(false)
        router.refresh()
        onSuccess?.()
      } else {
        if (
          !ensurePaidPlan(
            "A paid plan is required to create bots and sandboxes."
          )
        ) {
          return
        }
        const result = await createBot({
          name: values.name,
          job: values.job,
          instructions: values.instructions || null,
          avatar: values.avatar,
        })

        toast.add({
          title: "Bot created",
          description: `${values.name} was successfully created.`,
          type: "success",
        })

        handleOpenChange(false)
        onSuccess?.(result?.chat?.id)
        if (result?.chat?.id) {
          router.push(`/chats/${result.chat.id}`)
        } else {
          router.refresh()
        }
      }
    } catch (err) {
      console.error(
        isEdit ? "Failed to update bot:" : "Failed to create bot:",
        err
      )
      const message =
        err instanceof Error
          ? err.message
          : isEdit
            ? "Failed to update bot"
            : "Failed to create bot"
      setServerError(message)
      if (isPlanRequiredError(err)) {
        showUpgradeToast("A paid plan is required to create bots and sandboxes.")
      } else if (isUsageLimitError(err)) {
        showUsageLimitToast(message)
      } else {
        toast.add({
          title: isEdit ? "Failed to update bot" : "Failed to create bot",
          description: message,
          type: "error",
        })
      }
    }
  }

  const triggerElement = trigger || children

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {triggerElement && (
        <DialogTrigger render={triggerElement as React.ReactElement} />
      )}
      <DialogContent className="gap-4 overflow-hidden p-6 sm:max-w-md">
        <DialogHeader className="gap-1">
          <DialogTitle className="text-base font-semibold">
            {isEdit ? "Edit bot" : "New bot"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isEdit
              ? "Update your bot's face, name, and instructions."
              : "Give it a face, a name, and a job to do."}
          </DialogDescription>
        </DialogHeader>

        {/* Template Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {PRESETS.map((preset) => {
            const isSelected = activePreset === preset.label
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all select-none",
                  isSelected
                    ? "border-foreground/80 bg-muted/60 text-foreground"
                    : "border-border/80 bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                {preset.label}
              </button>
            )
          })}
        </div>

        {/* Face Shuffle Section */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <ChatAvatar seed={avatarSeed} className="size-10 shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm leading-none font-medium">Face</span>
              <span className="mt-1 text-xs text-muted-foreground">
                Shuffle until you find one you like.
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShuffle}
            className="h-8 gap-1.5 rounded-lg border-border/80 px-3 text-xs font-medium"
          >
            <ShuffleIcon className="size-3.5" />
            Shuffle
          </Button>
        </div>

        {/* Form Fields */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-3.5"
        >
          {/* Name Field */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name" className="text-sm font-medium">
              Name
            </Label>
            <Input
              id="name"
              placeholder="Ada"
              {...register("name")}
              aria-invalid={!!errors.name}
              className="h-9"
            />
            {errors.name && (
              <span className="text-xs text-destructive">
                {errors.name.message}
              </span>
            )}
          </div>

          {/* Job Field */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job" className="text-sm font-medium">
              Job
            </Label>
            <Input
              id="job"
              placeholder="Research assistant"
              {...register("job")}
              aria-invalid={!!errors.job}
              className="h-9"
            />
            {errors.job && (
              <span className="text-xs text-destructive">
                {errors.job.message}
              </span>
            )}
          </div>

          {/* How it should work (Instructions) Field */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="instructions" className="text-sm font-medium">
              How it should work
            </Label>
            <Textarea
              id="instructions"
              rows={3}
              placeholder="Answer briefly, cite sources, and ask before running anything destructive."
              {...register("instructions")}
              className="min-h-20 resize-none text-sm"
            />
            {errors.instructions && (
              <span className="text-xs text-destructive">
                {errors.instructions.message}
              </span>
            )}
          </div>

          {serverError && (
            <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              {serverError}
            </div>
          )}

          {/* Dialog Footer */}
          <DialogFooter
            className={cn(
              "-mx-6 mt-2 -mb-6 flex flex-row items-center border-t border-border/50 bg-muted/20 px-6 py-3",
              isEdit
                ? "justify-between sm:justify-between"
                : "justify-end sm:justify-end"
            )}
          >
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={isSubmitting || isDeleting}
              >
                <Trash2Icon className="mr-1.5 size-4" />
                Delete
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting || isDeleting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isDeleting}>
                {isSubmitting ? (
                  <>
                    <Loader2Icon className="mr-1.5 size-4 animate-spin" />
                    {isEdit ? "Updating..." : "Creating..."}
                  </>
                ) : isEdit ? (
                  "Update bot"
                ) : (
                  "Create bot"
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      {isEdit && bot && (
        <AlertDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {bot.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this bot and its conversation
                history. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2Icon className="mr-1.5 size-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete bot"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Dialog>
  )
}

export default BotDialog
