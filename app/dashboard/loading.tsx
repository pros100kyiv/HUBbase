export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-[240px] p-8">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-8 w-8 rounded-full border-2 border-white/10 border-t-indigo-500 border-r-purple-500 animate-spin"
          aria-hidden
        />
        <p className="text-sm text-white/70 flex items-center gap-1">
          <span>Підготовка сторінки</span>
          <span className="inline-flex w-4 animate-[loading-dots-opacity_0.6s_ease-in-out_infinite]" aria-hidden>...</span>
        </p>
      </div>
    </div>
  )
}
