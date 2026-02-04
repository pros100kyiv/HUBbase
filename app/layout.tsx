import type { Metadata, Viewport } from 'next'
import './globals.css'
import { BookingProvider } from '@/contexts/BookingContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { NavigationProgressProvider } from '@/contexts/NavigationProgressContext'
import { ToastContainer } from '@/components/ui/toast'

export const metadata: Metadata = {
  title: 'Система Бронювання - SaaS Платформа',
  description: 'Професійна система бронювання записів',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#050505',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  var initialTheme = theme || systemTheme;
                  if (initialTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <BookingProvider>
            <NavigationProgressProvider>
              <ToastContainer />
              {children}
            </NavigationProgressProvider>
          </BookingProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

