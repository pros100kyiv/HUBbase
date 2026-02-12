/** Легкий інлайн-спінер, щоб сторінка не чекала на завантаження loading-screen. */
export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-[200px] p-6" aria-live="polite" aria-busy="true">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-indigo-400 animate-spin" aria-hidden />
        <p className="text-sm text-white/70">Підготовка сторінки...</p>
      </div>
    </div>
  )
}
