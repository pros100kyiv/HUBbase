/**
 * Скрипт для застосування RLS міграції
 * Виконує команди вручну, правильно обробляючи функції
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function applyRLSMigration() {
  try {
    console.log('🔄 Початок застосування RLS міграції...\n')

    // 1. Розширення UUID
    console.log('1. Створення розширення UUID...')
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`)
    console.log('   ✅ Готово\n')

    // 2. Функція set_current_business_id
    console.log('2. Створення функції set_current_business_id...')
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION set_current_business_id(business_uuid UUID)
      RETURNS VOID AS $func$
      BEGIN
        PERFORM set_config('app.current_business_id', business_uuid::TEXT, false);
      END;
      $func$ LANGUAGE plpgsql;
    `)
    console.log('   ✅ Готово\n')

    // 3. Функція get_current_business_id
    console.log('3. Створення функції get_current_business_id...')
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION get_current_business_id()
      RETURNS UUID AS $func$
      BEGIN
        RETURN NULLIF(current_setting('app.current_business_id', true), '')::UUID;
      END;
      $func$ LANGUAGE plpgsql;
    `)
    console.log('   ✅ Готово\n')

    // 4. Таблиця admin_control_center
    console.log('4. Створення таблиці admin_control_center...')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS admin_control_center (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        business_id UUID NOT NULL,
        business_phone TEXT,
        business_email TEXT,
        business_name TEXT,
        client_id UUID,
        client_name TEXT,
        client_phone TEXT,
        action_type TEXT NOT NULL DEFAULT 'client_created',
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `)
    console.log('   ✅ Готово\n')

    // 5. Індекси
    console.log('5. Створення індексів...')
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_admin_control_business_id ON admin_control_center(business_id);`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_admin_control_client_phone ON admin_control_center(client_phone);`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_admin_control_business_phone ON admin_control_center(business_phone);`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_admin_control_created_at ON admin_control_center(created_at);`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_admin_control_action_type ON admin_control_center(action_type);`)
    console.log('   ✅ Готово\n')

    // 6. RLS для Client
    console.log('6. Налаштування RLS для Client...')
    await prisma.$executeRawUnsafe(`ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;`)
    await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS clients_business_isolation ON "Client";`)
    await prisma.$executeRawUnsafe(`
      CREATE POLICY clients_business_isolation ON "Client"
      FOR ALL
      USING (
        "businessId" = get_current_business_id()::TEXT
        OR get_current_business_id() IS NULL
      );
    `)
    console.log('   ✅ Готово\n')

    // 7. RLS для Appointment
    console.log('7. Налаштування RLS для Appointment...')
    await prisma.$executeRawUnsafe(`ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;`)
    await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS appointments_business_isolation ON "Appointment";`)
    await prisma.$executeRawUnsafe(`
      CREATE POLICY appointments_business_isolation ON "Appointment"
      FOR ALL
      USING (
        "businessId" = get_current_business_id()::TEXT
        OR get_current_business_id() IS NULL
      );
    `)
    console.log('   ✅ Готово\n')

    // 8. RLS для Master
    console.log('8. Налаштування RLS для Master...')
    await prisma.$executeRawUnsafe(`ALTER TABLE "Master" ENABLE ROW LEVEL SECURITY;`)
    await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS masters_business_isolation ON "Master";`)
    await prisma.$executeRawUnsafe(`
      CREATE POLICY masters_business_isolation ON "Master"
      FOR ALL
      USING (
        "businessId" = get_current_business_id()::TEXT
        OR get_current_business_id() IS NULL
      );
    `)
    console.log('   ✅ Готово\n')

    // 9. RLS для Service
    console.log('9. Налаштування RLS для Service...')
    await prisma.$executeRawUnsafe(`ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;`)
    await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS services_business_isolation ON "Service";`)
    await prisma.$executeRawUnsafe(`
      CREATE POLICY services_business_isolation ON "Service"
      FOR ALL
      USING (
        "businessId" = get_current_business_id()::TEXT
        OR get_current_business_id() IS NULL
      );
    `)
    console.log('   ✅ Готово\n')

    // 10. Тригерна функція для Client
    console.log('10. Створення тригерної функції sync_to_admin_control_center...')
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION sync_to_admin_control_center()
      RETURNS TRIGGER AS $trigger$
      DECLARE
        business_record RECORD;
      BEGIN
        SELECT id, phone, email, name
        INTO business_record
        FROM "Business"
        WHERE id = NEW."businessId";

        INSERT INTO admin_control_center (
          business_id, business_phone, business_email, business_name,
          client_id, client_name, client_phone, action_type, metadata, created_at
        ) VALUES (
          business_record.id::UUID,
          business_record.phone,
          business_record.email,
          business_record.name,
          NEW.id::UUID,
          NEW.name,
          NEW.phone,
          'client_created',
          jsonb_build_object(
            'client_id', NEW.id,
            'business_id', NEW."businessId",
            'created_at', NEW."createdAt"
          ),
          NOW()
        );

        RETURN NEW;
      END;
      $trigger$ LANGUAGE plpgsql;
    `)
    console.log('   ✅ Готово\n')

    // 11. Тригер для Client
    console.log('11. Створення тригера trigger_sync_client_to_admin_control...')
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trigger_sync_client_to_admin_control ON "Client";`)
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER trigger_sync_client_to_admin_control
      AFTER INSERT ON "Client"
      FOR EACH ROW
      EXECUTE FUNCTION sync_to_admin_control_center();
    `)
    console.log('   ✅ Готово\n')

    // 12. Тригерна функція для Appointment
    console.log('12. Створення тригерної функції sync_appointment_to_admin_control...')
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION sync_appointment_to_admin_control()
      RETURNS TRIGGER AS $trigger$
      DECLARE
        business_record RECORD;
        client_record RECORD;
      BEGIN
        SELECT id, phone, email, name
        INTO business_record
        FROM "Business"
        WHERE id = NEW."businessId";

        IF NEW."clientId" IS NOT NULL THEN
          SELECT id, name, phone
          INTO client_record
          FROM "Client"
          WHERE id = NEW."clientId";
        END IF;

        INSERT INTO admin_control_center (
          business_id, business_phone, business_email, business_name,
          client_id, client_name, client_phone, action_type, metadata, created_at
        ) VALUES (
          business_record.id::UUID,
          business_record.phone,
          business_record.email,
          business_record.name,
          COALESCE(client_record.id::UUID, NULL),
          COALESCE(client_record.name, NEW."clientName"),
          COALESCE(client_record.phone, NEW."clientPhone"),
          'appointment_created',
          jsonb_build_object(
            'appointment_id', NEW.id,
            'business_id', NEW."businessId",
            'master_id', NEW."masterId",
            'start_time', NEW."startTime",
            'status', NEW.status,
            'created_at', NEW."createdAt"
          ),
          NOW()
        );

        RETURN NEW;
      END;
      $trigger$ LANGUAGE plpgsql;
    `)
    console.log('   ✅ Готово\n')

    // 13. Тригер для Appointment
    console.log('13. Створення тригера trigger_sync_appointment_to_admin_control...')
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trigger_sync_appointment_to_admin_control ON "Appointment";`)
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER trigger_sync_appointment_to_admin_control
      AFTER INSERT ON "Appointment"
      FOR EACH ROW
      EXECUTE FUNCTION sync_appointment_to_admin_control();
    `)
    console.log('   ✅ Готово\n')

    // 14. Тригерна функція для Business
    console.log('14. Створення тригерної функції sync_business_to_admin_control...')
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION sync_business_to_admin_control()
      RETURNS TRIGGER AS $trigger$
      BEGIN
        INSERT INTO admin_control_center (
          business_id, business_phone, business_email, business_name,
          action_type, metadata, created_at
        ) VALUES (
          NEW.id::UUID,
          NEW.phone,
          NEW.email,
          NEW.name,
          'business_created',
          jsonb_build_object(
            'business_id', NEW.id,
            'slug', NEW.slug,
            'niche', NEW.niche,
            'created_at', NEW."createdAt"
          ),
          NOW()
        );

        RETURN NEW;
      END;
      $trigger$ LANGUAGE plpgsql;
    `)
    console.log('   ✅ Готово\n')

    // 15. Тригер для Business
    console.log('15. Створення тригера trigger_sync_business_to_admin_control...')
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trigger_sync_business_to_admin_control ON "Business";`)
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER trigger_sync_business_to_admin_control
      AFTER INSERT ON "Business"
      FOR EACH ROW
      EXECUTE FUNCTION sync_business_to_admin_control();
    `)
    console.log('   ✅ Готово\n')

    // 16. Grant прав
    console.log('16. Надання прав доступу...')
    await prisma.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION set_current_business_id(UUID) TO PUBLIC;`)
    await prisma.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION get_current_business_id() TO PUBLIC;`)
    console.log('   ✅ Готово\n')

    // Перевірка
    console.log('🔍 Перевірка створених об\'єктів...\n')

    const functions = await prisma.$queryRawUnsafe<Array<{ routine_name: string }>>(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name IN (
        'set_current_business_id',
        'get_current_business_id',
        'sync_to_admin_control_center',
        'sync_appointment_to_admin_control',
        'sync_business_to_admin_control'
      )
    `)
    console.log(`   ✅ Функцій: ${functions.length}/5`)

    const triggers = await prisma.$queryRawUnsafe<Array<{ trigger_name: string }>>(`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE trigger_schema = 'public'
      AND trigger_name IN (
        'trigger_sync_client_to_admin_control',
        'trigger_sync_appointment_to_admin_control',
        'trigger_sync_business_to_admin_control'
      )
    `)
    console.log(`   ✅ Тригерів: ${triggers.length}/3`)

    const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = 'admin_control_center'
    `)
    console.log(`   ✅ Таблиця admin_control_center: ${tables.length > 0 ? 'створена' : 'не знайдена'}`)

    console.log('\n✅ Міграція завершена успішно!')
  } catch (error: any) {
    console.error('❌ Помилка міграції:', error?.message || error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

applyRLSMigration()
  .then(() => {
    console.log('\n✅ RLS міграція успішно застосована!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Помилка застосування міграції:', error)
    process.exit(1)
  })

