import crypto from 'crypto'

type TelegramAuthPayload = Record<string, unknown> & {
  id?: string | number
  auth_date?: string | number
  hash?: string
}

/**
 * Перевірка підпису Telegram Login Widget.
 * Документація: https://core.telegram.org/widgets/login#checking-authorization
 */
export function isValidTelegramLoginData(payload: TelegramAuthPayload, botToken: string): boolean {
  if (!payload || !payload.hash || !payload.auth_date || !payload.id) {
    return false
  }

  const hash = String(payload.hash)
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    return false
  }

  const dataCheckString = Object.keys(payload)
    .filter((key) => key !== 'hash' && payload[key] !== undefined && payload[key] !== null)
    .sort()
    .map((key) => `${key}=${String(payload[key])}`)
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const providedHash = Buffer.from(hash, 'hex')
  const expectedHash = Buffer.from(calculatedHash, 'hex')
  if (providedHash.length !== expectedHash.length || !crypto.timingSafeEqual(providedHash, expectedHash)) {
    return false
  }

  // Захист від replay-атак: дозволяємо дані не старші за 24 години.
  const authDate = Number(payload.auth_date)
  if (!Number.isFinite(authDate)) {
    return false
  }
  const now = Math.floor(Date.now() / 1000)
  const maxAgeSec = 60 * 60 * 24
  if (authDate > now + 60) {
    return false
  }
  if (now - authDate > maxAgeSec) {
    return false
  }

  return true
}

