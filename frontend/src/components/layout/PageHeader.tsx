/* oxlint-disable react/only-export-components -- provider, slots and header belong together */
// Lets a page put its own title and controls into the shared top bar.
//
// The top bar lives in AppShell, but its contents are page-specific and often
// live (a room's title, its state). So the shell renders two empty slot
// elements and <PageHeader> portals the page's own JSX into them. That JSX
// stays part of the page's React tree, so it always reflects the page's state.
import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface SlotContextValue {
  titleEl: HTMLElement | null
  actionsEl: HTMLElement | null
  setTitleEl: (el: HTMLElement | null) => void
  setActionsEl: (el: HTMLElement | null) => void
}

const SlotContext = createContext<SlotContextValue | null>(null)

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [titleEl, setTitleEl] = useState<HTMLElement | null>(null)
  const [actionsEl, setActionsEl] = useState<HTMLElement | null>(null)
  const value = useMemo(() => ({ titleEl, actionsEl, setTitleEl, setActionsEl }), [titleEl, actionsEl])
  return <SlotContext.Provider value={value}>{children}</SlotContext.Provider>
}

/** The two slot elements. Rendered once, inside the top bar. */
export function PageHeaderSlots() {
  const ctx = useContext(SlotContext)
  if (!ctx) return null
  const { setTitleEl, setActionsEl } = ctx
  return (
    <>
      <div ref={setTitleEl} className="flex min-w-0 flex-1 items-center gap-2 text-sm" />
      <div ref={setActionsEl} className="flex shrink-0 items-center gap-2" />
    </>
  )
}

/** Rendered by a page: its title, plus optional controls for the right side. */
export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  const ctx = useContext(SlotContext)
  if (!ctx) return null
  return (
    <>
      {ctx.titleEl && createPortal(title, ctx.titleEl)}
      {ctx.actionsEl && children ? createPortal(children, ctx.actionsEl) : null}
    </>
  )
}
