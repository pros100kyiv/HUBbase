type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function nowMs(): number {
  return Date.now()
}

function cleanupExpired(currentTime: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= currentTime) {
      buckets.delete(key)
    }
  }
}

export function checkRateLimit(options: {
  key: string
  maxRequests: number
  windowMs: number
}): {
  limited: boolean
  retryAfterSec: number
  remaining: number
} {
  const currentTime = nowMs()
  cleanupExpired(currentTime)

  const existing = buckets.get(options.key)
  if (!existing || existing.resetAt <= currentTime) {
    buckets.set(options.key, { count: 1, resetAt: currentTime + options.windowMs })
    return {
      limited: false,
      retryAfterSec: 0,
      remaining: Math.max(0, options.maxRequests - 1),
    }
  }

  existing.count += 1
  const remaining = Math.max(0, options.maxRequests - existing.count)
  const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - currentTime) / 1000))

  if (existing.count > options.maxRequests) {
    return { limited: true, retryAfterSec, remaining: 0 }
  }

  return { limited: false, retryAfterSec: 0, remaining }
}
