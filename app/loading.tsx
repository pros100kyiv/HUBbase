export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A]/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5">
        <div
          className="h-10 w-10 rounded-full border-2 border-white/10 border-t-indigo-500 border-r-purple-500 animate-spin"
          aria-hidden
        />
        <p className="text-sm font-medium text-white/90 flex items-baseline gap-0.5">
          <span>Завантажуємо</span>
          <span className="inline-flex w-5" aria-hidden>
            <span className="animate-[loading-dots-opacity_0.6s_ease-in-out_infinite]">...</span>
          </span>
        </p>
      </div>
    </div>
  )
}
