import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Видалення даних Facebook / Instagram | Xbase',
  description:
    'Інструкції з видалення даних, отриманих через Facebook та Instagram, у сервісі Xbase.',
  robots: { index: true, follow: true },
}

const CONTACT_EMAIL = 'taxi2026ua@gmail.com'
const DATA_DELETION_CALLBACK_URL =
  typeof process.env.NEXT_PUBLIC_BASE_URL === 'string'
    ? `${process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '')}/api/facebook/data-deletion`
    : 'https://xbase.online/api/facebook/data-deletion'

export default async function DataDeletionPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const params = await searchParams
  const confirmationCode = params?.code

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8"
        >
          ← На головну
        </Link>
        <h1 className="text-2xl font-bold text-white mb-2">
          Видалення даних Facebook та Instagram
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Сервіс Xbase дозволяє підключати Instagram (через Facebook) для отримання листів у
          кабінет. Якщо ви бажаєте видалити зв’язок та дані, отримані через Facebook/Instagram,
          скористайтесь інструкціями нижче.
        </p>

        {confirmationCode && (
          <div className="mb-8 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-200 text-sm">
            <strong>Запит на видалення даних прийнято.</strong> Код підтвердження:{' '}
            <code className="font-mono bg-black/30 px-1 rounded">{confirmationCode}</code>
          </div>
        )}

        <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              1. Видалення через налаштування Facebook
            </h2>
            <p>
              У налаштуваннях Facebook: <strong>Налаштування та конфіденційність</strong> →{' '}
              <strong>Налаштування</strong> → <strong>Безпека</strong> →{' '}
              <strong>Інші сеанси та активність</strong> → <strong>Бізнес-інтеграції та додатки</strong>.
              Знайдіть «Xbase» або «xbaseonline» і натисніть <strong>Видалити</strong>. Після цього
              ми отримаємо запит на видалення даних і відключимо ваш Instagram від кабінету Xbase.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              2. Запит на видалення електронною поштою
            </h2>
            <p>
              Напишіть нам на{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Запит на видалення даних Facebook/Instagram`}
                className="text-white underline hover:no-underline"
              >
                {CONTACT_EMAIL}
              </a>{' '}
              із темою «Запит на видалення даних Facebook/Instagram». Вкажіть email, з яким ви
              реєструвались у Xbase, або назву бізнесу. Ми видалимо зв’язок з Facebook/Instagram та
              пов’язані дані у строк до 30 днів.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Які дані видаляються</h2>
            <p>
              Після вашого запиту ми відключаємо інтеграцію Instagram для вашого бізнесу (токени
              доступу, ідентифікатори профілю Instagram/Facebook). Історія листів у кабінеті може
              зберігатися для історії листування з клієнтами; за потреби можна додатково замовити
              повне видалення цих записів через email.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Data Deletion Callback (Meta)</h2>
            <p>
              Для додатків Facebook/Meta ми реалізовали автоматичний callback видалення даних. URL
              для налаштування в Meta for Developers → Настройки приложения → Дополнительно →
              Data Deletion Request URL:
            </p>
            <p className="mt-2 break-all font-mono text-xs bg-white/5 p-3 rounded">
              {DATA_DELETION_CALLBACK_URL}
            </p>
            <p className="mt-2">
              Після того як користувач видаляє додаток у налаштуваннях Facebook, Meta надсилає запит
              на цей URL, і ми відключаємо його інтеграцію Instagram у Xbase.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Контакт</h2>
            <p>
              З питань конфіденційності та видалення даних:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-white underline hover:no-underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>

        <p className="mt-10 text-xs text-gray-500">© Xbase. Усі права захищені.</p>
      </div>
    </div>
  )
}
