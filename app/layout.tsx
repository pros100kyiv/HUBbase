import type { Metadata, Viewport } from 'next'
import './globals.css'
import { BookingProvider } from '@/contexts/BookingContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { BackgroundProvider } from '@/contexts/BackgroundContext'
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
  themeColor: '#05050f',
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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon.png" />
        {/* Підтвердження домену для Meta Business Suite: додайте META_DOMAIN_VERIFICATION у Vercel зі значенням content з тега, який покаже Meta */}
        {process.env.META_DOMAIN_VERIFICATION ? (
          <meta name="facebook-domain-verification" content={process.env.META_DOMAIN_VERIFICATION} />
        ) : null}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var root = document.documentElement;
                  root.classList.remove('light', 'dark');
                  root.classList.add('dark', 'oled');
                  var customBg = localStorage.getItem('custom-bg-color');
                  if (customBg && /^#[0-9a-fA-F]{6}$/.test(customBg)) {
                    root.style.setProperty('--custom-bg-base', customBg);
                    root.dataset.customBg = '1';
                  }
                  var customBgLight = localStorage.getItem('custom-bg-color-light');
                  if (customBgLight && /^#[0-9a-fA-F]{6}$/.test(customBgLight)) {
                    root.style.setProperty('--custom-bg-light', customBgLight);
                    root.dataset.customBgLight = '1';
                  }
                  var grad = localStorage.getItem('custom-bg-gradient');
                  if (grad != null) {
                    var g = parseInt(grad, 10);
                    if (g >= 0 && g <= 100) root.style.setProperty('--custom-gradient-opacity', String(g / 100));
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
          <BackgroundProvider>
            <BookingProvider>
            <NavigationProgressProvider>
              <ToastContainer />
                <PushServiceWorkerRegister />
                {children}
              </NavigationProgressProvider>
            </BookingProvider>
          </BackgroundProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

