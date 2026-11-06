import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LIMITS } from '@/lib/limits'

/** Pins (or replaces) the question shown at the top of the chat. */
export function PinDialog({
  open,
  onOpenChange,
  current,
  onPin,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: string | null
  onPin: (question: string) => void
}) {
  // The parent remounts this dialog (key) each time it opens, so the draft
  // always starts from the question that is pinned now.
  const [draft, setDraft] = useState(current ?? '')
  const trimmed = draft.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (trimmed) onPin(trimmed)
          }}
        >
          <DialogHeader>
            <DialogTitle>{current ? 'Edit the pinned question' : 'Pin a question'}</DialogTitle>
            <DialogDescription>Everyone in the room sees it at the top of the chat.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="pin-question">Question</Label>
            <Textarea
              id="pin-question"
              value={draft}
              autoFocus
              placeholder="Reverse a linked list in place."
              maxLength={LIMITS.text}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!trimmed}>
              Pin question
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
