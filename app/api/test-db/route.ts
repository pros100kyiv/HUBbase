import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Перевіряємо чи налаштована DATABASE_URL
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ 
        success: false, 
        error: 'DATABASE_URL is not set',
        message: 'Додайте DATABASE_URL в Environment Variables'
      }, { status: 500 })
    }

    // Перевіряємо підключення
    await prisma.$connect()
    
    // Перевіряємо чи існують таблиці
    const businessCount = await prisma.business.count()
    
    return NextResponse.json({ 
      success: true, 
      message: 'База даних підключена успішно',
      databaseUrl: process.env.DATABASE_URL ? 'Налаштовано' : 'Не налаштовано',
      businessCount,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    return NextResponse.json({ 
      success: false, 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      message: 'Помилка підключення до бази даних. Перевірте DATABASE_URL та налаштування бази даних.'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}


