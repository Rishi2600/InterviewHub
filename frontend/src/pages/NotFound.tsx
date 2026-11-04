import { Link } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/States'
import { PageHeader } from '@/components/layout/PageHeader'

export function NotFound() {
  return (
    <>
      <PageHeader title={<span>Not found</span>} />
      <EmptyState
        className="min-h-[60vh]"
        icon={<Compass />}
        title="Page not found"
        description="That link doesn't lead anywhere in InterviewHub."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <ArrowLeft aria-hidden />
              Back to the dashboard
            </Link>
          </Button>
        }
      />
    </>
  )
}
