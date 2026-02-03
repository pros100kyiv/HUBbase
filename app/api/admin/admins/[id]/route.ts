import { NextResponse } from 'next/server'
import { z } from 'zod'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/middleware/admin-auth'

const updateAdminSchema = z.object({
  name: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'VIEWER']).optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
})

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Перевірка доступу
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = await prisma.admin.findUnique({
      where: { id: params.id },
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

    if (!admin) {
      return NextResponse.json(
        { error: 'Адмін не знайдено' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      admin: {
        ...admin,
        permissions: admin.permissions ? JSON.parse(admin.permissions) : [],
      },
    })
  } catch (error: any) {
    console.error('Error fetching admin:', error)
    return NextResponse.json(
      { error: 'Помилка отримання адміна' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Перевірка доступу
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Перевіряємо права доступу
  const permissions = (auth as any).permissions || []
  if (!permissions.includes('MANAGE_ADMINS') && auth.role !== 'SUPER_ADMIN' && auth.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden: No permission to update admins' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validated = updateAdminSchema.parse(body)

    // Перевіряємо, чи адмін існує
    const existingAdmin = await prisma.admin.findUnique({
      where: { id: params.id },
    })

    if (!existingAdmin) {
      return NextResponse.json(
        { error: 'Адмін не знайдено' },
        { status: 404 }
      )
    }

    // Готуємо дані для оновлення
    const updateData: any = {}

    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.role !== undefined) updateData.role = validated.role
    if (validated.permissions !== undefined) updateData.permissions = JSON.stringify(validated.permissions)
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive
    if (validated.password) {
      updateData.password = await hash(validated.password, 10)
    }

    // Оновлюємо адміна
    const updatedAdmin = await prisma.admin.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      admin: {
        ...updatedAdmin,
        permissions: updatedAdmin.permissions ? JSON.parse(updatedAdmin.permissions) : [],
      },
    })
  } catch (error: any) {
    console.error('Error updating admin:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Помилка оновлення адміна' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Перевірка доступу
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Перевіряємо права доступу
  const permissions = (auth as any).permissions || []
  if (!permissions.includes('MANAGE_ADMINS') && auth.role !== 'SUPER_ADMIN' && auth.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden: No permission to delete admins' }, { status: 403 })
  }

  try {
    // Перевіряємо, чи адмін існує
    const existingAdmin = await prisma.admin.findUnique({
      where: { id: params.id },
    })

    if (!existingAdmin) {
      return NextResponse.json(
        { error: 'Адмін не знайдено' },
        { status: 404 }
      )
    }

    // Не дозволяємо видаляти самого себе
    if ((auth as any).adminId === params.id) {
      return NextResponse.json(
        { error: 'Не можна видалити самого себе' },
        { status: 400 }
      )
    }

    // Видаляємо адміна
    await prisma.admin.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: 'Адмін успішно видалено',
    })
  } catch (error: any) {
    console.error('Error deleting admin:', error)
    return NextResponse.json(
      { error: 'Помилка видалення адміна' },
      { status: 500 }
    )
  }
}

