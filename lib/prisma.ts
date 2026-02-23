import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Serverless (Vercel): 1 з'єднання на інвокацію — менше навантаження на Neon pooler
function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url) return undefined
  const isServerless = !!process.env.VERCEL
  const hasLimit = /[?&]connection_limit=/.test(url)
  if (isServerless && !hasLimit && url.includes('neon.tech')) {
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}connection_limit=1`
  }
  return undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
    datasourceUrl: getDatasourceUrl(),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
