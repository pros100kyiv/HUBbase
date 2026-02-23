'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { XbaseLogo } from '@/components/layout/XbaseLogo'

// Порядок файлів зіставлено з вмістом скріншотів (не з часом створення)
const screenshotFiles = [
  'Знімок екрана 2026-02-13 030055.png', // Аналітика
  'Знімок екрана 2026-02-13 025733.png', // Головна (дашборд)
  'Знімок екрана 2026-02-13 025859.png', // Записи (календар)
  'Знімок екрана 2026-02-13 025919.png', // Прайс-лист
  'Знімок екрана 2026-02-13 025959.png', // Клієнти
  'Знімок екрана 2026-02-13 030033.png', // Соцмережі
]
const screenshots = [
  { title: 'Аналітика', desc: 'Прибуток, конверсія, прогноз та воронка записів' },
  { title: 'Головна', desc: 'Дашборд на сьогодні, календар та нотатки' },
  { title: 'Записи', desc: 'Календар записів та статистика за період' },
  { title: 'Прайс-лист', desc: 'Послуги, ціни та калькулятор' },
  { title: 'Клієнти', desc: 'База клієнтів, історія візитів та дохід' },
  { title: 'Соцмережі', desc: 'Telegram, Instagram — листи в одній панелі' },
].map((item, i) => ({ ...item, src: `/landing/${encodeURIComponent(screenshotFiles[i])}` }))

function ScreenshotBlock({ src, title, desc, featured = false }: { src: string; title: string; desc: string; featured?: boolean }) {
  const [error, setError] = useState(false)
  const figClass = `rounded-2xl overflow-hidden border border-white/10 shadow-xl shadow-black/20 ${featured ? 'md:col-span-2' : ''} w-full aspect-video relative`
  if (error) {
    return (
      <figure className={`${figClass} bg-gradient-to-br from-white/5 to-white/[0.02] flex flex-col items-center justify-center gap-2 min-h-[220px]`}>
        <span className="text-4xl opacity-50">📷</span>
        <figcaption className="text-center px-4">
          <span className="font-semibold text-white block">{title}</span>
          <span className="text-sm text-gray-500">{desc}</span>
        </figcaption>
      </figure>
    )
  }
  return (
    <figure className={`group ${figClass}`}>
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src={src}
          alt={title}
          fill
          className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03] ease-out"
          sizes={featured ? '(max-width: 768px) 100vw, 80vw' : '(max-width: 768px) 100vw, 50vw'}
          onError={() => setError(true)}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <figcaption className="absolute bottom-0 left-0 right-0 p-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <span className="font-semibold block">{title}</span>
        <span className="text-sm text-white/80">{desc}</span>
      </figcaption>
    </figure>
  )
}

const features = [
  {
    icon: '📅',
    title: 'Записи та календар',
    desc: 'Один календар на всіх спеціалістів. Фільтри за статусом, датою та відвідувачем. Швидке створення та редагування записів.',
  },
  {
    icon: '👥',
    title: 'Відвідувачі та історія',
    desc: 'База відвідувачів з історією візитів. Повторні записи в один клік. Сегментація та нотатки.',
  },
  {
    icon: '💰',
    title: 'Прайс та послуги',
    desc: 'Прайс-лист з групуванням. Довільні послуги та ціни. Швидке додавання до запису.',
  },
  {
    icon: '🕐',
    title: 'Графік спеціалістів',
    desc: 'Робочі години та вихідні. Індивідуальні графіки на кожен день. Відображення зайнятості.',
  },
  {
    icon: '📱',
    title: 'Онлайн-бронювання та QR',
    desc: 'Посилання для відвідувачів та QR-код. Запис у кілька кроків: послуга → спеціаліст → час. Без дзвінків.',
  },
  {
    icon: '🔗',
    title: 'Telegram та інтеграції',
    desc: 'Telegram-бот, нагадування та повідомлення. Інтеграції та готовність до розширень.',
  },
]

const steps = [
  { num: '1', title: 'Зареєструйтесь', text: 'Створіть акаунт за хвилину: назва, email, пароль. Або увійдіть через Google.' },
  { num: '2', title: 'Налаштуйте графік і послуги', text: 'Додайте спеціалістів, робочі години та прайс. Система підкаже вільні слоти.' },
  { num: '3', title: 'Клієнти записуються онлайн', text: 'Поділіться посиланням або QR. Клієнти обирають послугу, спеціаліста й час самостійно.' },
]

const integrations = [
  { name: 'Telegram', icon: '✈️', desc: 'Підключення Telegram-бота, нагадування клієнтам, сповіщення. Бот під ваш кабінет — один клік.' },
  { name: 'Instagram', icon: '📷', desc: 'Листи з Direct у єдиній панелі. Підключіть профіль — відповідайте клієнтам з кабінету.' },
  { name: 'Google', icon: '🔐', desc: 'Швидкий вхід через Google. Без зайвих паролів — зручно і безпечно.' },
]

const whyUs = [
  { title: 'Єдина панель', desc: 'Записи, клієнти, календар, прайс і соцмережі в одному місці. Нічого не губиться.' },
  { title: 'Без прив\'язки картки', desc: 'Старт без оплати. Налаштуйте все і працюйте — перевірте спочатку.' },
  { title: 'Швидкий старт', desc: 'Від реєстрації до першого запису — хвилини. Графік, послуги, посилання — і вперед.' },
  { title: 'Ваші дані під контролем', desc: 'Прозора політика конфіденційності та можливість видалення даних. Ми не продаємо ваші контакти.' },
]

const stats = [
  { value: 'Безкоштовний старт', label: 'Реєстрація та базовий функціонал' },
  { value: 'Онлайн 24/7', label: 'Записи та панель завжди під рукою' },
  { value: 'Підтримка', label: 'Допомога з налаштуванням та інтеграціями' },
]

export default function Home() {
  const router = useRouter()

  // Якщо вхід вже є — при відкритті додатка відкриваємо головну дашборду
  useEffect(() => {
    const businessData = typeof window !== 'undefined' ? localStorage.getItem('business') : null
    if (businessData) {
      try {
        const parsed = JSON.parse(businessData)
        if (parsed?.id && parsed?.name) {
          router.replace('/dashboard/main')
        }
      } catch {
        // невалідні дані — залишаємо на лендингу
      }
    }
  }, [router])

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Доступність: skip link — перехід до основного контенту */}
      <a href="#main-content" className="skip-link">
        Перейти до основного контенту
      </a>
      {/* Decorative hero gradient */}
      <div className="fixed inset-0 pointer-events-none landing-hero-gradient" aria-hidden />

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 lg:px-8 py-4 sm:py-5">
        <Link href="/" className="flex items-center min-h-[44px] min-w-[44px] rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 focus-visible:outline-offset-2" aria-label="Xbase — на головну">
          <XbaseLogo size="lg" variant="light" />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Головна навігація">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 focus-visible:outline-offset-2"
          >
            Вхід
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg transition-all duration-200 active:scale-[0.98] shadow-md shadow-emerald-900/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 focus-visible:outline-offset-2"
          >
            Реєстрація
          </Link>
        </nav>
      </header>

      <main id="main-content" className="relative z-10" role="main" tabIndex={-1} data-testid="home-main">
        {/* Hero */}
        <section className="px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16 sm:pb-24 text-center pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]" aria-labelledby="hero-heading">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-medium bg-white/[0.08] text-gray-300 border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] mb-6 landing-animate-in" role="status">
            Технології вашого комфорту
          </span>
          <h1 id="hero-heading" className="landing-hero-title text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white max-w-4xl mx-auto mb-4 sm:mb-6 landing-animate-in landing-animate-in-1 break-words">
            Онлайн-запис. Єдина панель. Повний контроль.
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-2 landing-animate-in landing-animate-in-2">
            Одне посилання або QR-код — клієнти обирають час без дзвінків. Усі записи в одному місці.
          </p>
          <p className="text-sm text-gray-500 max-w-xl mx-auto mb-8 sm:mb-10 landing-animate-in landing-animate-in-2">
            Салон, шиномонтаж, клініка, автосервіс — один сервіс для онлайн-записів.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center landing-animate-in landing-animate-in-3">
            <Link
              href="/register"
              className="w-full sm:w-auto min-h-[52px] px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] shadow-lg shadow-emerald-900/30 hover:shadow-emerald-500/25 hover:shadow-xl inline-flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 focus-visible:outline-offset-2"
            >
              Почати безкоштовно
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto min-h-[52px] px-8 py-3.5 border border-white/25 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-all active:scale-[0.98] inline-flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 focus-visible:outline-offset-2"
            >
              Вже маю акаунт — увійти
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500 landing-animate-in landing-animate-in-4">
            Без картки. Налаштування за кілька хвилин.
          </p>
        </section>

        {/* Stats strip */}
        <section className="px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {stats.map((item, i) => (
              <div
                key={i}
                className="card-glass rounded-2xl p-5 sm:p-6 text-center landing-card-hover border border-white/10"
              >
                <div className="text-xl sm:text-2xl font-bold text-purple-400 mb-1">{item.value}</div>
                <div className="text-sm text-gray-400">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Інтерфейс — скріншоти панелі (Аналітика перша) */}
        <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-20 bg-white/[0.02]" aria-labelledby="interface-heading">
          <h2 id="interface-heading" className="landing-hero-title text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            Зручна панель у вас під рукою
          </h2>
          <p className="text-gray-400 text-center max-w-xl mx-auto mb-12 sm:mb-16">
            Аналітика, записи, клієнти та листи з соцмереж — у одному інтерфейсі. Швидко та зрозуміло.
          </p>
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <ScreenshotBlock src={screenshots[0].src} title={screenshots[0].title} desc={screenshots[0].desc} featured />
            <ScreenshotBlock src={screenshots[1].src} title={screenshots[1].title} desc={screenshots[1].desc} />
            <ScreenshotBlock src={screenshots[2].src} title={screenshots[2].title} desc={screenshots[2].desc} />
            <ScreenshotBlock src={screenshots[3].src} title={screenshots[3].title} desc={screenshots[3].desc} />
            <ScreenshotBlock src={screenshots[4].src} title={screenshots[4].title} desc={screenshots[4].desc} />
            <ScreenshotBlock src={screenshots[5].src} title={screenshots[5].title} desc={screenshots[5].desc} featured />
          </div>
        </section>

        {/* Features */}
        <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-20" id="features" aria-labelledby="features-heading">
          <h2 id="features-heading" className="landing-hero-title text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            Все, що потрібно для записів
          </h2>
          <p className="text-gray-400 text-center max-w-xl mx-auto mb-12 sm:mb-16">
            Календар, відвідувачі, прайс, графік майстрів та онлайн-бронювання в одній панелі.
          </p>
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="card-glass rounded-2xl p-5 sm:p-6 border border-white/10 landing-card-hover"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-20 bg-white/[0.02]">
          <h2 className="landing-hero-title text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            Як це працює
          </h2>
          <p className="text-gray-400 text-center max-w-xl mx-auto mb-12 sm:mb-16">
            Три кроки до першого онлайн-запису.
          </p>
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {steps.map((s, i) => (
              <div key={i} className="relative text-center">
                <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
                  {s.num}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-gray-400">{s.text}</p>
                {i < steps.length - 1 && (
                  <div className="hidden sm:block absolute top-6 left-[60%] w-[80%] h-px bg-gradient-to-r from-white/20 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Інтеграції з соцмережами */}
        <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-20 bg-white/[0.02]" aria-labelledby="integrations-heading">
          <h2 id="integrations-heading" className="landing-hero-title text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            Інтеграції з соцмережами
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            Всі листи та сповіщення в одній панелі. Підключайте Telegram, Instagram та вхід через Google — керуйте записами і листуванням з одного місця.
          </p>
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {integrations.map((item, i) => (
              <div key={i} className="card-glass rounded-2xl p-5 sm:p-6 border border-white/10 landing-card-hover">
                <div className="text-2xl mb-3">{item.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.name}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Чому обирають Xbase */}
        <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-20" id="why" aria-labelledby="why-heading">
          <h2 id="why-heading" className="landing-hero-title text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            Чому обирають Xbase
          </h2>
          <p className="text-gray-400 text-center max-w-xl mx-auto mb-12 sm:mb-16">
            Простий старт, повний контроль і зручні інтеграції — без зайвих умов.
          </p>
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {whyUs.map((item, i) => (
              <div key={i} className="card-glass rounded-2xl p-5 sm:p-6 border border-white/10 landing-card-hover flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24" aria-labelledby="cta-heading">
          <div className="max-w-3xl mx-auto card-glass-elevated rounded-3xl p-8 sm:p-12 text-center border border-white/10">
            <h2 id="cta-heading" className="landing-hero-title text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
              Готові керувати записами онлайн?
            </h2>
            <p className="text-gray-400 mb-8">
              Приєднуйтесь до тих, хто вже веде записи через Xbase.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register"
                className="w-full sm:w-auto min-h-[52px] px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-black/20 inline-flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 focus-visible:outline-offset-2"
              >
                Зареєструватися
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto min-h-[52px] px-8 py-3.5 border border-white/25 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-all inline-flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 focus-visible:outline-offset-2"
              >
                Увійти
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative border-t border-white/10 px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]" role="contentinfo">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 focus-visible:outline-offset-2" aria-label="Xbase — на головну">
              <XbaseLogo size="md" variant="light" />
            </Link>
            <nav className="flex items-center gap-6 text-sm" aria-label="Навігація по сайту">
              <Link href="/login" className="text-gray-400 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 focus-visible:outline-offset-2 rounded">
                Вхід
              </Link>
              <Link href="/register" className="text-gray-400 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 focus-visible:outline-offset-2 rounded">
                Реєстрація
              </Link>
              <button
                type="button"
                onClick={scrollToFeatures}
                className="text-gray-400 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 focus-visible:outline-offset-2 rounded"
              >
                Можливості
              </button>
            </nav>
          </div>
          <div className="max-w-6xl mx-auto mt-6 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-4">
            <nav className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 gap-y-2 text-sm" aria-label="Юридичні документи">
              <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 focus-visible:outline-offset-2 rounded">
                Політика конфіденційності
              </Link>
              <Link href="/terms" className="text-gray-400 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 focus-visible:outline-offset-2 rounded">
                Умови використання
              </Link>
              <Link href="/data-deletion" className="text-gray-400 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 focus-visible:outline-offset-2 rounded">
                Видалення даних (Facebook/Instagram)
              </Link>
            </nav>
          </div>
          <p className="max-w-6xl mx-auto mt-4 text-center text-xs text-gray-500">
            Xbase — записи та відвідувачі в одній базі · xbase.online
          </p>
        </footer>
      </main>
    </div>
  )
}
