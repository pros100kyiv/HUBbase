import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Умови використання | Xbase',
  description: 'Умови використання сервісу Xbase — запис онлайн та керування бізнесом.',
  robots: { index: true, follow: true },
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8"
        >
          ← На головну
        </Link>
        <h1 className="text-2xl font-bold text-white mb-2">Умови використання</h1>
        <p className="text-sm text-gray-500 mb-8">Останнє оновлення: 13 лютого 2026</p>

        <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Загальні положення</h2>
            <p>
              Сервіс Xbase (далі — «Сервіс») надає можливість керувати записами, клієнтами та
              бізнес-процесами онлайн. Використовуючи Сервіс, ви погоджуєтесь з цими умовами.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Реєстрація та обліковий запис</h2>
            <p>
              Для використання функцій кабінету потрібна реєстрація. Ви зобов&apos;язуєтесь надавати
              коректні дані та зберігати конфіденційність облікових даних.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Використання сервісу</h2>
            <p>
              Дозволяється використовувати Сервіс лише в законних цілях, відповідно до чинного
              законодавства. Заборонено порушення роботи Сервісу, несанкціонований доступ та
              порушення прав інших користувачів.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Контакт</h2>
            <p>
              Питання щодо умов використання:{' '}
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
