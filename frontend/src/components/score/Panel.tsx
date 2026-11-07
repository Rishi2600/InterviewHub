import type { ReactNode } from 'react'

/** A bordered card with a titled header row, as the profile sections use. */
export function Panel({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-5 py-3.5">
        <h2 className="text-base font-semibold">{title}</h2>
        {extra && <span className="ml-auto text-xs text-muted-foreground">{extra}</span>}
      </div>
      {children}
    </section>
  )
}
