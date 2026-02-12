import { NextRequest, NextResponse } from 'next/server'

const META_GRAPH_VERSION = 'v18.0'

/**
 * GET /api/instagram/oauth?businessId=xxx
 * Редірект на Facebook OAuth для підключення Instagram (через сторінку та дозволи).
 */
export async function GET(request: NextRequest) {
  const appId = process.env.META_APP_ID
  const redirectUri = process.env.META_INSTAGRAM_REDIRECT_URI || getDefaultRedirectUri()

  if (!appId) {
    return NextResponse.json(
      { error: 'Instagram integration is not configured (META_APP_ID)' },
      { status: 503 }
    )
  }

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
  }

  const scopes = [
    'instagram_basic',
    'instagram_manage_messages',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_metadata',
  ].join(',')

  const state = encodeURIComponent(businessId)
  const url = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scopes)

  return NextResponse.redirect(url.toString())
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
