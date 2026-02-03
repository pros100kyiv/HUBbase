import { NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '@/lib/prisma'
import { generateSlug } from '@/lib/auth'
import { ensureAdminControlCenterTable } from '@/lib/database/ensure-admin-control-center'

// Отримуємо базовий URL для redirect URI
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

export async function GET(request: Request) {
  try {
    // Перевіряємо чи налаштовані змінні оточення
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Google OAuth credentials not configured')
      return NextResponse.redirect(new URL('/login?error=oauth_not_configured', request.url))
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(new URL('/login?error=google_auth_failed', request.url))
    }

    if (!code) {
      // Генеруємо URL для авторизації
      const client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${getBaseUrl()}/api/auth/google`
      )

      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: ['email', 'profile'],
        prompt: 'consent',
      })
      return NextResponse.redirect(authUrl)
    }

    // Обмінюємо код на токен
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${getBaseUrl()}/api/auth/google`
    )

    const { tokens } = await client.getToken(code)
    
    if (!tokens.id_token) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', request.url))
    }

    // Перевіряємо та створюємо таблицю admin_control_center, якщо вона не існує
    await ensureAdminControlCenterTable()

    // Отримуємо інформацію про користувача
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', request.url))
    }

    const googleId = payload.sub
    const email = payload.email
    const name = payload.name || email?.split('@')[0] || 'Business'
    const picture = payload.picture

    if (!email) {
      return NextResponse.redirect(new URL('/login?error=no_email', request.url))
    }

    // Перевіряємо чи існує бізнес з цим Google ID або email
    let business = await prisma.business.findFirst({
      where: {
        OR: [
          { googleId },
          { email: email.toLowerCase() },
        ],
      },
    })

    if (business) {
      // Оновлюємо Google ID якщо його не було
      if (!business.googleId) {
        business = await prisma.business.update({
          where: { id: business.id },
          data: { googleId },
        })
      }
    } else {
      // Створюємо новий бізнес
      const slug = generateSlug(name)
      
      // Перевіряємо чи slug вільний
      let finalSlug = slug
      let counter = 1
      while (await prisma.business.findUnique({ where: { slug: finalSlug } })) {
        finalSlug = `${slug}-${counter}`
        counter++
      }

      business = await prisma.business.create({
        data: {
          name,
          email: email.toLowerCase(),
          googleId,
          slug: finalSlug,
          logo: picture,
          niche: 'OTHER',
          customNiche: null,
        },
      })

      // КРИТИЧНО ВАЖЛИВО: Автоматично реєструємо в Центрі управління (ПОВНЕ ДУБЛЮВАННЯ)
      // Всі акаунти мають бути в ManagementCenter
      try {
        const { registerBusinessInManagementCenter } = await import('@/lib/services/management-center')
        await registerBusinessInManagementCenter({
          businessId: business.id,
          business: business, // Передаємо повний об'єкт для дублювання
          registrationType: 'google',
        })
      } catch (error) {
        console.error('КРИТИЧНА ПОМИЛКА: Не вдалося синхронізувати Google OAuth бізнес в ManagementCenter:', error)
        // Не викидаємо помилку, щоб не зламати реєстрацію
      }
    }

    // Перевіряємо чи бізнес активний
    if (business.isActive === false) {
      return NextResponse.redirect(new URL('/login?error=account_deactivated', request.url))
    }

    // Повертаємо дані бізнесу
    const businessData = {
      id: business.id,
      name: business.name,
      slug: business.slug,
      email: business.email,
      phone: business.phone,
      address: business.address,
      description: business.description,
      logo: business.logo,
      primaryColor: business.primaryColor,
      secondaryColor: business.secondaryColor,
      backgroundColor: business.backgroundColor,
      surfaceColor: business.surfaceColor,
      isActive: business.isActive,
    }

    // Перенаправляємо на сторінку з даними (використовуємо sessionStorage через URL параметри)
    const redirectUrl = new URL('/auth/callback', request.url)
    redirectUrl.searchParams.set('data', encodeURIComponent(JSON.stringify(businessData)))
    
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('Google OAuth error:', error)
    return NextResponse.redirect(new URL('/login?error=oauth_error', request.url))
  }
}

