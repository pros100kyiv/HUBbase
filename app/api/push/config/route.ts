import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  // Public key is safe to expose; private key must stay server-only.
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || ''

  return NextResponse.json(
    {
      configured: Boolean(publicKey && publicKey.trim()),
      publicKey: publicKey && publicKey.trim() ? publicKey.trim() : null,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}

