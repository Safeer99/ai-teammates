"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2Icon, Trash2Icon } from "lucide-react"

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
import { Checkbox } from "@/components/ui/checkbox"
import { ChatAvatar } from "@/components/chat-avatar"
import {
  createGroupChat,
  deleteGroupChat,
  updateGroupChat,
} from "@/action/chat"
import { toast } from "@/components/ui/toast"
import { useBillingGate } from "@/hooks/use-billing-toast"
import { isPlanRequiredError } from "@/lib/billing"
import { cn } from "@/lib/utils"

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

export interface GroupChatData {
  id: string
  name?: string | null
  botIds: string[]
}

export interface GroupChatDialogProps {
  chat?: GroupChatData | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  children?: React.ReactNode
  bots?: GroupChatBotItem[]
  onSuccess?: (chatId?: string) => void
}

export function GroupChatDialog({
  chat,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
  children,
  bots = [],
  onSuccess,
}: GroupChatDialogProps) {
  const router = useRouter()
  const { ensurePaidPlan, showUpgradeToast } = useBillingGate()
  const isEdit = Boolean(chat?.id)
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

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
      name: chat?.name ?? "",
      botIds: chat?.botIds ?? [],
    },
  })

  const selectedBotIds = useWatch({ control, name: "botIds" }) || []

  React.useEffect(() => {
    if (open) {
      reset({
        name: chat?.name ?? "",
        botIds: chat?.botIds ?? [],
      })
    }
  }, [open, chat, reset])

  const onOpenChange = (newOpen: boolean) => {
    if (
      newOpen &&
      !isEdit &&
      !ensurePaidPlan("A paid plan is required to create group chats with bots.")
    ) {
      return
    }
    setServerError(null)
    setConfirmDeleteOpen(false)
    if (!newOpen) {
      reset({
        name: chat?.name ?? "",
        botIds: chat?.botIds ?? [],
      })
    }
    if (isControlled) {
      setControlledOpen?.(newOpen)
    } else {
      setInternalOpen(newOpen)
    }
  }

  const handleDelete = async () => {
    if (!chat?.id) return
    try {
      setIsDeleting(true)
      await deleteGroupChat(chat.id)

      toast.add({
        title: "Group chat deleted",
        description: `${chat.name || "Group chat"} was successfully deleted.`,
        type: "success",
      })

      setConfirmDeleteOpen(false)
      onOpenChange(false)
      router.push("/")
      router.refresh()
      onSuccess?.()
    } catch (error) {
      console.error("Failed to delete group chat:", error)
      const message =
        error instanceof Error ? error.message : "Failed to delete group chat"
      toast.add({
        title: "Failed to delete group chat",
        description: message,
        type: "error",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const onSubmit = async (values: GroupChatFormValues) => {
    try {
      setServerError(null)
      if (isEdit && chat) {
        await updateGroupChat({
          chatId: chat.id,
          name: values.name,
          botIds: values.botIds,
        })
        toast.add({
          title: "Group chat updated",
          description: `Successfully updated "${values.name}".`,
          type: "success",
        })
        onOpenChange(false)
        router.refresh()
        onSuccess?.(chat.id)
      } else {
        const result = await createGroupChat(values)
        toast.add({
          title: "Group chat created",
          description: `Successfully created "${values.name}".`,
          type: "success",
        })
        onOpenChange(false)
        onSuccess?.(result.chatId)
        router.push(`/chats/${result.chatId}`)
      }
    } catch (error) {
      console.error(
        isEdit
          ? "Failed to update group chat:"
          : "Failed to create group chat:",
        error
      )
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred."
      setServerError(message)
      if (isPlanRequiredError(error)) {
        showUpgradeToast(
          "A paid plan is required to create group chats with bots."
        )
      } else {
        toast.add({
          title: isEdit
            ? "Failed to update group chat"
            : "Failed to create group chat",
          description: message,
          type: "error",
        })
      }
    }
  }

  const triggerElement = trigger || children

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {triggerElement && (
        <DialogTrigger render={triggerElement as React.ReactElement} />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {isEdit ? "Edit group chat" : "New group chat"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isEdit
              ? "Update the group name, members, or delete this group chat."
              : "Name the group and pick which bots are in it."}
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

          {serverError && (
            <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              {serverError}
            </div>
          )}

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
                onClick={() => onOpenChange(false)}
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
                  "Update group"
                ) : (
                  "Create group"
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      {isEdit && chat && (
        <AlertDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {chat.name || "group chat"}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this group chat and its
                conversation history. This action cannot be undone.
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
                  "Delete group"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Dialog>
  )
}

export default GroupChatDialog
