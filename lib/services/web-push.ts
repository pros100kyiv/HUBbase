import webpush from 'web-push'

let vapidConfigured = false

function ensureVapidConfigured() {
  if (vapidConfigured) return

  const subject = process.env.VAPID_SUBJECT || 'mailto:support@xbase.online'
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys are not configured (set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)')
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
}

export async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { title: string; body: string; url?: string; icon?: string; badge?: string }
) {
  ensureVapidConfigured()
  await webpush.sendNotification(subscription as any, JSON.stringify(payload))
}

