import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Search } from 'lucide-react'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { AppSidebar } from './AppSidebar'
import { CommandMenu } from './CommandMenu'
import { PageHeaderProvider, PageHeaderSlots } from './PageHeader'
import { SEARCH_SHORTCUT } from './nav'

/** shadcn's sidebar remembers open/collapsed in this cookie. */
function sidebarDefaultOpen(): boolean {
  return !document.cookie.split('; ').includes('sidebar_state=false')
}

/** The signed-in frame: sidebar, and beside it a bordered content panel whose
 *  top bar holds the sidebar toggle, the page's title and controls, and search. */
export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen()}>
      <PageHeaderProvider>
        <AppSidebar onOpenSearch={() => setSearchOpen(true)} />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <PageHeaderSlots />
            <Button
              variant="outline"
              size="sm"
              className="hidden w-56 justify-start font-normal text-muted-foreground md:flex"
              onClick={() => setSearchOpen(true)}
            >
              <Search aria-hidden />
              Search
              <Kbd className="ml-auto">{SEARCH_SHORTCUT}</Kbd>
            </Button>
          </header>
          <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
            <Outlet />
          </div>
        </SidebarInset>
        <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />
      </PageHeaderProvider>
    </SidebarProvider>
  )
}
