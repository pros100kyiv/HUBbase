/**
 * Зберігання сесії бізнесу з підтримкою "Запам'ятати мене".
 * rememberMe = true → localStorage (сесія зберігається після закриття браузера)
 * rememberMe = false → sessionStorage (сесія скидається при закритті вкладки)
 */
const KEY = 'business'

export function getBusinessData(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(KEY) || localStorage.getItem(KEY)
}

export function setBusinessData(data: object, rememberMe?: boolean): void {
  if (typeof window === 'undefined') return
  const json = JSON.stringify(data)
  if (rememberMe === true) {
    localStorage.setItem(KEY, json)
    sessionStorage.removeItem(KEY)
  } else if (rememberMe === false) {
    sessionStorage.setItem(KEY, json)
    localStorage.removeItem(KEY)
  } else {
    // Зберегти в поточне сховище (оновлення даних бізнесу)
    if (sessionStorage.getItem(KEY)) {
      sessionStorage.setItem(KEY, json)
    } else {
      localStorage.setItem(KEY, json)
    }
  }
}

/** Видаляє дані бізнесу з обох сховищ (вихід) */
export function clearBusinessData(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
  sessionStorage.removeItem(KEY)
}
