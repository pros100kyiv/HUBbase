import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const META_GRAPH_VERSION = 'v18.0'
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`

/**
 * GET /api/instagram/oauth/callback?code=...&state=businessId
 * Обмін code на токен, отримання сторінки + Instagram Business акаунту, збереження в SocialIntegration.
 */
export async function GET(request: NextRequest) {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  const redirectUri = process.env.META_INSTAGRAM_REDIRECT_URI || getDefaultRedirectUri()

  if (!appId || !appSecret) {
    return redirectToSocial('error=config')
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return redirectToSocial(`error=${encodeURIComponent(error)}`)
  }

  const businessId = state ? decodeURIComponent(state) : null
  if (!businessId || !code) {
    return redirectToSocial('error=missing_params')
  }

  try {
    const tokenRes = await fetch(
      `${META_GRAPH_BASE}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`
    )
    const tokenData = (await tokenRes.json()) as {
      access_token?: string
      token_type?: string
      expires_in?: number
      error?: { message: string }
    }

    if (!tokenData.access_token || tokenData.error) {
      console.error('Instagram OAuth token exchange failed:', tokenData)
      return redirectToSocial('error=token')
    }

    let accessToken = tokenData.access_token

    const longLivedRes = await fetch(
      `${META_GRAPH_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${accessToken}`
    )
    const longLivedData = (await longLivedRes.json()) as { access_token?: string }
    if (longLivedData.access_token) {
      accessToken = longLivedData.access_token
    }

    const accountsRes = await fetch(
      `${META_GRAPH_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(accessToken)}`
    )
    const accountsData = (await accountsRes.json()) as {
      data?: Array<{
        id: string
        name?: string
        access_token: string
        instagram_business_account?: { id: string; username?: string }
      }>
      error?: { message: string }
    }

    if (accountsData.error || !accountsData.data?.length) {
      console.error('Instagram accounts fetch failed:', accountsData)
      return redirectToSocial('error=no_pages')
    }

    const pageWithIg = accountsData.data.find((p) => p.instagram_business_account)
    if (!pageWithIg?.instagram_business_account) {
      return redirectToSocial('error=no_instagram')
    }

    const igAccount = pageWithIg.instagram_business_account
    const pageAccessToken = pageWithIg.access_token

    // Отримуємо Facebook user ID для підтримки Data Deletion Callback (Meta App Review)
    let facebookUserId: string | null = null
    try {
      const meRes = await fetch(
        `${META_GRAPH_BASE}/me?fields=id&access_token=${encodeURIComponent(accessToken)}`
      )
      const meData = (await meRes.json()) as { id?: string }
      if (meData.id) facebookUserId = meData.id
    } catch {
      /* ignore */
    }

    const metadata =
      facebookUserId != null
        ? JSON.stringify({ facebookUserId })
        : null

    await prisma.socialIntegration.upsert({
      where: {
        businessId_platform: { businessId, platform: 'instagram' },
      },
      create: {
        businessId,
        platform: 'instagram',
        isConnected: true,
        accessToken: pageAccessToken,
        userId: igAccount.id,
        username: igAccount.username ?? null,
        metadata,
        lastSyncAt: new Date(),
      },
      update: {
        isConnected: true,
        accessToken: pageAccessToken,
        userId: igAccount.id,
        username: igAccount.username ?? null,
        metadata,
        lastSyncAt: new Date(),
      },
    })

    return redirectToSocial('instagram=connected')
  } catch (e) {
    console.error('Instagram OAuth callback error:', e)
    return redirectToSocial('error=server')
  }
}

function getDefaultRedirectUri(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return `${process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '')}/api/instagram/oauth/callback`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/instagram/oauth/callback`
  }
  return 'http://localhost:3000/api/instagram/oauth/callback'
}

function redirectToSocial(query: string): NextResponse {
  const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
  const origin = base
    ? (base.startsWith('http') ? base : `https://${base}`).replace(/\/$/, '')
    : 'http://localhost:3000'
  const url = `${origin}/dashboard/social?${query}`
  return NextResponse.redirect(url)
}
