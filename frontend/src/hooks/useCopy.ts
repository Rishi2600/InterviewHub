import { toast } from 'sonner'
import { copyToClipboard } from '@/lib/utils'

/** Copies text and confirms with a toast. */
export function useCopy() {
  return async (text: string, what = 'Copied') => {
    if (await copyToClipboard(text)) toast.success(what)
    else toast.error('Could not copy. Select the text and copy it manually.')
  }
}
