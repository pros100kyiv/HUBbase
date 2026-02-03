import { NextResponse } from 'next/server'
import { z } from 'zod'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/middleware/admin-auth'

const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Пароль має бути мінімум 6 символів'),
  name: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'VIEWER']).default('ADMIN'),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
})

const updateAdminSchema = z.object({
  name: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'VIEWER']).optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
})

export async function GET(request: Request) {
  // Перевірка доступу
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Перевіряємо права доступу
  const permissions = (auth as any).permissions || []
  if (!permissions.includes('MANAGE_ADMINS') && auth.role !== 'SUPER_ADMIN' && auth.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden: No permission to manage admins' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') // 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER' | 'all'
    const isActive = searchParams.get('isActive') // 'true' | 'false' | 'all'

    const where: any = {}

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (role && role !== 'all') {
      where.role = role
    }

    if (isActive && isActive !== 'all') {
      where.isActive = isActive === 'true'
    }

    const admins = await prisma.admin.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true,
        lastLoginAt: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Парсимо permissions з JSON
    const adminsWithParsedPermissions = admins.map(admin => ({
      ...admin,
      permissions: admin.permissions ? JSON.parse(admin.permissions) : [],
    }))

    return NextResponse.json({
      admins: adminsWithParsedPermissions,
    })
  } catch (error: any) {
    console.error('Error fetching admins:', error)
    return NextResponse.json(
      { error: 'Помилка отримання адмінів' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  // Перевірка доступу
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Перевіряємо права доступу
  const permissions = (auth as any).permissions || []
  if (!permissions.includes('MANAGE_ADMINS') && auth.role !== 'SUPER_ADMIN' && auth.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden: No permission to create admins' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validated = createAdminSchema.parse(body)

    // Перевіряємо, чи email вже існує
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: validated.email.toLowerCase().trim() },
    })

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'Адмін з таким email вже існує' },
        { status: 400 }
      )
    }

    // Хешуємо пароль
    const hashedPassword = await hash(validated.password, 10)

    // Створюємо адміна
    const newAdmin = await prisma.admin.create({
      data: {
        email: validated.email.toLowerCase().trim(),
        password: hashedPassword,
        name: validated.name || null,
        role: validated.role,
        permissions: validated.permissions ? JSON.stringify(validated.permissions) : null,
        isActive: validated.isActive,
        createdBy: (auth as any).adminId || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      admin: {
        ...newAdmin,
        permissions: newAdmin.permissions ? JSON.parse(newAdmin.permissions) : [],
      },
    })
  } catch (error: any) {
    console.error('Error creating admin:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Помилка створення адміна' },
      { status: 500 }
    )
  }
}

