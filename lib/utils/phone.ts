/**
 * Українські номери: приймаємо 0XXXXXXXXX (без +380), зберігаємо як +380XXXXXXXXX.
 * Використовувати в усьому проєкті — форми, API, пошук, реєстрація.
 */

/** Нормалізує введення до формату +380XXXXXXXXX. Приймає 0XXXXXXXXX, 380..., +380..., або 9 цифр. */
export function normalizeUaPhone(phone: string): string {
  const n = String(phone ?? '')
    .replace(/\s/g, '')
    .replace(/[()-]/g, '')
    .trim()
  if (!n) return ''
  if (n.startsWith('+380')) return n.slice(0, 13)
  if (n.startsWith('380')) return '+' + n.slice(0, 12)
  if (n.startsWith('0')) return '+380' + n.slice(1).replace(/\D/g, '').slice(0, 9)
  const digits = n.replace(/\D/g, '')
  if (digits.length >= 9) return '+380' + digits.slice(-9)
  return '+380' + digits
}

/** Тільки цифри для порівняння: 380XXXXXXXXX (12 цифр). */
export function uaPhoneDigits(phone: string): string {
  const normalized = normalizeUaPhone(phone)
  if (!normalized) return ''
  return normalized.replace(/\D/g, '')
}

/** Чи валідний український номер після нормалізації (+380 + 9 цифр). */
export function isValidUaPhone(phone: string): boolean {
  const n = normalizeUaPhone(phone)
  return /^\+380\d{9}$/.test(n)
}

/** Для підказки в полі: +380671234567 → 067 123 45 67 */
export function formatUaPhoneDisplay(phone: string): string {
  const n = normalizeUaPhone(phone)
  if (!/^\+380\d{9}$/.test(n)) return phone
  return '0' + n.slice(4, 6) + ' ' + n.slice(6, 9) + ' ' + n.slice(9, 11) + ' ' + n.slice(11, 13)
}
