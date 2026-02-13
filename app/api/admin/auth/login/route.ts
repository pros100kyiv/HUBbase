import { NextResponse } from 'next/server'
import { z } from 'zod'
import { hash, compare } from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { getAdminJwtSecret } from '@/lib/middleware/admin-auth'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// Статичний адмін (для початкового доступу)
const STATIC_ADMIN = {
  email: 'pros100kyiv@gmail.com',
  password: 'Ca0397ah',
  role: 'SUPER_ADMIN',
  permissions: ['VIEW_BUSINESSES', 'EDIT_BUSINESSES', 'DELETE_BUSINESSES', 'VIEW_CLIENTS', 'VIEW_ANALYTICS', 'VIEW_FINANCES', 'MANAGE_ADMINS', 'EXPORT_DATA'],
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = loginSchema.parse(body)

    const email = validated.email.toLowerCase().trim()
    let admin: any = null
    let role = 'developer'
    let permissions: string[] = []

    // КРОК 1: Перевіряємо статичного адміна
    if (email === STATIC_ADMIN.email.toLowerCase()) {
      if (validated.password === STATIC_ADMIN.password) {
        admin = STATIC_ADMIN
        role = STATIC_ADMIN.role
        permissions = STATIC_ADMIN.permissions
      } else {
        return NextResponse.json(
          { error: 'Невірний email або пароль' },
          { status: 401 }
        )
      }
    } else {
      // КРОК 2: Перевіряємо адмінів з бази даних
      const dbAdmin = await prisma.admin.findUnique({
        where: { email },
      })

      if (!dbAdmin || !dbAdmin.isActive) {
        // КРОК 3: Перевіряємо developer email з .env (fallback)
        const developerEmail = process.env.DEVELOPER_EMAIL || 'developer@xbase.online'
        const developerPassword = process.env.DEVELOPER_PASSWORD

        if (email === developerEmail.toLowerCase() && developerPassword) {
          let passwordMatch = false
          try {
            passwordMatch = await compare(validated.password, developerPassword)
          } catch (e) {
            passwordMatch = validated.password === developerPassword
          }

          if (!passwordMatch) {
            return NextResponse.json(
              { error: 'Невірний email або пароль' },
              { status: 401 }
            )
          }

          role = 'developer'
        } else {
          return NextResponse.json(
            { error: 'Невірний email або пароль' },
            { status: 401 }
          )
        }
      } else {
        // Перевіряємо пароль адміна з БД
        const passwordMatch = await compare(validated.password, dbAdmin.password)
        
        if (!passwordMatch) {
          return NextResponse.json(
            { error: 'Невірний email або пароль' },
            { status: 401 }
          )
        }

        admin = dbAdmin
        role = dbAdmin.role
        permissions = dbAdmin.permissions ? JSON.parse(dbAdmin.permissions) : []

        // Оновлюємо останній вхід
        await prisma.admin.update({
          where: { id: dbAdmin.id },
          data: { lastLoginAt: new Date() },
        })
      }
    }

    // Генеруємо JWT токен з єдиним секретом (env або fallback для головного адміна)
    const secret = getAdminJwtSecret()
    const token = jwt.sign(
      { 
        email,
        role,
        permissions,
        adminId: admin?.id || null,
      },
      secret,
      { expiresIn: '24h' }
    )

    return NextResponse.json({
      success: true,
      token,
      email,
      role,
      permissions,
    })
  } catch (error: any) {
    console.error('Admin login error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Невірний формат даних' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Помилка при вході' },
      { status: 500 }
    )
  }
}

