import { prisma } from '@/lib/prisma'

/**
 * Перевіряє та створює таблицю admin_control_center, якщо вона не існує
 * Викликається при старті додатку для забезпечення наявності таблиці на production
 */
export async function ensureAdminControlCenterTable() {
  try {
    // Перевіряємо, чи існує таблиця
    const tableExists = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_control_center'
      );
    `) as Array<{ exists: boolean }>

    if (!tableExists[0]?.exists) {
      console.log('📦 Створення таблиці admin_control_center...')
      
      // Створюємо таблицю (gen_random_uuid() — вбудовано в PostgreSQL 13+, не потребує extension)
      await prisma.$executeRawUnsafe(`
        CREATE TABLE admin_control_center (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id TEXT NOT NULL,
          business_phone TEXT,
          business_email TEXT,
          business_name TEXT,
          client_id TEXT,
          client_name TEXT,
          client_phone TEXT,
          action_type TEXT NOT NULL DEFAULT 'client_created',
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `)

      // Створюємо індекси
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_admin_control_business_id ON admin_control_center(business_id);`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_admin_control_client_phone ON admin_control_center(client_phone);`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_admin_control_business_phone ON admin_control_center(business_phone);`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_admin_control_created_at ON admin_control_center(created_at);`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_admin_control_action_type ON admin_control_center(action_type);`)

      console.log('✅ Таблиця admin_control_center створена')
    }
  } catch (error: any) {
    // Якщо помилка не критична (наприклад, таблиця вже існує), просто логуємо
    if (error?.code !== '42P07' && !error?.message?.includes('already exists')) {
      console.error('⚠️ Помилка при перевірці/створенні таблиці admin_control_center:', error)
    }
  }
}

