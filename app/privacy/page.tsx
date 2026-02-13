import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Політика конфіденційності | Xbase',
  description: 'Політика конфіденційності сервісу Xbase — збір та використання даних.',
  robots: { index: true, follow: true },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8"
        >
          ← На головну
        </Link>
        <h1 className="text-2xl font-bold text-white mb-2">Політика конфіденційності</h1>
        <p className="text-sm text-gray-500 mb-8">Останнє оновлення: 13 лютого 2026</p>

        <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Які дані ми збираємо</h2>
            <p>
              Ми збираємо дані, необхідні для роботи сервісу: email, назва організації або проєкту, контактні дані,
              дані про записи та клієнтів, які ви вводите в кабінеті. При вході через соціальні мережі
              можуть оброблятись відповідні ідентифікатори згідно з їхніми політиками.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Як ми використовуємо дані</h2>
            <p>
              Дані використовуються для надання функцій сервісу (записи, клієнти, сповіщення),
              підтримки та покращення роботи платформи. Ми не передаємо ваші дані третім особам для
              маркетингу без вашої згоди.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Видалення даних</h2>
            <p>
              Ви можете видалити обліковий запис та пов&apos;язані дані через налаштування кабінету або
              звернувшись до нас. Для даних, отриманих через Facebook або Instagram (вхід через
              Facebook, підключення Instagram), діють окремі інструкції:{' '}
              <Link href="/data-deletion" className="text-white underline hover:no-underline">
                видалення даних Facebook/Instagram
              </Link>
              . Після видалення дані видаляються у встановлені терміни згідно з нашими процедурами.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Контакт</h2>
            <p>
              З питань конфіденційності та видалення даних:{' '}
              <a href="mailto:taxi2026ua@gmail.com" className="text-white underline hover:no-underline">
                taxi2026ua@gmail.com
              </a>
              .
            </p>
          </section>
        </div>

        <p className="mt-10 text-xs text-gray-500">
          © Xbase. Усі права захищені.
        </p>
      </div>
    </div>
  )
}
