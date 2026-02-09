import type { Metadata, Viewport } from 'next'
import './globals.css'
import { BookingProvider } from '@/contexts/BookingContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { NavigationProgressProvider } from '@/contexts/NavigationProgressContext'
import { ToastContainer } from '@/components/ui/toast'

export const metadata: Metadata = {
  title: 'Xbase — Записи та клієнти в одній базі | xbase.online',
  description: 'Xbase: ваша база для записів та клієнтів. Онлайн-бронювання, QR, Telegram. Безкоштовний старт для бізнесів.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Xbase — Записи та клієнти в одній базі',
    description: 'Ваша база для записів та клієнтів. Онлайн-бронювання, QR, Telegram.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#050505',
  viewportFit: 'cover', // safe area for notched devices
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
                  var initialTheme = theme === 'light' || theme === 'dark' || theme === 'oled' ? theme : 'oled';
                  var root = document.documentElement;
                  root.classList.remove('light', 'dark', 'oled');
                  if (initialTheme === 'oled') {
                    root.classList.add('dark', 'oled');
                  } else if (initialTheme === 'dark') {
                    root.classList.add('dark');
                  } else {
                    root.classList.add('light');
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

