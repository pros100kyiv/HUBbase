/**
 * JSON helpers for Next.js Route Handlers.
 *
 * Prisma returns `BigInt` for PostgreSQL BIGINT fields, but `JSON.stringify`
 * (and thus `NextResponse.json`) cannot serialize BigInt by default.
 *
 * We convert BigInt values to:
 * - `number` when within JS safe integer range
 * - otherwise `string` to avoid precision loss
 */
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER)
const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER)

export function jsonSafe<T>(data: T): unknown {
  return JSON.parse(
    JSON.stringify(data, (_key, value) => {
      if (typeof value !== 'bigint') return value
      if (value <= MAX_SAFE_BIGINT && value >= MIN_SAFE_BIGINT) return Number(value)
      return value.toString()
    })
  )
}

