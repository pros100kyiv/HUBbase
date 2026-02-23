/** Швидкий skeleton — зменшує відчуття очікування при навігації по dashboard */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-4 p-4 md:p-6 max-w-4xl" aria-live="polite" aria-busy="true">
      <div className="h-8 w-48 rounded bg-white/10" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-white/8" />
        ))}
      </div>
      <div className="h-32 rounded-lg bg-white/8" />
    </div>
  )
}
