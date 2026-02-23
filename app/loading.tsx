/** Легкий інлайн-спінер — швидкий перший показ при навігації */
export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08080a] outline-none animate-content-fade-in" aria-live="polite" aria-busy="true">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-white/12 border-t-indigo-400 animate-spin" aria-hidden />
        <p className="text-sm text-white/80">Завантажуємо...</p>
      </div>
    </div>
  )
}
