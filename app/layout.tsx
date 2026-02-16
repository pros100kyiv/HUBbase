import type { Metadata, Viewport } from 'next'
import './globals.css'
import { BookingProvider } from '@/contexts/BookingContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { NavigationProgressProvider } from '@/contexts/NavigationProgressContext'
import { ToastContainer } from '@/components/ui/toast'
import { PushServiceWorkerRegister } from '@/components/push/PushServiceWorkerRegister'

export const metadata: Metadata = {
  title: 'Xbase — Запис онлайн, бронювання та клієнти | xbase.online',
  description: 'Xbase — сервіс записів онлайн: календар, бронювання, база клієнтів, QR-код. Салон, барбершоп, клініка. Запис без дзвінків. Telegram, безкоштовний старт.',
  keywords: ['Xbase', 'Запис онлайн', 'онлайн бронювання', 'система записів', 'календар записів', 'запис клієнтів', 'запис на прийом', 'онлайн запис', 'бронювання салону', 'запис барбершопу', 'xbase.online'],
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'Xbase — Запис онлайн та клієнти',
    description: 'Сервіс записів онлайн: бронювання, календар, QR-код. Салон, барбершоп, клініка.',
    type: 'website',
    url: 'https://xbase.online',
    siteName: 'Xbase',
    locale: 'uk_UA',
  },
  twitter: {
    card: 'summary',
    title: 'Xbase — Запис онлайн',
    description: 'Сервіс записів онлайн. Бронювання, QR-код, Telegram.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
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
    <html lang="uk" className="dark oled" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        {/* Підтвердження домену для Meta Business Suite: додайте META_DOMAIN_VERIFICATION у Vercel зі значенням content з тега, який покаже Meta */}
        {process.env.META_DOMAIN_VERIFICATION ? (
          <meta name="facebook-domain-verification" content={process.env.META_DOMAIN_VERIFICATION} />
        ) : null}
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
      <body className="bg-background overflow-x-hidden" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Xbase',
              alternateName: 'Xbase — Запис онлайн',
              description: 'Сервіс записів онлайн: бронювання, календар записів, база клієнтів, QR-код.',
              url: 'https://xbase.online',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web, iOS, Android',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'UAH' },
            }),
          }}
        />
        <ThemeProvider>
          <BookingProvider>
            <NavigationProgressProvider>
              <ToastContainer />
              <PushServiceWorkerRegister />
              {children}
            </NavigationProgressProvider>
          </BookingProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

