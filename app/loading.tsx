/** Легкий інлайн-спінер без додаткового чанку — швидший перший показ при навігації */
export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A] outline-none" aria-live="polite" aria-busy="true">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-white/15 border-t-indigo-400 animate-spin" aria-hidden />
        <p className="text-sm text-white/70">Завантажуємо...</p>
      </div>
    </div>
  )
}
