export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen w-full min-w-0 text-white">
      <div className="fixed inset-0 pointer-events-none landing-hero-gradient" aria-hidden />
      <div className="relative">{children}</div>
    </div>
  )
}

