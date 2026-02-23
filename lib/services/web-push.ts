import webpush from 'web-push'

let vapidConfigured = false

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true

  const subject = process.env.VAPID_SUBJECT || 'mailto:support@xbase.online'
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys are not configured (set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)')
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
  return true
}

/** true якщо VAPID налаштовано (без викиду) */
export function isVapidConfigured(): boolean {
  try {
    const subject = process.env.VAPID_SUBJECT || 'mailto:support@xbase.online'
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    return !!(publicKey && publicKey.trim() && privateKey && privateKey.trim())
  } catch {
    return false
  }
}

export type SendWebPushResult = { ok: true; sent: 1 } | { ok: false; dead: boolean; error: string }

/**
 * Надсилає push-повідомлення. При 410/404 subscription вважається мертвою.
 * @returns результат; dead=true означає, що підписку варто видалити з БД
 */
export async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { title: string; body: string; url?: string; icon?: string; badge?: string; tag?: string; vibrate?: number[] }
): Promise<SendWebPushResult> {
  ensureVapidConfigured()
  try {
    await webpush.sendNotification(subscription as Parameters<typeof webpush.sendNotification>[0], JSON.stringify(payload))
    return { ok: true, sent: 1 }
  } catch (e: unknown) {
    const statusCode = (e as { statusCode?: number })?.statusCode
    const dead = statusCode === 410 || statusCode === 404 || statusCode === 403
    return {
      ok: false,
      dead,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

