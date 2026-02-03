import { NextResponse } from 'next/server'
import { z } from 'zod'
import { hash, compare } from 'bcryptjs'
import jwt from 'jsonwebtoken'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = loginSchema.parse(body)

    // Перевіряємо, чи це email розробника
    const developerEmail = process.env.DEVELOPER_EMAIL || 'developer@xbase.online'
    const developerPassword = process.env.DEVELOPER_PASSWORD

    if (!developerPassword) {
      console.error('DEVELOPER_PASSWORD not set in environment variables')
      return NextResponse.json(
        { error: 'Developer access not configured' },
        { status: 500 }
      )
    }

    // Перевіряємо email
    if (validated.email.toLowerCase().trim() !== developerEmail.toLowerCase().trim()) {
      return NextResponse.json(
        { error: 'Невірний email або пароль' },
        { status: 401 }
      )
    }

    // Перевіряємо пароль
    // Якщо пароль в .env хешований, використовуємо compare
    // Якщо пароль в .env не хешований (для простоти), перевіряємо напряму
    let passwordMatch = false
    
    // Спробуємо порівняти як хешований пароль
    try {
      passwordMatch = await compare(validated.password, developerPassword)
    } catch (e) {
      // Якщо не хешований, порівнюємо напряму
      passwordMatch = validated.password === developerPassword
    }

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Невірний email або пароль' },
        { status: 401 }
      )
    }

    // Генеруємо JWT токен
    const secret = process.env.JWT_SECRET || 'xbase-admin-secret-key-change-in-production'
    const token = jwt.sign(
      { email: validated.email.toLowerCase().trim(), role: 'developer' },
      secret,
      { expiresIn: '24h' }
    )

    return NextResponse.json({
      success: true,
      token,
      email: validated.email.toLowerCase().trim(),
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

