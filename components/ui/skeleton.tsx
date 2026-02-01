import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-candy-sm bg-gray-200 dark:bg-gray-700',
        className
      )}
      {...props}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="card-candy p-3 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-candy-sm" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonWidget() {
  return (
    <div className="card-candy p-3">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="w-11 h-11 rounded-candy-sm" />
        <Skeleton className="h-4 w-8 rounded-full" />
      </div>
      <Skeleton className="h-6 w-16 mb-1" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}



