'use client'

interface AuthLayoutProps {
  title: string
  children: React.ReactNode
}

export function AuthLayout({ title, children }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-12 px-4">
      <div className="relative z-10 w-full max-w-md rounded-xl p-6 md:p-8 card-glass-elevated">
        <h2 className="text-xl md:text-2xl font-bold mb-6 text-white text-center" style={{ letterSpacing: '-0.02em' }}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}
