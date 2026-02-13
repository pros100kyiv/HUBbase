/**
 * Retry for transient DB errors (e.g. Neon cold start "Can't reach database server").
 * Retries up to maxAttempts times with delayMs between attempts.
 */
const DB_UNREACHABLE_PATTERNS = [
  "can't reach database server",
  "connection refused",
  "connection timeout",
  "connect econnrefused",
  "getaddrinfo enotfound",
]

function isTransientDbError(e: unknown): boolean {
  const msg = String(e instanceof Error ? e.message : e).toLowerCase()
  return DB_UNREACHABLE_PATTERNS.some((p) => msg.includes(p))
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delayMs?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, delayMs = 2500 } = options
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (attempt === maxAttempts || !isTransientDbError(e)) throw e
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[db-retry] attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms...`, e)
      }
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  throw lastError
}
