"use client"

import * as React from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { nanoid } from "nanoid"
import { Loader2Icon, ShuffleIcon } from "lucide-react"

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
import { createBot } from "@/action/bot"
import { cn } from "@/lib/utils"

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

export interface BotDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  children?: React.ReactNode
  onSuccess?: () => void
}

export function BotDialog({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
  children,
  onSuccess,
}: BotDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = isControlled ? setControlledOpen! : setUncontrolledOpen

  const [activePreset, setActivePreset] = React.useState<string | null>(null)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const defaultAvatar = React.useMemo(() => nanoid(), [])

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
      name: "",
      job: "",
      instructions: "",
      avatar: defaultAvatar,
    },
  })

  const watchedAvatar = useWatch({ control, name: "avatar" })
  const avatarSeed = watchedAvatar || defaultAvatar

  // Reset form when dialog opens/closes
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset({
        name: "",
        job: "",
        instructions: "",
        avatar: nanoid(),
      })
      setActivePreset(null)
      setServerError(null)
    }
    setOpen(nextOpen)
  }

  const handleShuffle = () => {
    setValue("avatar", nanoid(), { shouldValidate: true })
  }

  const handleSelectPreset = (preset: (typeof PRESETS)[number]) => {
    if (activePreset === preset.label) {
      setActivePreset(null)
      setValue("name", "")
      setValue("job", "")
      setValue("instructions", "")
    } else {
      setActivePreset(preset.label)
      setValue("name", preset.name, { shouldValidate: true })
      setValue("job", preset.job, { shouldValidate: true })
      setValue("instructions", preset.instructions, { shouldValidate: true })
    }
  }

  const onSubmit = async (values: BotFormValues) => {
    try {
      setServerError(null)
      await createBot({
        name: values.name,
        job: values.job,
        instructions: values.instructions || null,
        avatar: values.avatar,
      })

      handleOpenChange(false)
      onSuccess?.()
    } catch (err) {
      console.error("Failed to create bot:", err)
      setServerError(err instanceof Error ? err.message : "Failed to create bot")
    }
  }

  const triggerElement = trigger || children

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {triggerElement && <DialogTrigger render={triggerElement as React.ReactElement} />}
      <DialogContent className="sm:max-w-md p-6 gap-4 overflow-hidden">
        <DialogHeader className="gap-1">
          <DialogTitle className="text-base font-semibold">New bot</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Give it a face, a name, and a job to do.
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
              <span className="text-sm font-medium leading-none">Face</span>
              <span className="text-xs text-muted-foreground mt-1">
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
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
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
              <span className="text-xs text-destructive">{errors.name.message}</span>
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
              <span className="text-xs text-destructive">{errors.job.message}</span>
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
          <DialogFooter className="-mx-6 -mb-6 mt-2 flex flex-row items-center justify-end gap-2 border-t border-border/50 bg-muted/20 px-6 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin mr-1.5" />
                  Creating...
                </>
              ) : (
                "Create bot"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default BotDialog
