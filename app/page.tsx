'use client'

import { useRouter } from 'next/navigation'

const features = [
  {
    icon: '📅',
    title: 'Записи та календар',
    desc: 'Один календар на всіх майстрів. Фільтри за статусом, датою та відвідувачем. Швидке створення та редагування записів.',
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
    title: 'Графік майстрів',
    desc: 'Робочі години та вихідні. Індивідуальні графіки на кожен день. Відображення зайнятості.',
  },
  {
    icon: '📱',
    title: 'Онлайн-бронювання та QR',
    desc: 'Посилання для відвідувачів та QR-код. Запис у кілька кроків: послуга → майстер → час. Без дзвінків.',
  },
  {
    icon: '🔗',
    title: 'Telegram та інтеграції',
    desc: 'Вхід через Telegram та Google. Нагадування, повідомлення. Готовність до розширень.',
  },
]

const steps = [
  { num: '1', title: 'Зареєструйтесь', text: 'Створіть бізнес за хвилину: назва, email, пароль. Або увійдіть через Google чи Telegram.' },
  { num: '2', title: 'Налаштуйте графік і послуги', text: 'Додайте майстрів, робочі години та прайс. Система підкаже вільні слоти.' },
  { num: '3', title: 'Клієнти записуються онлайн', text: 'Поділіться посиланням або QR. Клієнти обирають послугу, майстра й час самостійно.' },
]

const demos = [
  { label: 'Тестовий потік', desc: 'Перегляньте інтерфейс без реєстрації', path: '/test-flow', emoji: '🧪' },
  { label: 'Приклад бронювання', desc: 'Як виглядає запис для відвідувача', path: '/booking/045-barbershop', emoji: '📅' },
  { label: 'Приклад QR', desc: 'QR-код і посилання для салону', path: '/qr/045-barbershop', emoji: '📱' },
]

const stats = [
  { value: 'Безкоштовний старт', label: 'Реєстрація та базовий функціонал' },
  { value: 'Онлайн 24/7', label: 'Записи та панель завжди під рукою' },
  { value: 'Підтримка', label: 'Допомога з налаштуванням та інтеграціями' },
]

export default function Home() {
  const router = useRouter()

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Decorative hero gradient */}
      <div className="fixed inset-0 pointer-events-none landing-hero-gradient" aria-hidden />

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <a href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-sm sm:text-base">
            X
          </div>
          <span className="text-base sm:text-lg font-bold text-white landing-hero-title">Xbase</span>
        </a>
        <nav className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => router.push('/login')}
            className="text-sm font-medium text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            Вхід
          </button>
          <button
            onClick={() => router.push('/register')}
            className="text-sm font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/20 px-4 py-2 rounded-lg transition-colors"
          >
            Реєстрація
          </button>
        </nav>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16 sm:pb-24 text-center">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-gray-300 border border-white/10 mb-6 landing-animate-in">
            Безкоштовний старт
          </span>
          <h1 className="landing-hero-title text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white max-w-4xl mx-auto mb-4 sm:mb-6 landing-animate-in landing-animate-in-1">
            Відвідувачі записуються самі. Ви — керуєте.
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-2 landing-animate-in landing-animate-in-2">
            Посилання або QR-код — відвідувачі обирають час без дзвінків. Всі записи в одній панелі.
          </p>
          <p className="text-sm text-gray-500 max-w-xl mx-auto mb-8 sm:mb-10 landing-animate-in landing-animate-in-2">
            Салон, барбершоп, клініка, майстер — для будь-якого бізнесу з записами
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center landing-animate-in landing-animate-in-3">
            <button
              onClick={() => router.push('/register')}
              className="w-full sm:w-auto min-h-[52px] px-8 py-3.5 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 transition-all active:scale-[0.98] shadow-lg shadow-black/20"
            >
              Почати безкоштовно
            </button>
            <button
              onClick={() => router.push('/login')}
              className="w-full sm:w-auto min-h-[52px] px-8 py-3.5 border border-white/25 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-all active:scale-[0.98]"
            >
              Вже маю акаунт — увійти
            </button>
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
                <div className="text-xl sm:text-2xl font-bold text-white mb-1">{item.value}</div>
                <div className="text-sm text-gray-400">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-20" id="features">
          <h2 className="landing-hero-title text-3xl sm:text-4xl font-bold text-white text-center mb-4">
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

        {/* Demo / Try it */}
        <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <h2 className="landing-hero-title text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            Спробуйте зараз
          </h2>
          <p className="text-gray-400 text-center max-w-xl mx-auto mb-12 sm:mb-16">
            Тестовий потік, приклад бронювання та QR — без реєстрації.
          </p>
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {demos.map((d, i) => (
              <button
                key={i}
                onClick={() => router.push(d.path)}
                className="card-glass rounded-2xl p-5 sm:p-6 border border-white/10 landing-card-hover text-left"
              >
                <span className="text-2xl mb-3 block">{d.emoji}</span>
                <span className="text-base font-semibold text-white block mb-1">{d.label}</span>
                <span className="text-sm text-gray-400">{d.desc}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-3xl mx-auto card-glass-elevated rounded-3xl p-8 sm:p-12 text-center border border-white/10">
            <h2 className="landing-hero-title text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
              Готові керувати записами онлайн?
            </h2>
            <p className="text-gray-400 mb-8">
              Приєднуйтесь до бізнесів, які вже використовують Xbase для бронювань.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => router.push('/register')}
                className="w-full sm:w-auto min-h-[52px] px-8 py-3.5 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 transition-all active:scale-[0.98] shadow-lg shadow-black/20"
              >
                Зареєструвати бізнес
              </button>
              <button
                onClick={() => router.push('/login')}
                className="w-full sm:w-auto min-h-[52px] px-8 py-3.5 border border-white/25 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-all"
              >
                Увійти
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative border-t border-white/10 px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-xs">
                X
              </div>
              <span className="text-sm font-semibold text-white">Xbase</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <button
                onClick={() => router.push('/login')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Вхід
              </button>
              <button
                onClick={() => router.push('/register')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Реєстрація
              </button>
              <button type="button" onClick={scrollToFeatures} className="text-gray-400 hover:text-white transition-colors">
                Можливості
              </button>
            </div>
          </div>
          <p className="max-w-6xl mx-auto mt-6 text-center text-xs text-gray-500">
            Xbase — записи та відвідувачі в одній базі · xbase.online
          </p>
        </footer>
      </main>
    </div>
  )
}
