"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2Icon } from "lucide-react"

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
import { Checkbox } from "@/components/ui/checkbox"
import { ChatAvatar } from "@/components/chat-avatar"
import { createGroupChat } from "@/action/chat"
import { toast } from "@/components/ui/toast"

export const groupChatFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  botIds: z.array(z.string()).min(1, "Pick at least one bot"),
})

export type GroupChatFormValues = z.infer<typeof groupChatFormSchema>

export interface GroupChatBotItem {
  id: string
  name: string
  avatar?: string | null
}

export interface GroupChatDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  children?: React.ReactNode
  bots?: GroupChatBotItem[]
  onSuccess?: (chatId: string) => void
}

export function GroupChatDialog({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
  children,
  bots = [],
  onSuccess,
}: GroupChatDialogProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = React.useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const onOpenChange = (newOpen: boolean) => {
    if (isControlled) {
      setControlledOpen?.(newOpen)
    } else {
      setInternalOpen(newOpen)
    }
  }

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GroupChatFormValues>({
    resolver: zodResolver(groupChatFormSchema),
    defaultValues: {
      name: "",
      botIds: [],
    },
  })

  const selectedBotIds = useWatch({ control, name: "botIds" }) || []

  React.useEffect(() => {
    if (!open) {
      reset({
        name: "",
        botIds: [],
      })
    }
  }, [open, reset])

  const onSubmit = async (values: GroupChatFormValues) => {
    try {
      const result = await createGroupChat(values)
      toast.add({
        title: "Group chat created",
        description: `Successfully created "${values.name}".`,
      })
      onOpenChange(false)
      onSuccess?.(result.chatId)
      router.push(`/chats/${result.chatId}`)
    } catch (error) {
      console.error("Failed to create group chat:", error)
      toast.add({
        title: "Failed to create group chat",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger render={trigger as React.ReactElement} /> : children}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            New group chat
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Name the group and pick which bots are in it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="group-name" className="text-sm font-medium">
              Name
            </Label>
            <Input
              id="group-name"
              placeholder="Weekend plans"
              {...register("name")}
              aria-invalid={Boolean(errors.name)}
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Bots</Label>
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
              {bots.length === 0 ? (
                <p className="py-2 text-xs text-muted-foreground">
                  No bots available. Create a bot first!
                </p>
              ) : (
                bots.map((bot) => {
                  const isChecked = selectedBotIds.includes(bot.id)
                  return (
                    <label
                      key={bot.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50 select-none"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setValue("botIds", [...selectedBotIds, bot.id], {
                              shouldValidate: true,
                            })
                          } else {
                            setValue(
                              "botIds",
                              selectedBotIds.filter((id) => id !== bot.id),
                              { shouldValidate: true }
                            )
                          }
                        }}
                      />
                      <ChatAvatar
                        seed={bot.avatar || bot.id}
                        className="size-6 shrink-0"
                      />
                      <span className="text-sm font-medium text-foreground">
                        {bot.name}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
            {errors.botIds && (
              <p className="text-xs text-destructive">
                {errors.botIds.message}
              </p>
            )}
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              Create group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default GroupChatDialog
